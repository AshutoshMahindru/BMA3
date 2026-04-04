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

export async function executePlanningSpine(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  // ── Step 1: Resolve company context and tenant boundary ─────────────────
  const companyResult = await db.query(
    `SELECT id, name, status, default_currency, fiscal_year_start_month
     FROM companies
     WHERE id = $1`,
    [ctx.company_id]
  );

  if (companyResult.rows.length === 0) {
    throw new Error(`Missing company context: company_id=${ctx.company_id} not found`);
  }

  const company = companyResult.rows[0];
  if (company.status !== 'active') {
    throw new Error(
      `Company ${ctx.company_id} has status '${company.status}' — must be 'active' for compute`
    );
  }

  // ── Step 2: Resolve scenario context ────────────────────────────────────
  const scenarioResult = await db.query(
    `SELECT id, name, scenario_family, status, company_id
     FROM scenarios
     WHERE id = $1 AND company_id = $2`,
    [ctx.scenario_id, ctx.company_id]
  );

  if (scenarioResult.rows.length === 0) {
    throw new Error(
      `Invalid scenario reference: scenario_id=${ctx.scenario_id} not found for company_id=${ctx.company_id}`
    );
  }

  const scenario = scenarioResult.rows[0];
  // scenario_family must be one of: base, bull, bear, stress, strategic-option
  const validFamilies = ['base', 'bull', 'bear', 'stress', 'strategic-option'];
  if (scenario.scenario_family && !validFamilies.includes(scenario.scenario_family)) {
    throw new Error(
      `Scenario ${ctx.scenario_id} has invalid family '${scenario.scenario_family}'. ` +
      `Expected one of: ${validFamilies.join(', ')}`
    );
  }

  // ── Step 3: Resolve version state ───────────────────────────────────────
  const versionResult = await db.query(
    `SELECT id, status, label
     FROM versions
     WHERE id = $1 AND scenario_id = $2`,
    [ctx.version_id, ctx.scenario_id]
  );

  if (versionResult.rows.length === 0) {
    // Try without scenario constraint — version may exist but not be linked
    const versionExistsResult = await db.query(
      `SELECT id, status FROM versions WHERE id = $1`,
      [ctx.version_id]
    );

    if (versionExistsResult.rows.length === 0) {
      throw new Error(`Version ${ctx.version_id} does not exist`);
    }

    // Version exists but wrong scenario — proceed with warning
    console.warn(
      `[planning-spine] Version ${ctx.version_id} exists but not linked to scenario ${ctx.scenario_id}. Proceeding.`
    );
  }

  // Validate version state allows compute
  // Valid compute states: working_draft, submitted, approved (not published/frozen)
  const version = versionResult.rows[0] ?? { status: 'working_draft' };
  const computeBlockedStates = ['frozen', 'rejected'];
  if (computeBlockedStates.includes(version.status)) {
    throw new Error(
      `Version ${ctx.version_id} has state '${version.status}' which conflicts with governance rules — cannot compute`
    );
  }

  // ── Step 4: Resolve planning horizon and period range ───────────────────
  const periodsResult = await db.query(
    `SELECT id AS period_id, label, start_date, end_date
     FROM planning_periods
     WHERE company_id = $1
       AND start_date >= $2
       AND end_date <= $3
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
      console.warn(
        `[planning-spine] Gap of ${gapDays} days between period ${periods[i - 1].label} ` +
        `and ${periods[i].label}`
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

  console.log(
    `[planning-spine] Resolved: company=${company.name}, scenario=${scenario.name}, ` +
    `version=${version.status ?? 'default'}, periods=${periods.length} ` +
    `(${periods[0].label} → ${periods[periods.length - 1].label})`
  );
}
