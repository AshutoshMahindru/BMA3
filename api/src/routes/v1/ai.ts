import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import {
  asRecord,
  idSchema,
  meta,
  requestCompanyId,
  requestTenantId,
  safeNumber,
  sendError,
  stableUuidFromText,
} from './_shared';

const router = Router();

const PlanningContextSchema = z.object({
  companyId: idSchema.optional(),
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  surface: z.string().trim().min(1).max(120).optional(),
}).catchall(z.unknown());

const EditSuggestionsBody = z.object({
  context: PlanningContextSchema,
  prompt: z.string().trim().min(1),
  entityRefs: z.array(z.unknown()).optional(),
});

const AnalyzeBody = z.object({
  context: PlanningContextSchema,
  analysisType: z.string().trim().min(1),
  targetMetric: z.string().trim().min(1).optional(),
});

const ExplainBody = z.object({
  metricId: z.string().trim().min(1),
  scenarioId: idSchema,
  versionId: idSchema.optional(),
  periodRange: z.record(z.string(), z.unknown()).optional(),
});

const ResearchDraftBody = z.object({
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  researchQuestion: z.string().trim().min(1),
  context: PlanningContextSchema.optional(),
});

type PlanningContextInput = z.infer<typeof PlanningContextSchema>;

type ResolvedPlanningContext = {
  companyId: string;
  scenarioId?: string;
  versionId?: string;
  assumptionSetId?: string | null;
  governanceState: string;
  surface?: string;
};

const ADVISORY_DISCLAIMER = 'Advisory only — review and approve before applying any AI-generated suggestion.';

function advisoryMeta(extra?: Record<string, unknown>) {
  return meta({
    governanceState: 'draft',
    advisoryOnly: true,
    ...(extra || {}),
  });
}

function normalizeEntityType(entityType: string): string {
  const normalized = entityType.trim().toLowerCase().replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'plan_version':
      return 'version';
    case 'assumption':
      return 'assumption_pack';
    case 'evidence':
      return 'evidence_item';
    case 'decision_record':
      return 'decision';
    default:
      return normalized;
  }
}

async function resolvePlanningContext(req: Request, context: PlanningContextInput): Promise<ResolvedPlanningContext | null> {
  const tenantId = requestTenantId(req);
  if (!tenantId) {
    return null;
  }

  let companyId = requestCompanyId(req, context.companyId);
  let scenarioId = context.scenarioId;
  let versionId = context.versionId;
  let assumptionSetId: string | null | undefined = undefined;
  let governanceState = 'draft';

  if (versionId) {
    const version = await db.query(
      `SELECT pv.id,
              pv.company_id,
              pv.scenario_id,
              pv.assumption_set_id,
              pv.status,
              pv.is_frozen
         FROM plan_versions pv
         JOIN companies c
           ON c.id = pv.company_id
        WHERE pv.id::text = $1
          AND c.tenant_id::text = $2
          AND pv.is_deleted = FALSE
          AND c.is_deleted = FALSE`,
      [versionId, tenantId],
    );

    if (Number(version.rowCount || 0) > 0) {
      const row = version.rows[0];
      companyId = String(row.company_id);
      scenarioId = scenarioId || String(row.scenario_id);
      assumptionSetId = row.assumption_set_id ? String(row.assumption_set_id) : null;
      governanceState = row.is_frozen ? 'frozen' : String(row.status || 'draft');
    }
  }

  if (!companyId && scenarioId) {
    const scenario = await db.query(
      `SELECT s.id, s.company_id
         FROM scenarios s
         JOIN companies c
           ON c.id = s.company_id
        WHERE s.id::text = $1
          AND c.tenant_id::text = $2
          AND s.is_deleted = FALSE
          AND c.is_deleted = FALSE`,
      [scenarioId, tenantId],
    );

    if (Number(scenario.rowCount || 0) > 0) {
      companyId = String(scenario.rows[0].company_id);
    }
  }

  if (!companyId) {
    return null;
  }

  const company = await db.query(
    `SELECT id
       FROM companies
      WHERE id::text = $1
        AND tenant_id::text = $2
        AND is_deleted = FALSE`,
    [companyId, tenantId],
  );

  if (Number(company.rowCount || 0) === 0) {
    return null;
  }

  return {
    companyId,
    ...(scenarioId ? { scenarioId } : {}),
    ...(versionId ? { versionId } : {}),
    ...(assumptionSetId !== undefined ? { assumptionSetId } : {}),
    governanceState,
    ...(context.surface ? { surface: context.surface } : {}),
  };
}

function promptDirection(prompt: string): number {
  const normalized = prompt.toLowerCase();
  if (/(reduce|lower|decrease|downside|conservative|cut)/.test(normalized)) return -1;
  if (/(increase|raise|expand|growth|upside|aggressive|scale)/.test(normalized)) return 1;
  return 0;
}

function suggestionMagnitude(variableName: string, prompt: string, index: number): number {
  const normalizedVariable = variableName.toLowerCase();
  let magnitude = 0.04 + (index % 3) * 0.015;

  if (/(price|revenue|take_rate|retention|conversion)/.test(normalizedVariable)) {
    magnitude += 0.02;
  }
  if (/(cost|waste|discount|churn|refund)/.test(normalizedVariable)) {
    magnitude += 0.015;
  }
  if (/high confidence|confident|validated/.test(prompt.toLowerCase())) {
    magnitude -= 0.01;
  }

  return Math.min(Math.max(magnitude, 0.03), 0.14);
}

function roundValue(value: number): number {
  return Number(value.toFixed(4));
}

function suggestionConfidence(evidenceRef: string, currentValue: number): string {
  if (evidenceRef && evidenceRef.trim().length > 0) return 'medium';
  return Math.abs(currentValue) > 0 ? 'low' : 'estimated';
}

function suggestionRationale(variableName: string, family: string, prompt: string, surface?: string): string {
  const surfaceNote = surface ? ` on ${surface}` : '';
  const trimmedPrompt = prompt.trim().replace(/\s+/g, ' ');
  return `Suggested ${variableName} adjustment for ${family}${surfaceNote} based on prompt: "${trimmedPrompt}".`;
}

function deriveSuggestedValue(currentValue: number, direction: number, magnitude: number, index: number): number {
  if (currentValue === 0) {
    return roundValue((direction === 0 ? 1 : direction) * (index + 1) * 0.5);
  }

  if (direction === 0) {
    const multiplier = index % 2 === 0 ? 1 + magnitude : 1 - magnitude;
    return roundValue(currentValue * multiplier);
  }

  return roundValue(currentValue * (1 + direction * magnitude));
}

async function resolveEntityCompanyId(
  req: Request,
  entityType: string,
  entityId: string,
  fallbackCompanyId?: string,
): Promise<string | null> {
  if (fallbackCompanyId) {
    return fallbackCompanyId;
  }

  const tenantId = requestTenantId(req);
  if (!tenantId) {
    return null;
  }

  const normalized = normalizeEntityType(entityType);
  const resolvers: Record<string, string> = {
    company: `SELECT id AS company_id FROM companies WHERE id::text = $1 AND tenant_id::text = $2 AND is_deleted = FALSE`,
    scenario: `SELECT s.company_id
                 FROM scenarios s
                 JOIN companies c ON c.id = s.company_id
                WHERE s.id::text = $1
                  AND c.tenant_id::text = $2
                  AND s.is_deleted = FALSE
                  AND c.is_deleted = FALSE`,
    version: `SELECT pv.company_id
                FROM plan_versions pv
                JOIN companies c ON c.id = pv.company_id
               WHERE pv.id::text = $1
                 AND c.tenant_id::text = $2
                 AND pv.is_deleted = FALSE
                 AND c.is_deleted = FALSE`,
    decision: `SELECT dr.company_id
                 FROM decision_records dr
                 JOIN companies c ON c.id = dr.company_id
                WHERE dr.id::text = $1
                  AND c.tenant_id::text = $2`,
    assumption_pack: `SELECT ap.company_id
                        FROM assumption_packs ap
                        JOIN companies c ON c.id = ap.company_id
                       WHERE ap.id::text = $1
                         AND c.tenant_id::text = $2
                         AND ap.is_deleted = FALSE
                         AND c.is_deleted = FALSE`,
    evidence_item: `SELECT ei.company_id
                      FROM evidence_items ei
                      JOIN companies c ON c.id = ei.company_id
                     WHERE ei.evidence_id::text = $1
                       AND c.tenant_id::text = $2
                       AND c.is_deleted = FALSE`,
    research_task: `SELECT rt.company_id
                      FROM research_tasks rt
                      JOIN companies c ON c.id = rt.company_id
                     WHERE rt.id::text = $1
                       AND c.tenant_id::text = $2
                       AND c.is_deleted = FALSE`,
  };

  const sql = resolvers[normalized];
  if (!sql) {
    return null;
  }

  const result = await db.query(sql, [entityId, tenantId]);
  return result.rows[0]?.company_id ? String(result.rows[0].company_id) : null;
}

router.post('/edit-suggestions', validate(EditSuggestionsBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof EditSuggestionsBody>;
    const planning = await resolvePlanningContext(req, body.context);

    if (!planning) {
      return sendError(res, req, 400, 'MISSING_PLANNING_CONTEXT', 'companyId, scenarioId, or versionId is required for AI suggestions');
    }

    const bindings = await db.query(
      `SELECT afb.id,
              afb.variable_name,
              COALESCE(afb.value, 0)::float8 AS current_value,
              COALESCE(afb.unit, 'unitless') AS unit,
              COALESCE(afb.evidence_ref, '') AS evidence_ref,
              COALESCE(ap.family::text, 'general') AS family,
              COALESCE(ap.name, 'Assumption pack') AS pack_name
         FROM assumption_field_bindings afb
         JOIN assumption_packs ap
           ON ap.id = afb.pack_id
         LEFT JOIN assumption_pack_bindings apb
           ON apb.pack_id = ap.id
        WHERE ap.company_id::text = $1
          AND ap.is_deleted = FALSE
          AND ($2::text IS NULL OR apb.assumption_set_id::text = $2)
        ORDER BY ap.updated_at DESC NULLS LAST, afb.updated_at DESC NULLS LAST
        LIMIT 8`,
      [planning.companyId, planning.assumptionSetId || null],
    );

    const direction = promptDirection(body.prompt);
    const suggestions = (bindings.rows as Array<any>).map((row, index) => {
      const currentValue = safeNumber(row.current_value);
      const magnitude = suggestionMagnitude(String(row.variable_name || ''), body.prompt, index);

      return {
        fieldId: row.id || stableUuidFromText(`${planning.companyId}:${row.variable_name}:${index}`),
        currentValue,
        suggestedValue: deriveSuggestedValue(currentValue, direction, magnitude, index),
        rationale: suggestionRationale(
          String(row.variable_name || 'assumption'),
          String(row.family || row.pack_name || 'assumptions'),
          body.prompt,
          planning.surface,
        ),
        confidence: suggestionConfidence(String(row.evidence_ref || ''), currentValue),
      };
    });

    res.json({
      data: {
        suggestions,
        draftOnly: true,
        disclaimer: ADVISORY_DISCLAIMER,
      },
      meta: advisoryMeta({
        companyId: planning.companyId,
        ...(planning.scenarioId ? { scenarioId: planning.scenarioId } : {}),
        ...(planning.versionId ? { versionId: planning.versionId } : {}),
        governanceState: planning.governanceState,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/analyze', validate(AnalyzeBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof AnalyzeBody>;
    const planning = await resolvePlanningContext(req, body.context);

    if (!planning) {
      return sendError(res, req, 400, 'MISSING_PLANNING_CONTEXT', 'companyId, scenarioId, or versionId is required for AI analysis');
    }

    const params: unknown[] = [planning.companyId];
    let idx = 2;
    let runFilters = '';
    let driverFilters = '';

    if (planning.scenarioId) {
      runFilters += ` AND scenario_id::text = $${idx}`;
      driverFilters += ` AND de.scenario_id::text = $${idx}`;
      params.push(planning.scenarioId);
      idx += 1;
    }

    if (planning.versionId) {
      runFilters += ` AND version_id::text = $${idx}`;
      driverFilters += ` AND de.version_id::text = $${idx}`;
      params.push(planning.versionId);
      idx += 1;
    }

    const targetMetric = body.targetMetric || 'EBITDA';
    const driverParams = [...params, targetMetric];

    const [latestRun, confidence, drivers, tasks] = await Promise.all([
      db.query(
        `SELECT id, status, completed_at, metadata
           FROM compute_runs
          WHERE company_id::text = $1
            ${runFilters}
          ORDER BY created_at DESC
          LIMIT 1`,
        params,
      ),
      db.query(
        `SELECT rollup_scope,
                COALESCE(AVG(weighted_score), 0)::float8 AS avg_score,
                COUNT(*)::int AS assessment_count,
                COALESCE(MIN(lowest_critical_score), 0)::float8 AS critical_floor
           FROM confidence_rollups
          WHERE company_id::text = $1
          GROUP BY rollup_scope
          ORDER BY avg_score ASC, assessment_count DESC
          LIMIT 4`,
        [planning.companyId],
      ),
      db.query(
        `SELECT de.driver_name,
                COALESCE(de.contribution_value, de.impact_amount, 0)::float8 AS contribution_value
           FROM driver_explainability de
          WHERE de.company_id::text = $1
            ${driverFilters}
            AND de.target_metric ILIKE $${driverParams.length}
          ORDER BY ABS(COALESCE(de.contribution_value, de.impact_amount, 0)) DESC, de.created_at ASC
          LIMIT 3`,
        driverParams,
      ),
      db.query(
        `SELECT COUNT(*)::int AS open_count
           FROM research_tasks
          WHERE company_id::text = $1
            AND status = 'open'`,
        [planning.companyId],
      ),
    ]);

    const insights: Array<{
      title: string;
      description: string;
      severity: string;
      relatedEntities: unknown[];
    }> = [];

    const caveats: string[] = [];
    const latestRunRow = latestRun.rows[0];
    if (latestRunRow) {
      insights.push({
        title: `Latest compute run is ${String(latestRunRow.status || 'unknown')}`,
        description: latestRunRow.completed_at
          ? `Most recent compute cycle finished at ${new Date(latestRunRow.completed_at).toISOString()}.`
          : 'A compute run has been queued or is still in progress.',
        severity: ['failed', 'cancelled'].includes(String(latestRunRow.status)) ? 'high' : 'low',
        relatedEntities: [latestRunRow.id],
      });
    } else {
      caveats.push('No compute runs were found for the selected planning context.');
    }

    const confidenceRows = confidence.rows as Array<any>;
    if (confidenceRows.length > 0) {
      const weakest = confidenceRows[0];
      insights.push({
        title: `${String(weakest.rollup_scope || 'overall')} confidence is constraining analysis`,
        description: `Average weighted score is ${roundValue(safeNumber(weakest.avg_score))} with a critical floor of ${roundValue(safeNumber(weakest.critical_floor))}.`,
        severity: safeNumber(weakest.avg_score) < 60 ? 'medium' : 'low',
        relatedEntities: [weakest.rollup_scope],
      });
    } else {
      caveats.push('Confidence rollups are not yet populated for this company.');
    }

    const driverRows = drivers.rows as Array<any>;
    if (driverRows.length > 0) {
      const leader = driverRows[0];
      insights.push({
        title: `${targetMetric} is most exposed to ${String(leader.driver_name || 'upstream drivers')}`,
        description: `${body.analysisType} surfaced ${String(leader.driver_name || 'a leading driver')} as the dominant contributor (${roundValue(safeNumber(leader.contribution_value))}).`,
        severity: body.analysisType === 'anomaly_detection' ? 'medium' : 'low',
        relatedEntities: driverRows.map((row) => row.driver_name),
      });
    } else {
      caveats.push(`No explainability records were found for ${targetMetric}.`);
    }

    const openTaskCount = safeNumber(tasks.rows[0]?.open_count);
    if (openTaskCount > 0 && body.analysisType === 'recommendation') {
      insights.push({
        title: 'Research backlog should be cleared before relying on recommendations',
        description: `${openTaskCount} open research task(s) are still unresolved in this planning context.`,
        severity: openTaskCount > 3 ? 'high' : 'medium',
        relatedEntities: ['research_tasks'],
      });
    }

    const averageConfidence = confidenceRows.length
      ? confidenceRows.reduce((sum, row) => sum + safeNumber(row.avg_score), 0) / confidenceRows.length
      : 0;

    const confidenceNote = averageConfidence >= 80
      ? 'Advisory confidence is strong because recent runs and confidence rollups are broadly aligned.'
      : averageConfidence >= 60
        ? 'Advisory confidence is moderate; review weak rollup scopes before acting.'
        : 'Advisory confidence is limited; treat the insights as a planning prompt, not a decision gate.';

    res.json({
      data: {
        insights,
        caveats,
        confidenceNote,
      },
      meta: advisoryMeta({
        companyId: planning.companyId,
        ...(planning.scenarioId ? { scenarioId: planning.scenarioId } : {}),
        ...(planning.versionId ? { versionId: planning.versionId } : {}),
        governanceState: planning.governanceState,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/explain', validate(ExplainBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof ExplainBody>;
    const planning = await resolvePlanningContext(req, {
      scenarioId: body.scenarioId,
      versionId: body.versionId,
    });

    if (!planning) {
      return sendError(res, req, 400, 'MISSING_PLANNING_CONTEXT', 'scenarioId is required for AI explainability');
    }

    const periodRange = asRecord(body.periodRange);
    const requestedPeriodId = typeof periodRange.periodId === 'string'
      ? periodRange.periodId
      : typeof periodRange.planningPeriodId === 'string'
        ? periodRange.planningPeriodId
        : undefined;

    const params: unknown[] = [planning.companyId, body.scenarioId, body.metricId];
    let idx = 4;
    let clauses = '';

    if (body.versionId) {
      clauses += ` AND de.version_id::text = $${idx++}`;
      params.push(body.versionId);
    }
    if (requestedPeriodId) {
      clauses += ` AND de.planning_period_id::text = $${idx++}`;
      params.push(requestedPeriodId);
    }

    const result = await db.query(
      `SELECT de.id,
              de.driver_name,
              COALESCE(de.contribution_value, de.impact_amount, 0)::float8 AS contribution_value,
              COALESCE(de.contribution_pct, 0)::float8 AS contribution_pct
         FROM driver_explainability de
        WHERE de.company_id::text = $1
          AND de.scenario_id::text = $2
          AND de.target_metric ILIKE $3
          ${clauses}
        ORDER BY ABS(COALESCE(de.contribution_value, de.impact_amount, 0)) DESC, de.created_at ASC
        LIMIT 6`,
      params,
    );

    const rows = result.rows as Array<any>;
    const drivers = rows.map((row) => ({
      name: String(row.driver_name || 'Driver'),
      contribution: roundValue(safeNumber(row.contribution_value)),
      description: safeNumber(row.contribution_pct)
        ? `${roundValue(safeNumber(row.contribution_pct))}% of observed movement`
        : 'Contribution estimated from stored explainability records',
    }));

    const caveats: string[] = [ADVISORY_DISCLAIMER];
    if (rows.length === 0) {
      caveats.push(`No driver explainability records were found for ${body.metricId}.`);
    }
    if (body.periodRange && !requestedPeriodId) {
      caveats.push('A period range was supplied without a canonical planningPeriodId, so the explanation covers the available stored records.');
    }

    const explanation = rows.length > 0
      ? `${body.metricId} is primarily driven by ${drivers.slice(0, 3).map((driver) => `${driver.name} (${driver.contribution})`).join(', ')}.`
      : `${body.metricId} does not yet have stored explainability drivers for the selected scenario, so no causal bridge can be surfaced from model data.`;

    res.json({
      data: {
        explanation,
        drivers,
        caveats,
      },
      meta: advisoryMeta({
        companyId: planning.companyId,
        scenarioId: body.scenarioId,
        ...(body.versionId ? { versionId: body.versionId } : {}),
        governanceState: planning.governanceState,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/research-draft', validate(ResearchDraftBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof ResearchDraftBody>;
    const planning = body.context ? await resolvePlanningContext(req, body.context) : null;
    const companyId = await resolveEntityCompanyId(req, body.entityType, body.entityId, planning?.companyId);

    if (!companyId) {
      return sendError(res, req, 400, 'VALIDATION_ERROR', `Unable to resolve company context for ${body.entityType} ${body.entityId}`);
    }

    const normalizedEntityType = normalizeEntityType(body.entityType);
    const [evidence, tasks] = await Promise.all([
      db.query(
        `SELECT ei.title,
                ei.source_url,
                ei.source_type,
                ei.source_name,
                ei.metadata
           FROM evidence_items ei
           LEFT JOIN evidence_links el
             ON el.evidence_id = ei.evidence_id
          WHERE ei.company_id::text = $1
            AND (
              (el.entity_type = $2 AND el.entity_id::text = $3)
              OR ei.title ILIKE $4
              OR COALESCE(ei.source_name, '') ILIKE $4
            )
          ORDER BY ei.created_at DESC
          LIMIT 5`,
        [companyId, normalizedEntityType, body.entityId, `%${body.researchQuestion}%`],
      ),
      db.query(
        `SELECT title, status, description
           FROM research_tasks
          WHERE company_id::text = $1
            AND entity_type = $2
            AND entity_id::text = $3
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 3`,
        [companyId, normalizedEntityType, body.entityId],
      ),
    ]);

    const suggestedEvidence = (evidence.rows as Array<any>).map((row) => {
      const metadata = asRecord(row.metadata);
      return {
        title: String(row.title || 'Evidence item'),
        snippet: String(
          metadata.description
          || row.source_name
          || row.source_type
          || 'Existing evidence can inform the research draft.',
        ),
        sourceUrl: String(row.source_url || ''),
      };
    });

    const openTasks = (tasks.rows as Array<any>).filter((row) => String(row.status || '').toLowerCase() === 'open');
    const draftSections = [
      `Research draft for ${normalizedEntityType} ${body.entityId}.`,
      `Question: ${body.researchQuestion}.`,
      suggestedEvidence.length > 0
        ? `Existing evidence themes: ${suggestedEvidence.map((item) => item.title).join('; ')}.`
        : 'No linked evidence was found, so this draft highlights the need for first-pass source collection.',
      openTasks.length > 0
        ? `Open research tasks already linked here: ${openTasks.map((task) => task.title).join('; ')}.`
        : 'No open research tasks are currently linked to this entity.',
      'Recommended next step: verify the cited evidence directly, then convert confirmed findings into a governed research note.',
    ];

    res.json({
      data: {
        draftNote: draftSections.join(' '),
        suggestedEvidence,
        draftOnly: true,
      },
      meta: advisoryMeta({
        companyId,
        ...(planning?.scenarioId ? { scenarioId: planning.scenarioId } : {}),
        ...(planning?.versionId ? { versionId: planning.versionId } : {}),
      }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
