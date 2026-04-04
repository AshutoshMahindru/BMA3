/**
 * Step 14: Confidence & DQI Rollups
 *
 * Computes Data Quality Index (DQI) scores per assumption and confidence
 * rollups across assumption families, weighted by EBITDA sensitivity.
 *
 * 1. DQI SCORING
 *    For each assumption: compute DQI based on evidence type and recency.
 *    Evidence type scores:
 *      market_research → 90, historical_data → 85, industry_benchmark → 75,
 *      expert_estimate → 60, operator_input → 50
 *    Seven DQI dimensions are weighted and rolled up to an overall score.
 *
 * 2. CONFIDENCE ROLLUPS
 *    overall_confidence = weighted_average(category_dqi_scores, weights=ebitda_sensitivity)
 *    confidence_band = map score to 'very_low'|'low'|'medium'|'high'|'very_high'
 *    critical_path_penalty = reduce score if high-sensitivity assumptions have low DQI
 *
 * DDL tables:
 *   confidence_assessments: assessment_id(PK), company_id, entity_type, entity_id,
 *     state, numeric_score, owner_user_id, review_due_at, status, rationale,
 *     evidence_count, created_at, updated_at
 *   dqi_scores: dqi_score_id(PK), entity_type, entity_id, source_quality_score,
 *     freshness_score, completeness_score, relevance_score, granularity_score,
 *     consistency_score, traceability_score, overall_score, computed_at, created_at
 *   confidence_rollups: id(PK), company_id, rollup_scope, scope_id,
 *     weighted_score, lowest_critical_score, assessment_count, computed_at
 *
 * Source: computation_graph.json → node_confidence
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

interface AssumptionDQI {
  variable_name: string;
  family: string;
  evidence_type: string;
  source_quality_score: number;
  freshness_score: number;
  completeness_score: number;
  relevance_score: number;
  granularity_score: number;
  consistency_score: number;
  traceability_score: number;
  overall_score: number;
  ebitda_sensitivity_weight: number;
}

type ConfidenceBand = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
type EvidenceTypeKey = keyof typeof EVIDENCE_TYPE_SCORES;

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Evidence type base scores — derived from confidence model specifications.
 * NOT hardcoded constants in the model sense — these are the scoring rubric.
 */
const EVIDENCE_TYPE_SCORES: Record<string, number> = {
  market_research: 90,
  historical_data: 85,
  industry_benchmark: 75,
  expert_estimate: 60,
  operator_input: 50,
  unknown: 30,
};

/**
 * DQI dimension weights (must sum to 1.0).
 * Source quality and freshness get highest weight.
 */
const DQI_WEIGHTS = {
  source_quality: 0.25,
  freshness: 0.20,
  completeness: 0.15,
  relevance: 0.15,
  granularity: 0.10,
  consistency: 0.10,
  traceability: 0.05,
};

/**
 * Map assumption variable names to assumption families for rollup.
 */
const VARIABLE_FAMILY_MAP: Record<string, string> = {
  // Product / COGS
  cogs_per_unit: 'product',
  // Market / Demand
  gross_demand: 'market',
  reach_rate: 'market',
  conversion_rate: 'market',
  retention_rate: 'market',
  // Price / Revenue
  average_order_value: 'market',
  discount_rate: 'market',
  refund_rate: 'market',
  channel_fee_rate: 'market',
  // Operations
  variable_marketing_promo: 'operations',
  variable_labor_fulfillment: 'operations',
  site_controllable_opex: 'operations',
  fixed_site_costs: 'operations',
  shared_operating_allocations: 'operations',
  // Capacity
  practical_capacity: 'capacity',
  utilization_threshold: 'capacity',
  capacity_factor: 'capacity',
  // Funding
  equity_inflows: 'funding',
  debt_drawdowns: 'funding',
  debt_repayments: 'funding',
  interest_rate: 'funding',
  tax_rate: 'funding',
  minimum_cash_buffer: 'funding',
  receivables_days: 'funding',
  payables_days: 'funding',
  inventory_days: 'funding',
  // Capex
  capex_launch: 'capacity',
  capex_maintenance: 'capacity',
  capex_scaleup: 'capacity',
};

// ── Helper functions ─────────────────────────────────────────────────────────

function mapScoreToBand(score: number): ConfidenceBand {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'very_low';
}

function mapBandToState(band: ConfidenceBand): string {
  switch (band) {
    case 'very_high':
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    case 'very_low':
      return 'estimated';
  }
}

/**
 * Compute weighted average. Returns 0 if total weight is 0.
 */
function weightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = values.reduce((sum, v, i) => sum + v * weights[i], 0);
  return weightedSum / totalWeight;
}

function normalizeEvidenceType(rawEvidenceType?: string | null, rawEvidenceRef?: string | null): EvidenceTypeKey {
  const candidates = [rawEvidenceType, rawEvidenceRef].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );

  for (const candidate of candidates) {
    const normalized = candidate
      .trim()
      .toLowerCase()
      .replace(/[%/.:()-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const compact = normalized.replace(/\s+/g, '_');
    if (compact in EVIDENCE_TYPE_SCORES) {
      return compact as EvidenceTypeKey;
    }

    if (normalized.includes('market') && normalized.includes('research')) {
      return 'market_research';
    }
    if (normalized.includes('historical') || normalized.includes('actual') || normalized.includes('past data')) {
      return 'historical_data';
    }
    if (normalized.includes('industry') || normalized.includes('benchmark')) {
      return 'industry_benchmark';
    }
    if (
      (normalized.includes('expert') && normalized.includes('estimate')) ||
      normalized.includes('expert opinion') ||
      normalized.includes('consultant')
    ) {
      return 'expert_estimate';
    }
    if (
      (normalized.includes('operator') && normalized.includes('input')) ||
      normalized.includes('manual input') ||
      normalized.includes('founder input')
    ) {
      return 'operator_input';
    }
  }

  return 'unknown';
}

// ── Main execution ───────────────────────────────────────────────────────────

export async function executeConfidence(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.planning_spine) {
    throw new Error('[confidence] Planning spine not resolved');
  }
  if (!state.assumptions) {
    throw new Error('[confidence] Assumptions not resolved');
  }

  const assumptions = state.assumptions;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. LOAD EXISTING DQI SCORES AND CONFIDENCE ASSESSMENTS
  // ══════════════════════════════════════════════════════════════════════════

  // DDL: confidence_assessments(assessment_id, company_id, entity_type, entity_id,
  //   state, numeric_score, status, rationale, evidence_count, ...)
  const existingAssessments = await db.query(
    `SELECT assessment_id, entity_id, entity_type, state, numeric_score
     FROM confidence_assessments
     WHERE company_id = $1 AND status = 'active'`,
    [ctx.company_id]
  );

  // Build lookup of existing manual scores keyed by entity_id
  const manualScores = new Map<string, { state: string; score: number }>();
  for (const row of existingAssessments.rows) {
    manualScores.set(row.entity_id, {
      state: row.state,
      score: row.numeric_score ?? 0,
    });
  }

  // DDL: dqi_scores(dqi_score_id, entity_type, entity_id, source_quality_score,
  //   freshness_score, completeness_score, relevance_score, granularity_score,
  //   consistency_score, traceability_score, overall_score, computed_at, created_at)
  const existingDQI = await db.query(
    `SELECT dqi_score_id, entity_id, source_quality_score, freshness_score,
            completeness_score, relevance_score, granularity_score,
            consistency_score, traceability_score, overall_score
     FROM dqi_scores
     WHERE entity_type = 'assumption_field'`
  );

  const existingDQIMap = new Map<string, Record<string, number>>();
  for (const row of existingDQI.rows) {
    existingDQIMap.set(row.entity_id, {
      source_quality_score: row.source_quality_score ?? 0,
      freshness_score: row.freshness_score ?? 0,
      completeness_score: row.completeness_score ?? 0,
      relevance_score: row.relevance_score ?? 0,
      granularity_score: row.granularity_score ?? 0,
      consistency_score: row.consistency_score ?? 0,
      traceability_score: row.traceability_score ?? 0,
      overall_score: row.overall_score ?? 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. COMPUTE DQI SCORES PER ASSUMPTION
  // ══════════════════════════════════════════════════════════════════════════

  // Get sensitivity weights from step 13 pipeline state
  const sensitivityState = (state.financials as Record<string, Record<string, number>>)['__sensitivity'] || {};

  // Build sensitivity weight map from tornado ranking
  const sensitivityWeights: Record<string, number> = {};
  let maxSensitivity = 0;
  for (const key of Object.keys(sensitivityState)) {
    if (key.startsWith('tornado_')) {
      const driverName = key.replace('tornado_', '');
      sensitivityWeights[driverName] = sensitivityState[key];
      maxSensitivity = Math.max(maxSensitivity, sensitivityState[key]);
    }
  }

  // Normalize sensitivity weights so max = 1.0
  if (maxSensitivity > 0) {
    for (const key of Object.keys(sensitivityWeights)) {
      sensitivityWeights[key] = sensitivityWeights[key] / maxSensitivity;
    }
  }

  // List of assumption variables we need to score
  const assumptionVariables = Object.keys(VARIABLE_FAMILY_MAP);
  const dqiResults: AssumptionDQI[] = [];

  for (const varName of assumptionVariables) {
    const family = VARIABLE_FAMILY_MAP[varName] ?? 'unknown';

    // Try to load the assumption pack binding to determine evidence type
    // DDL: assumption_field_bindings columns: id, pack_id, variable_name, grain_signature,
    //   value, unit, evidence_ref, evidence_type, is_override, created_at, updated_at
    const bindingResult = await db.query(
      `SELECT afb.id, afb.evidence_type, afb.evidence_ref, afb.updated_at
       FROM assumption_field_bindings afb
       JOIN assumption_packs ap ON afb.pack_id = ap.id
       WHERE ap.company_id = $1
         AND afb.variable_name = $2
       ORDER BY afb.updated_at DESC
       LIMIT 1`,
      [ctx.company_id, varName]
    );

    const binding = bindingResult.rows[0];
    const evidenceType = normalizeEvidenceType(binding?.evidence_type, binding?.evidence_ref);
    const entityId = binding?.id;

    // Check if we have existing DQI scores for this entity
    const existingScores = entityId ? existingDQIMap.get(entityId) : null;

    let sourceQualityScore: number;
    let freshnessScore: number;
    let completenessScore: number;
    let relevanceScore: number;
    let granularityScore: number;
    let consistencyScore: number;
    let traceabilityScore: number;

    if (existingScores && existingScores.overall_score > 0) {
      // Use existing manually-scored DQI dimensions
      sourceQualityScore = existingScores.source_quality_score;
      freshnessScore = existingScores.freshness_score;
      completenessScore = existingScores.completeness_score;
      relevanceScore = existingScores.relevance_score;
      granularityScore = existingScores.granularity_score;
      consistencyScore = existingScores.consistency_score;
      traceabilityScore = existingScores.traceability_score;
    } else {
      // Auto-score based on evidence type
      const baseScore = EVIDENCE_TYPE_SCORES[evidenceType];

      sourceQualityScore = baseScore;

      // Freshness: based on how recently the binding was updated
      if (binding?.updated_at) {
        const ageMs = Date.now() - new Date(binding.updated_at).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays <= 30) freshnessScore = 90;
        else if (ageDays <= 90) freshnessScore = 75;
        else if (ageDays <= 180) freshnessScore = 60;
        else if (ageDays <= 365) freshnessScore = 40;
        else freshnessScore = 20;
      } else {
        freshnessScore = 30; // No timestamp = low freshness
      }

      // Completeness: check if value exists and is non-zero
      const hasValue = binding !== undefined;
      completenessScore = hasValue ? 80 : 20;

      // Relevance: assume high if evidence type matches context
      relevanceScore = baseScore >= 75 ? 80 : 50;

      // Granularity: assume adequate if assumption exists at period level
      granularityScore = hasValue ? 70 : 30;

      // Consistency: default moderate (no conflicting sources check in auto-mode)
      consistencyScore = 65;

      // Traceability: higher for research/benchmarks, lower for estimates
      traceabilityScore = baseScore >= 75 ? 80 : 40;
    }

    // Compute weighted overall DQI score
    const overallScore = Math.round(
      sourceQualityScore * DQI_WEIGHTS.source_quality +
      freshnessScore * DQI_WEIGHTS.freshness +
      completenessScore * DQI_WEIGHTS.completeness +
      relevanceScore * DQI_WEIGHTS.relevance +
      granularityScore * DQI_WEIGHTS.granularity +
      consistencyScore * DQI_WEIGHTS.consistency +
      traceabilityScore * DQI_WEIGHTS.traceability
    );

    // EBITDA sensitivity weight (0-1, default 0.5 for variables not in tornado)
    const ebitdaWeight = sensitivityWeights[varName] ?? 0.5;

    dqiResults.push({
      variable_name: varName,
      family,
      evidence_type: evidenceType,
      source_quality_score: sourceQualityScore,
      freshness_score: freshnessScore,
      completeness_score: completenessScore,
      relevance_score: relevanceScore,
      granularity_score: granularityScore,
      consistency_score: consistencyScore,
      traceability_score: traceabilityScore,
      overall_score: overallScore,
      ebitda_sensitivity_weight: ebitdaWeight,
    });

    // Upsert DQI score to database
    // DDL: dqi_scores(dqi_score_id, entity_type, entity_id, source_quality_score, ..., overall_score, computed_at, created_at)
    if (entityId) {
      await db.query(
        `INSERT INTO dqi_scores
           (dqi_score_id, entity_type, entity_id,
            source_quality_score, freshness_score, completeness_score,
            relevance_score, granularity_score, consistency_score, traceability_score,
            overall_score, computed_at, created_at)
         VALUES ($1, 'assumption_field', $2,
                 $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT uq_dqi_scores_entity
         DO UPDATE SET
           source_quality_score = $3, freshness_score = $4, completeness_score = $5,
           relevance_score = $6, granularity_score = $7, consistency_score = $8,
           traceability_score = $9, overall_score = $10, computed_at = NOW()`,
        [
          uuidv4(), entityId,
          sourceQualityScore, freshnessScore, completenessScore,
          relevanceScore, granularityScore, consistencyScore, traceabilityScore,
          overallScore,
        ]
      );
    }

    // Upsert confidence assessment where none exists manually
    // DDL: confidence_assessments(assessment_id, company_id, entity_type, entity_id,
    //   state, numeric_score, status, rationale, evidence_count, ...)
    if (entityId && !manualScores.has(entityId)) {
      const band = mapScoreToBand(overallScore);
      const assessmentState = mapBandToState(band);

      await db.query(
        `INSERT INTO confidence_assessments
           (assessment_id, company_id, entity_type, entity_id, state, numeric_score,
            status, rationale, evidence_count, created_at, updated_at)
         VALUES ($1, $2, 'assumption_field', $3, $4, $5,
                 'active', $6, 0, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT uq_confidence_assessments_entity
         DO UPDATE SET
           state = $4, numeric_score = $5, rationale = $6, updated_at = NOW()`,
        [
          uuidv4(), ctx.company_id, entityId,
          assessmentState, overallScore,
          `Auto-scored: ${varName} (${family}) — evidence: ${evidenceType}, DQI=${overallScore}`,
        ]
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. CONFIDENCE ROLLUPS
  // ══════════════════════════════════════════════════════════════════════════

  // Group DQI results by family
  const familyGroups = new Map<string, AssumptionDQI[]>();
  for (const dqi of dqiResults) {
    const existing = familyGroups.get(dqi.family) || [];
    existing.push(dqi);
    familyGroups.set(dqi.family, existing);
  }

  // Compute per-family rollup
  const familyRollups: Array<{
    family: string;
    score: number;
    band: ConfidenceBand;
    component_count: number;
    critical_low_count: number;
    weakest: string;
    weight: number;
    lowest_critical: number;
  }> = [];

  for (const [family, members] of familyGroups.entries()) {
    const scores = members.map(m => m.overall_score);
    const weights = members.map(m => m.ebitda_sensitivity_weight);

    const familyScore = Math.round(weightedAverage(scores, weights));
    const familyBand = mapScoreToBand(familyScore);

    // Count critical-low: high sensitivity + low DQI
    const criticalLowCount = members.filter(
      m => m.ebitda_sensitivity_weight > 0.7 && m.overall_score < 50
    ).length;

    // Find weakest member
    const weakest = members.reduce((min, m) => m.overall_score < min.overall_score ? m : min, members[0]);

    // Family's aggregate sensitivity weight
    const familyWeight = Math.max(...weights, 0.1);

    // Lowest critical score in this family
    const lowestCritical = Math.min(...scores);

    familyRollups.push({
      family,
      score: familyScore,
      band: familyBand,
      component_count: members.length,
      critical_low_count: criticalLowCount,
      weakest: weakest.variable_name,
      weight: familyWeight,
      lowest_critical: lowestCritical,
    });

    // DDL: confidence_rollups(id, company_id, rollup_scope, scope_id,
    //   weighted_score, lowest_critical_score, assessment_count, computed_at)
    await db.query(
      `INSERT INTO confidence_rollups
         (id, company_id, rollup_scope, scope_id,
          weighted_score, lowest_critical_score, assessment_count, computed_at)
       VALUES ($1, $2, 'assumption_family', $3,
               $4, $5, $6, NOW())
       ON CONFLICT (company_id, rollup_scope, scope_id)
       DO UPDATE SET
         weighted_score = $4, lowest_critical_score = $5,
         assessment_count = $6, computed_at = NOW()`,
      [
        uuidv4(), ctx.company_id, family,
        familyScore, lowestCritical, members.length,
      ]
    );

    logger.info(
      {
        family,
        familyScore,
        familyBand,
        membersCount: members.length,
        criticalLowCount,
        weakestVariable: weakest.variable_name,
        weakestOverallScore: weakest.overall_score,
      },
      'Confidence family rollup computed'
    );
  }

  // ── Overall scenario confidence ───────────────────────────────────────────

  const allScores = familyRollups.map(f => f.score);
  const allWeights = familyRollups.map(f => f.weight);

  let overallConfidence = Math.round(weightedAverage(allScores, allWeights));

  // ── Critical-path penalty ─────────────────────────────────────────────────
  // If high-sensitivity assumptions have low DQI, reduce overall confidence
  const criticalPathAssumptions = dqiResults.filter(d => d.ebitda_sensitivity_weight > 0.7);
  const criticalLowDQI = criticalPathAssumptions.filter(d => d.overall_score < 50);

  let criticalPathPenalty = 0;
  if (criticalLowDQI.length > 0) {
    // Penalty = 5 points per critical-low assumption, capped at 25
    criticalPathPenalty = Math.min(criticalLowDQI.length * 5, 25);
    overallConfidence = Math.max(0, overallConfidence - criticalPathPenalty);
  }

  // ── Freshness penalty ─────────────────────────────────────────────────────
  const avgFreshness = dqiResults.length > 0
    ? dqiResults.reduce((sum, d) => sum + d.freshness_score, 0) / dqiResults.length
    : 0;
  let freshnessPenalty = 0;
  if (avgFreshness < 40) {
    freshnessPenalty = Math.round((40 - avgFreshness) / 4);
    overallConfidence = Math.max(0, overallConfidence - freshnessPenalty);
  }

  const overallBand = mapScoreToBand(overallConfidence);
  const totalCriticalLow = familyRollups.reduce((sum, f) => sum + f.critical_low_count, 0);
  const lowestOverall = familyRollups.length > 0
    ? Math.min(...familyRollups.map(f => f.lowest_critical))
    : 0;
  const weakestFamily = familyRollups.reduce(
    (min, f) => f.score < min.score ? f : min,
    familyRollups[0] ?? { family: 'none', score: 100 }
  );

  // Upsert overall scenario rollup
  await db.query(
    `INSERT INTO confidence_rollups
       (id, company_id, rollup_scope, scope_id,
        weighted_score, lowest_critical_score, assessment_count, computed_at)
     VALUES ($1, $2, 'scenario', $3,
             $4, $5, $6, NOW())
     ON CONFLICT (company_id, rollup_scope, scope_id)
     DO UPDATE SET
       weighted_score = $4, lowest_critical_score = $5,
       assessment_count = $6, computed_at = NOW()`,
    [
      uuidv4(), ctx.company_id, ctx.scenario_id,
      overallConfidence, lowestOverall, dqiResults.length,
    ]
  );

  // Store in pipeline state
  (state.financials as Record<string, Record<string, number>>)['__confidence'] = {
    overall_score: overallConfidence,
    critical_path_penalty: criticalPathPenalty,
    freshness_penalty: freshnessPenalty,
  };

  logger.info(
    {
      overallScore: overallConfidence,
      overallBand,
      criticalPathPenalty,
      freshnessPenalty,
      totalCriticalLow,
      weakestFamily: weakestFamily.family,
      weakestFamilyScore: weakestFamily.score,
    },
    'Confidence rollup complete'
  );
}
