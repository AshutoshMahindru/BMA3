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
 */

import { db } from '../../db';
import { ComputeContext, PipelineState } from '../orchestrator';

export async function executeDecisions(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.scope_bundle) {
    throw new Error('[decisions] Scope bundle not resolved — cannot resolve decisions');
  }

  // ── Step 1-4: Resolve decisions across all families ─────────────────────
  // Decision families: product, market, marketing, operations
  // Only decisions with lifecycle state 'accepted' or 'activated' enter compute
  const decisionsResult = await db.query(
    `SELECT d.id, d.decision_family, d.decision_type, d.title,
            d.lifecycle_state, d.scope_bundle_id, d.effective_period_start,
            d.effective_period_end, d.metadata
     FROM decisions d
     WHERE d.company_id = $1
       AND d.scenario_id = $2
       AND d.lifecycle_state IN ('accepted', 'activated')
     ORDER BY d.decision_family, d.created_at ASC`,
    [ctx.company_id, ctx.scenario_id]
  );

  const activeDecisions = decisionsResult.rows;

  // ── Step 5: Validate decision lifecycle states ──────────────────────────
  // Decisions in draft/rejected state are excluded (already filtered above)
  // Log decisions that were excluded
  const excludedResult = await db.query(
    `SELECT id, decision_family, lifecycle_state, title
     FROM decisions
     WHERE company_id = $1
       AND scenario_id = $2
       AND lifecycle_state NOT IN ('accepted', 'activated')`,
    [ctx.company_id, ctx.scenario_id]
  );

  if (excludedResult.rows.length > 0) {
    console.log(
      `[decisions] Excluded ${excludedResult.rows.length} decisions with non-compute lifecycle states: ` +
      excludedResult.rows.map((r: any) => `${r.title}(${r.lifecycle_state})`).join(', ')
    );
  }

  // ── Step 6: Check decision bundle consistency ───────────────────────────
  // Validate no conflicting decisions within same scope/period
  const decisionsByFamily: Record<string, any[]> = {};
  for (const decision of activeDecisions) {
    const family = decision.decision_family || 'unknown';
    if (!decisionsByFamily[family]) {
      decisionsByFamily[family] = [];
    }
    decisionsByFamily[family].push(decision);
  }

  // Check for scope conflicts within each family
  for (const [family, decisions] of Object.entries(decisionsByFamily)) {
    if (decisions.length > 1) {
      // Check overlapping effective periods within same family
      for (let i = 0; i < decisions.length; i++) {
        for (let j = i + 1; j < decisions.length; j++) {
          const d1 = decisions[i];
          const d2 = decisions[j];

          if (
            d1.scope_bundle_id === d2.scope_bundle_id &&
            d1.effective_period_start &&
            d2.effective_period_start &&
            d1.effective_period_end &&
            d2.effective_period_end
          ) {
            const overlap =
              d1.effective_period_start <= d2.effective_period_end &&
              d2.effective_period_start <= d1.effective_period_end;

            if (overlap) {
              console.warn(
                `[decisions] Potential conflict in ${family} family: ` +
                `'${d1.title}' and '${d2.title}' have overlapping effective periods`
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
      console.warn(
        `[decisions] Decision '${decision.title}' (${decision.id}) references ` +
        `scope_bundle_id=${decision.scope_bundle_id} which differs from active ` +
        `scope bundle ${state.scope_bundle.scope_bundle_id}`
      );
    }
  }

  // ── Emit resolved decision state ────────────────────────────────────────
  const decisionState: Record<string, unknown> = {};
  for (const [family, decisions] of Object.entries(decisionsByFamily)) {
    decisionState[family] = decisions.map((d: any) => ({
      id: d.id,
      type: d.decision_type,
      title: d.title,
      effective_start: d.effective_period_start,
      effective_end: d.effective_period_end,
    }));
  }

  state.decisions = {
    active_decision_ids: activeDecisions.map((d: any) => d.id),
    decision_state: decisionState,
  };

  console.log(
    `[decisions] Resolved ${activeDecisions.length} active decisions across ` +
    `${Object.keys(decisionsByFamily).length} families: ` +
    Object.entries(decisionsByFamily)
      .map(([family, decs]) => `${family}(${decs.length})`)
      .join(', ')
  );
}
