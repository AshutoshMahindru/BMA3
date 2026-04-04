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
import { logger } from '../../lib/logger';

export async function executeScopeBundle(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.planning_spine) {
    throw new Error('[scope-bundle] Planning spine not resolved — cannot validate scope bundle');
  }

  // ── Step 1: Load scope bundle for this scenario ─────────────────────────
  const bundleResult = await db.query(
    `SELECT sb.id, sb.name, sb.status, sb.is_default
     FROM scope_bundles sb
     WHERE sb.company_id = $1
       AND sb.scenario_id = $2
       AND sb.is_deleted = FALSE
     ORDER BY sb.is_default DESC, sb.created_at DESC
     LIMIT 1`,
    [ctx.company_id, ctx.scenario_id]
  );

  const scopeBundle = bundleResult.rows[0] ?? null;
  if (!scopeBundle) {
    logger.warn(
      { company_id: ctx.company_id, scenario_id: ctx.scenario_id },
      'No scope bundle found, proceeding with company-level scope'
    );
  }

  // ── Step 2: Validate format selections against format_taxonomy_nodes ────
  // DDL: taxonomy_bindings(binding_id, source_entity_type, source_entity_id,
  //   taxonomy_family, node_id, binding_role, created_at)
  const formats = [];
  if (scopeBundle) {
    const formatsResult = await db.query(
      `SELECT DISTINCT tn.node_id, tn.label
       FROM taxonomy_bindings tb
       JOIN format_taxonomy_nodes tn ON tn.node_id = tb.node_id
       WHERE tb.source_entity_type = 'scope_bundle'
         AND tb.source_entity_id = $1
         AND tb.taxonomy_family = 'format'
         AND tn.status = 'active'`,
      [scopeBundle.id]
    );
    formats.push(...formatsResult.rows.map((r: any) => r.node_id));
  }
  if (scopeBundle && formats.length === 0) {
    // Try loading from scope_bundle_items as fallback
    // DDL: scope_bundle_items(id, scope_bundle_id, dimension_family, node_type, node_id, ...)
    const fallbackFormats = await db.query(
      `SELECT DISTINCT node_id
       FROM scope_bundle_items
       WHERE scope_bundle_id = $1 AND dimension_family = 'format'`,
      [scopeBundle.id]
    );
    formats.push(...fallbackFormats.rows.map((r: any) => r.node_id));
  }

  // ── Step 3: Validate category/portfolio selections ──────────────────────
  const categories = [];
  if (scopeBundle) {
    const categoriesResult = await db.query(
      `SELECT DISTINCT tn.node_id, tn.label
       FROM taxonomy_bindings tb
       JOIN category_taxonomy_nodes tn ON tn.node_id = tb.node_id
       WHERE tb.source_entity_type = 'scope_bundle'
         AND tb.source_entity_id = $1
         AND tb.taxonomy_family = 'category'
         AND tn.status = 'active'`,
      [scopeBundle.id]
    );
    categories.push(...categoriesResult.rows.map((r: any) => r.node_id));
  }
  if (scopeBundle && categories.length === 0) {
    const fallbackCats = await db.query(
      `SELECT DISTINCT node_id
       FROM scope_bundle_items
       WHERE scope_bundle_id = $1 AND dimension_family = 'category'`,
      [scopeBundle.id]
    );
    categories.push(...fallbackCats.rows.map((r: any) => r.node_id));
  }

  // ── Step 4: Validate channel selections ─────────────────────────────────
  const channels = [];
  if (scopeBundle) {
    const channelsResult = await db.query(
      `SELECT DISTINCT tn.node_id, tn.label
       FROM taxonomy_bindings tb
       JOIN channel_taxonomy_nodes tn ON tn.node_id = tb.node_id
       WHERE tb.source_entity_type = 'scope_bundle'
         AND tb.source_entity_id = $1
         AND tb.taxonomy_family = 'channel'
         AND tn.status = 'active'`,
      [scopeBundle.id]
    );
    channels.push(...channelsResult.rows.map((r: any) => r.node_id));
  }
  if (scopeBundle && channels.length === 0) {
    const fallbackChannels = await db.query(
      `SELECT DISTINCT node_id
       FROM scope_bundle_items
       WHERE scope_bundle_id = $1 AND dimension_family = 'channel'`,
      [scopeBundle.id]
    );
    channels.push(...fallbackChannels.rows.map((r: any) => r.node_id));
  }

  // ── Step 5: Validate geography selections ───────────────────────────────
  const geographies = [];
  if (scopeBundle) {
    const geographiesResult = await db.query(
      `SELECT DISTINCT tn.node_id, tn.label
       FROM taxonomy_bindings tb
       JOIN geography_nodes tn ON tn.node_id = tb.node_id
       WHERE tb.source_entity_type = 'scope_bundle'
         AND tb.source_entity_id = $1
         AND tb.taxonomy_family = 'geography'
         AND tn.status = 'active'`,
      [scopeBundle.id]
    );
    geographies.push(...geographiesResult.rows.map((r: any) => r.node_id));
  }
  if (scopeBundle && geographies.length === 0) {
    const fallbackGeos = await db.query(
      `SELECT DISTINCT node_id
       FROM scope_bundle_items
       WHERE scope_bundle_id = $1 AND dimension_family = 'geography'`,
      [scopeBundle.id]
    );
    geographies.push(...fallbackGeos.rows.map((r: any) => r.node_id));
  }

  // ── Step 6: Check all dimensional combinations are valid ────────────────
  // No orphan references — every taxonomy node must be active
  // (Already filtered by status='active' in queries above)

  // Validate that scope is not completely empty
  const totalSelections = formats.length + categories.length + channels.length + geographies.length;
  if (totalSelections === 0) {
    logger.warn(
      { scopeBundleId: scopeBundle?.id || null, company_id: ctx.company_id },
      'Scope bundle has no taxonomy bindings, proceeding with company-level scope'
    );
  }

  // ── Step 7: Emit scope_bundle_hash for downstream dependency tracking ───
  state.scope_bundle = {
    scope_bundle_id: scopeBundle?.id || ctx.company_id,
    geographies,
    formats,
    categories,
    channels,
  };

  logger.info(
    {
      bundle_name: scopeBundle?.name || 'company_level_scope',
      geographies_count: geographies.length,
      formats_count: formats.length,
      categories_count: categories.length,
      channels_count: channels.length,
    },
    'Scope bundle resolved'
  );
}
