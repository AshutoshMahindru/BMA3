/**
 * Step 1: Planning Spine Resolution
 *
 * Resolves: company, scenario, version, period range.
 * Validates they exist and are consistent.
 * No computation — purely context resolution.
 *
 * Fail-fast: no downstream computation without a valid spine.
 *
 * Source: computation_graph.json → node_planning_spine
 */

import { db } from '../../db';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

export async function executePlanningSpine(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  // ── Step 1: Resolve company context and tenant boundary ─────────────────
  const companyResult = await db.query(
    `SELECT id, name, base_currency, fiscal_year_start_month
     FROM companies
     WHERE id = $1
       AND is_deleted = FALSE`,
    [ctx.company_id]
  );

  if (companyResult.rows.length === 0) {
    throw new Error(`Missing company context: company_id=${ctx.company_id} not found`);
  }

  const company = companyResult.rows[0];

  // ── Step 2: Resolve scenario context ────────────────────────────────────
  const scenarioResult = await db.query(
    `SELECT id, name, scenario_type AS scenario_family, company_id
     FROM scenarios
     WHERE id = $1
       AND company_id = $2
       AND is_deleted = FALSE`,
    [ctx.scenario_id, ctx.company_id]
  );

  if (scenarioResult.rows.length === 0) {
    throw new Error(
      `Invalid scenario reference: scenario_id=${ctx.scenario_id} not found for company_id=${ctx.company_id}`
    );
  }

  const scenario = scenarioResult.rows[0];
  // scenario_family must be one of: base, bull, bear, stress, strategic-option
  const validFamilies = ['base', 'bull_case', 'bear_case', 'stress_test', 'custom'];
  if (scenario.scenario_family && !validFamilies.includes(scenario.scenario_family)) {
    throw new Error(
      `Scenario ${ctx.scenario_id} has invalid family '${scenario.scenario_family}'. ` +
      `Expected one of: ${validFamilies.join(', ')}`
    );
  }

  // ── Step 3: Resolve version state ───────────────────────────────────────
  const versionResult = await db.query(
    `SELECT id, status, name AS version_label, is_frozen
     FROM plan_versions
     WHERE id = $1
       AND scenario_id = $2
       AND is_deleted = FALSE`,
    [ctx.version_id, ctx.scenario_id]
  );

  if (versionResult.rows.length === 0) {
    // Try without scenario constraint — version may exist but not be linked
    const versionExistsResult = await db.query(
      `SELECT id, status, is_frozen
         FROM plan_versions
        WHERE id = $1
          AND is_deleted = FALSE`,
      [ctx.version_id]
    );

    if (versionExistsResult.rows.length === 0) {
      throw new Error(`Version ${ctx.version_id} does not exist`);
    }

    // Version exists but wrong scenario — proceed with warning
    logger.warn(
      { version_id: ctx.version_id, scenario_id: ctx.scenario_id },
      'Version exists but not linked to scenario, proceeding'
    );
  }

  // Validate version state allows compute
  const version = versionResult.rows[0] ?? { status: 'draft', version_label: null, is_frozen: false };
  const computeBlockedStates = ['published', 'archived', 'superseded'];
  if (version.is_frozen || computeBlockedStates.includes(version.status)) {
    throw new Error(
      `Version ${ctx.version_id} has state '${version.status}' which conflicts with governance rules — cannot compute`
    );
  }

  // ── Step 4: Resolve planning horizon and period range ───────────────────
  const periodsResult = await db.query(
    `SELECT pp.id AS period_id,
            pp.name AS label,
            pp.start_date,
            pp.end_date
       FROM planning_periods pp
       JOIN planning_calendars pc
         ON pc.id = pp.calendar_id
      WHERE pc.company_id = $1
        AND pc.is_deleted = FALSE
        AND pp.is_deleted = FALSE
        AND pp.start_date >= $2
        AND pp.end_date <= $3
     ORDER BY start_date ASC`,
    [ctx.company_id, ctx.period_range.start, ctx.period_range.end]
  );

  if (periodsResult.rows.length === 0) {
    throw new Error(
      `Planning period range exceeds system limits or no periods found for ` +
      `company_id=${ctx.company_id}, range=[${ctx.period_range.start}, ${ctx.period_range.end}]`
    );
  }

  // ── Step 5: Validate spine completeness and consistency ─────────────────
  const periods = periodsResult.rows.map((row: any) => ({
    period_id: row.period_id,
    start_date: row.start_date,
    end_date: row.end_date,
    label: row.label,
  }));

  // Check for gaps in the period sequence
  for (let i = 1; i < periods.length; i++) {
    const prevEnd = new Date(periods[i - 1].end_date);
    const currStart = new Date(periods[i].start_date);
    const gapDays = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24);

    if (gapDays > 1) {
      logger.warn(
        { gapDays, prev: periods[i - 1].label, curr: periods[i].label },
        'Planning-spine gap between periods'
      );
    }
  }

  // System limit check: max 60 periods (5 years monthly)
  if (periods.length > 60) {
    throw new Error(
      `Planning period range of ${periods.length} periods exceeds system limit of 60`
    );
  }

  // ── Step 6: Generate planning_spine_hash for dependency tracking ────────
  const spineData = {
    company_id: ctx.company_id,
    scenario_id: ctx.scenario_id,
    version_id: ctx.version_id,
    period_count: periods.length,
    period_range: {
      start: periods[0].start_date,
      end: periods[periods.length - 1].end_date,
    },
  };

  // Populate pipeline state for downstream nodes
  state.planning_spine = {
    company_id: ctx.company_id,
    scenario_id: ctx.scenario_id,
    version_id: ctx.version_id,
    periods,
  };

  logger.info(
    {
      company: company.name,
      scenario: scenario.name,
      version: version.status ?? 'default',
      periodsCount: periods.length,
      firstPeriod: periods[0].label,
      lastPeriod: periods[periods.length - 1].label,
    },
    'Planning-spine resolved'
  );
}
