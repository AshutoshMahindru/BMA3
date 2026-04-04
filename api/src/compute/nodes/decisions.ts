/**
 * Step 3: Decision Resolution
 *
 * Resolves active decisions for the scenario.
 * Validates decision dependencies and lifecycle states.
 * Only accepted/activated decisions enter the compute pipeline.
 *
 * Fail-fast: decisions must resolve before assumptions bind.
 *
 * Source: computation_graph.json → node_decisions
 *
 * DDL table: decision_records
 * Columns: id, company_id, scenario_id, version_id, decision_family,
 *   decision_status, scope_bundle_id, title, rationale_summary,
 *   owner_user_id, effective_from_period_id, effective_to_period_id,
 *   metadata, created_at, updated_at
 */

import { db } from '../../db';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

export async function executeDecisions(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.scope_bundle) {
    throw new Error('[decisions] Scope bundle not resolved — cannot resolve decisions');
  }

  // ── Step 1-4: Resolve decisions across all families ─────────────────────
  // Decision families: product, market, marketing, operations
  // Only decisions with status 'accepted' or 'activated' enter compute
  // DDL: decision_records columns: decision_family, decision_status
  const decisionsResult = await db.query(
    `SELECT d.id,
            d.decision_family AS family,
            d.title,
            d.decision_status AS status,
            d.scope_bundle_id,
            d.effective_from_period_id AS effective_period_id,
            d.effective_to_period_id,
            d.metadata
     FROM decision_records d
     WHERE d.company_id = $1
       AND d.scenario_id = $2
       AND d.decision_status IN ('accepted', 'active')
     ORDER BY d.decision_family, d.created_at ASC`,
    [ctx.company_id, ctx.scenario_id]
  );

  const activeDecisions = decisionsResult.rows;

  // ── Step 5: Validate decision lifecycle states ──────────────────────────
  // Decisions in draft/rejected state are excluded (already filtered above)
  // Log decisions that were excluded
  const excludedResult = await db.query(
    `SELECT id,
            decision_family AS family,
            decision_status AS status,
            title
     FROM decision_records
     WHERE company_id = $1
       AND scenario_id = $2
       AND decision_status NOT IN ('accepted', 'active')`,
    [ctx.company_id, ctx.scenario_id]
  );

  if (excludedResult.rows.length > 0) {
    logger.info(
      {
        excludedCount: excludedResult.rows.length,
        excluded: excludedResult.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          family: r.family,
        })),
      },
      'Excluded decisions with non-compute statuses'
    );
  }

  // ── Step 6: Check decision bundle consistency ───────────────────────────
  // Validate no conflicting decisions within same scope/period
  const decisionsByFamily: Record<string, any[]> = {};
  for (const decision of activeDecisions) {
    const family = decision.family || 'unknown';
    if (!decisionsByFamily[family]) {
      decisionsByFamily[family] = [];
    }
    decisionsByFamily[family].push(decision);
  }

  // Check for scope conflicts within each family
  for (const [family, decisions] of Object.entries(decisionsByFamily)) {
    if (decisions.length > 1) {
      // Build a period-date lookup from the planning spine for real date-based overlap checks
      const periodDateMap = new Map<string, { start: string; end: string }>();
      if (state.planning_spine?.periods) {
        for (const p of state.planning_spine.periods) {
          periodDateMap.set(p.period_id, { start: p.start_date, end: p.end_date });
        }
      }

      // Check overlapping effective periods within same family
      for (let i = 0; i < decisions.length; i++) {
        for (let j = i + 1; j < decisions.length; j++) {
          const d1 = decisions[i];
          const d2 = decisions[j];

          if (
            d1.scope_bundle_id === d2.scope_bundle_id &&
            d1.effective_period_id &&
            d2.effective_period_id &&
            d1.effective_to_period_id &&
            d2.effective_to_period_id
          ) {
            // Resolve period UUIDs to actual dates for overlap comparison
            const d1Start = periodDateMap.get(d1.effective_period_id);
            const d1End = periodDateMap.get(d1.effective_to_period_id);
            const d2Start = periodDateMap.get(d2.effective_period_id);
            const d2End = periodDateMap.get(d2.effective_to_period_id);

            // Only warn when both ranges resolve and actually overlap.
            const hasOverlap =
              d1Start && d1End && d2Start && d2End
                ? new Date(d1Start.start) <= new Date(d2End.end) &&
                  new Date(d2Start.start) <= new Date(d1End.end)
                : false;

            if (hasOverlap) {
              logger.warn(
                {
                  family,
                  decision_a: { id: d1.id, title: d1.title, scope_bundle_id: d1.scope_bundle_id },
                  decision_b: { id: d2.id, title: d2.title, scope_bundle_id: d2.scope_bundle_id },
                },
                'Potential conflict: decisions share same scope bundle and overlap'
              );
            }
          }
        }
      }
    }
  }

  // ── Step 7: Validate decision-scope references ──────────────────────────
  // Check that decisions don't reference objects outside scope bundle
  for (const decision of activeDecisions) {
    if (
      decision.scope_bundle_id &&
      decision.scope_bundle_id !== state.scope_bundle.scope_bundle_id
    ) {
      logger.warn(
        {
          decisionId: decision.id,
          decisionTitle: decision.title,
          decisionScopeBundleId: decision.scope_bundle_id,
          activeScopeBundleId: state.scope_bundle.scope_bundle_id,
        },
        'Decision references scope bundle that differs from active scope bundle'
      );
    }
  }

  // ── Emit resolved decision state ────────────────────────────────────────
  const decisionState: Record<string, unknown> = {};
  for (const [family, decisions] of Object.entries(decisionsByFamily)) {
    decisionState[family] = decisions.map((d: any) => ({
      id: d.id,
      title: d.title,
      effective_period_id: d.effective_period_id,
      effective_to_period_id: d.effective_to_period_id,
    }));
  }

  state.decisions = {
    active_decision_ids: activeDecisions.map((d: any) => d.id),
    decision_state: decisionState,
  };

  logger.info(
    {
      activeDecisionsCount: activeDecisions.length,
      families: Object.fromEntries(
        Object.entries(decisionsByFamily).map(([family, decs]) => [family, decs.length])
      ),
    },
    'Decisions resolved'
  );
}
