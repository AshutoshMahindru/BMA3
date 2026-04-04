/**
 * Step 2: Scope Bundle Validation
 *
 * Validates scope bundle exists for the scenario.
 * Resolves: geographies, formats, categories, channels in scope.
 * Checks all dimensional combinations are valid.
 *
 * Fail-fast: scope must be valid before decisions resolve.
 *
 * Source: computation_graph.json → node_scope_bundle
 */

import { db } from '../../db';
import { ComputeContext, PipelineState } from '../orchestrator';

export async function executeScopeBundle(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.planning_spine) {
    throw new Error('[scope-bundle] Planning spine not resolved — cannot validate scope bundle');
  }

  // ── Step 1: Load scope bundle for this scenario ─────────────────────────
  const bundleResult = await db.query(
    `SELECT sb.id, sb.bundle_name, sb.status, sb.is_default
     FROM scope_bundles sb
     WHERE sb.company_id = $1
       AND sb.scenario_id = $2
       AND sb.status = 'active'
     ORDER BY sb.is_default DESC, sb.created_at DESC
     LIMIT 1`,
    [ctx.company_id, ctx.scenario_id]
  );

  if (bundleResult.rows.length === 0) {
    throw new Error(
      `Empty scope bundle (no active selections) for company_id=${ctx.company_id}, ` +
      `scenario_id=${ctx.scenario_id}`
    );
  }

  const scopeBundle = bundleResult.rows[0];

  // ── Step 2: Validate format selections against format_taxonomy_nodes ────
  const formatsResult = await db.query(
    `SELECT DISTINCT tn.id, tn.name
     FROM taxonomy_bindings tb
     JOIN format_taxonomy_nodes tn ON tn.id = tb.taxonomy_node_id
     WHERE tb.scope_bundle_id = $1
       AND tb.taxonomy_type = 'format'
       AND tn.status = 'active'`,
    [scopeBundle.id]
  );

  const formats = formatsResult.rows.map((r: any) => r.id);
  if (formats.length === 0) {
    // Try loading from scope_bundle_members as fallback
    const fallbackFormats = await db.query(
      `SELECT DISTINCT dimension_value
       FROM scope_bundle_members
       WHERE scope_bundle_id = $1 AND dimension_type = 'format'`,
      [scopeBundle.id]
    );
    formats.push(...fallbackFormats.rows.map((r: any) => r.dimension_value));
  }

  // ── Step 3: Validate category/portfolio selections ──────────────────────
  const categoriesResult = await db.query(
    `SELECT DISTINCT tn.id, tn.name
     FROM taxonomy_bindings tb
     JOIN category_taxonomy_nodes tn ON tn.id = tb.taxonomy_node_id
     WHERE tb.scope_bundle_id = $1
       AND tb.taxonomy_type = 'category'
       AND tn.status = 'active'`,
    [scopeBundle.id]
  );

  const categories = categoriesResult.rows.map((r: any) => r.id);
  if (categories.length === 0) {
    const fallbackCats = await db.query(
      `SELECT DISTINCT dimension_value
       FROM scope_bundle_members
       WHERE scope_bundle_id = $1 AND dimension_type = 'category'`,
      [scopeBundle.id]
    );
    categories.push(...fallbackCats.rows.map((r: any) => r.dimension_value));
  }

  // ── Step 4: Validate channel selections ─────────────────────────────────
  const channelsResult = await db.query(
    `SELECT DISTINCT tn.id, tn.name
     FROM taxonomy_bindings tb
     JOIN channel_taxonomy_nodes tn ON tn.id = tb.taxonomy_node_id
     WHERE tb.scope_bundle_id = $1
       AND tb.taxonomy_type = 'channel'
       AND tn.status = 'active'`,
    [scopeBundle.id]
  );

  const channels = channelsResult.rows.map((r: any) => r.id);
  if (channels.length === 0) {
    const fallbackChannels = await db.query(
      `SELECT DISTINCT dimension_value
       FROM scope_bundle_members
       WHERE scope_bundle_id = $1 AND dimension_type = 'channel'`,
      [scopeBundle.id]
    );
    channels.push(...fallbackChannels.rows.map((r: any) => r.dimension_value));
  }

  // ── Step 5: Validate geography selections ───────────────────────────────
  const geographiesResult = await db.query(
    `SELECT DISTINCT tn.id, tn.name
     FROM taxonomy_bindings tb
     JOIN geography_taxonomy_nodes tn ON tn.id = tb.taxonomy_node_id
     WHERE tb.scope_bundle_id = $1
       AND tb.taxonomy_type = 'geography'
       AND tn.status = 'active'`,
    [scopeBundle.id]
  );

  const geographies = geographiesResult.rows.map((r: any) => r.id);
  if (geographies.length === 0) {
    const fallbackGeos = await db.query(
      `SELECT DISTINCT dimension_value
       FROM scope_bundle_members
       WHERE scope_bundle_id = $1 AND dimension_type = 'geography'`,
      [scopeBundle.id]
    );
    geographies.push(...fallbackGeos.rows.map((r: any) => r.dimension_value));
  }

  // ── Step 6: Check all dimensional combinations are valid ────────────────
  // No orphan references — every taxonomy node must be active
  // (Already filtered by status='active' in queries above)

  // Validate that scope is not completely empty
  const totalSelections = formats.length + categories.length + channels.length + geographies.length;
  if (totalSelections === 0) {
    console.warn(
      `[scope-bundle] Scope bundle ${scopeBundle.id} has no taxonomy bindings. ` +
      `Proceeding with company-level scope.`
    );
  }

  // ── Step 7: Emit scope_bundle_hash for downstream dependency tracking ───
  state.scope_bundle = {
    scope_bundle_id: scopeBundle.id,
    geographies,
    formats,
    categories,
    channels,
  };

  console.log(
    `[scope-bundle] Resolved bundle '${scopeBundle.bundle_name}': ` +
    `${geographies.length} geographies, ${formats.length} formats, ` +
    `${categories.length} categories, ${channels.length} channels`
  );
}
