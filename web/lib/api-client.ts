// Generated from specos/artifacts/api_contracts.json
// DO NOT EDIT — regenerate from SpecOS artifacts

import type {
  ResponseMeta,
  ApiResult,
  CreateAiAnalyzeRequest,
  CreateAiEditSuggestionsRequest,
  CreateAiExplainRequest,
  CreateAiResearchDraftRequest,
  CreateAnalysisComparisonsRequest,
  CreateAnalysisSimulationRunsRequest,
  CreateAssumptionsOverridesRequest,
  CreateAssumptionsPacksApplyRequest,
  CreateAssumptionsPacksRequest,
  CreateAssumptionsSetsRequest,
  CreateComputeRunsCancelRequest,
  CreateComputeRunsRequest,
  CreateComputeValidationsRequest,
  CreateConfidenceAssessmentsRequest,
  CreateConfidenceDqiRequest,
  CreateConfidenceEvidenceRequest,
  CreateConfidenceResearchTasksRequest,
  CreateContextCompaniesCalendarsRequest,
  CreateContextCompaniesRequest,
  CreateContextScenariosCloneRequest,
  CreateContextScenariosRequest,
  CreateContextVersionsFreezeRequest,
  CreateContextVersionsPublishRequest,
  CreateContextVersionsRequest,
  CreateDecisionsLinksRequest,
  CreateDecisionsMarketingRequest,
  CreateDecisionsMarketsRequest,
  CreateDecisionsMarketsSequenceRequest,
  CreateDecisionsOperationsRequest,
  CreateDecisionsProductsRequest,
  CreateDecisionsRationaleRequest,
  CreateGovernanceApprovalWorkflowsApproveRequest,
  CreateGovernanceApprovalWorkflowsRejectRequest,
  CreateGovernanceApprovalWorkflowsSubmitRequest,
  CreateGovernanceDecisionMemoryRequest,
  CreateGovernancePublicationPublishRequest,
  CreateGovernancePublicationUnpublishRequest,
  CreateScopeBundlesApplyRequest,
  CreateScopeBundlesRequest,
  CreateScopeReviewValidateRequest,
  UpdateAssumptionsSetsByIdRequest,
  UpdateConfidenceAssessmentsByIdRequest,
  UpdateConfidenceResearchTasksByIdRequest,
  UpdateContextCompaniesByIdRequest,
  UpdateContextScenariosByIdRequest,
  UpdateDecisionsMarketingByIdRequest,
  UpdateDecisionsMarketsByIdRequest,
  UpdateDecisionsOperationsByIdRequest,
  UpdateDecisionsProductsByIdRequest,
  UpdateScopeBundlesByIdRequest,
  UpsertAssumptionsCostBulkRequest,
  UpsertAssumptionsDemandBulkRequest,
  UpsertAssumptionsFundingBulkRequest,
  UpsertAssumptionsWorkingCapitalBulkRequest,
} from "./types/api";

// ─────────────────────────────────────────────────────────────────────
// Core request infrastructure
// Preserves existing pattern from web/lib/api.ts:
//   - Never throws; always returns { data, meta, error }
//   - Timeout via AbortController
//   - x-tenant-id header injected on every request
// ─────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'tttttttt-0000-0000-0000-000000000001';
const TIMEOUT_MS = 8000;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | undefined>
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let url = `${API_BASE}${path}`;
  if (queryParams) {
    const qs = Object.entries(queryParams)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { data: null, error: errBody?.error?.message || `HTTP ${res.status}` };
    }

    const json = await res.json();
    return { data: (json.data ?? json) as T, meta: json.meta, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    return {
      data: null,
      error: e.name === 'AbortError' ? 'Timeout' : (e.message || 'Network error'),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/context/companies — List all companies the user has access to */
export const getContextCompanies = (params?: { status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ companyId: string, name: string, status: string, createdAt: string }>>> =>
  request<Array<{ companyId: string, name: string, status: string, createdAt: string }>>('GET', '/context/companies', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/context/companies — Create a new company record */
export const createContextCompanies = (body: CreateContextCompaniesRequest): Promise<ApiResult<{ companyId: string, name: string, status: string, createdAt: string }>> =>
  request<{ companyId: string, name: string, status: string, createdAt: string }>('POST', '/context/companies', body);

/** GET /api/v1/context/companies/:companyId — Retrieve a single company by ID */
export const getContextCompaniesById = (companyId: string): Promise<ApiResult<{ companyId: string, name: string, industry: string, baseCurrency: string, fiscalYearStart: number, status: string, createdAt: string, updatedAt: string }>> =>
  request<{ companyId: string, name: string, industry: string, baseCurrency: string, fiscalYearStart: number, status: string, createdAt: string, updatedAt: string }>('GET', `/context/companies/${companyId}`);

/** PATCH /api/v1/context/companies/:companyId — Update company details */
export const updateContextCompaniesById = (companyId: string, body: UpdateContextCompaniesByIdRequest): Promise<ApiResult<{ companyId: string, name: string, updatedAt: string }>> =>
  request<{ companyId: string, name: string, updatedAt: string }>('PATCH', `/context/companies/${companyId}`, body);

/** GET /api/v1/context/companies/:companyId/calendars — List planning calendars for a company */
export const getContextCompaniesCalendars = (companyId: string, params?: { limit?: number; offset?: number }): Promise<ApiResult<Array<{ calendarId: string, name: string, fiscalYearStart: number, periodGranularity: string, periods: unknown[] }>>> =>
  request<Array<{ calendarId: string, name: string, fiscalYearStart: number, periodGranularity: string, periods: unknown[] }>>('GET', `/context/companies/${companyId}/calendars`, params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/context/companies/:companyId/calendars — Create a planning calendar for a company */
export const createContextCompaniesCalendars = (companyId: string, body: CreateContextCompaniesCalendarsRequest): Promise<ApiResult<{ calendarId: string, name: string, createdAt: string }>> =>
  request<{ calendarId: string, name: string, createdAt: string }>('POST', `/context/companies/${companyId}/calendars`, body);

/** GET /api/v1/context/planning-periods — List planning periods for the selected calendar */
export const getContextPlanningPeriods = (params?: { companyId: string; calendarId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ periodId: string, label: string, startDate: string, endDate: string, granularity: string }>>> =>
  request<Array<{ periodId: string, label: string, startDate: string, endDate: string, granularity: string }>>('GET', '/context/planning-periods', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/context/scenarios — List scenarios for a company */
export const getContextScenarios = (params?: { companyId: string; status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ scenarioId: string, name: string, status: string, createdAt: string, latestVersionId: string }>>> =>
  request<Array<{ scenarioId: string, name: string, status: string, createdAt: string, latestVersionId: string }>>('GET', '/context/scenarios', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/context/scenarios — Create a new scenario */
export const createContextScenarios = (body: CreateContextScenariosRequest): Promise<ApiResult<{ scenarioId: string, name: string, status: string, createdAt: string }>> =>
  request<{ scenarioId: string, name: string, status: string, createdAt: string }>('POST', '/context/scenarios', body);

/** POST /api/v1/context/scenarios/:scenarioId/clone — Clone a scenario into a new draft */
export const cloneContextScenarios = (scenarioId: string, body: CreateContextScenariosCloneRequest): Promise<ApiResult<{ scenarioId: string, name: string, clonedFrom: string, status: string }>> =>
  request<{ scenarioId: string, name: string, clonedFrom: string, status: string }>('POST', `/context/scenarios/${scenarioId}/clone`, body);

/** PATCH /api/v1/context/scenarios/:scenarioId — Update scenario metadata */
export const updateContextScenariosById = (scenarioId: string, body: UpdateContextScenariosByIdRequest): Promise<ApiResult<{ scenarioId: string, name: string, updatedAt: string }>> =>
  request<{ scenarioId: string, name: string, updatedAt: string }>('PATCH', `/context/scenarios/${scenarioId}`, body);

/** GET /api/v1/context/versions — List plan versions for a scenario */
export const getContextVersions = (params?: { companyId: string; scenarioId: string; status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ versionId: string, label: string, status: string, governanceState: string, createdAt: string }>>> =>
  request<Array<{ versionId: string, label: string, status: string, governanceState: string, createdAt: string }>>('GET', '/context/versions', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/context/versions — Create a new plan version under a scenario */
export const createContextVersions = (body: CreateContextVersionsRequest): Promise<ApiResult<{ versionId: string, label: string, governanceState: string, createdAt: string }>> =>
  request<{ versionId: string, label: string, governanceState: string, createdAt: string }>('POST', '/context/versions', body);

/** GET /api/v1/context/versions/:versionId — Retrieve a single plan version */
export const getContextVersionsById = (versionId: string): Promise<ApiResult<{ versionId: string, label: string, scenarioId: string, governanceState: string, createdAt: string, publishedAt: string, frozenAt: string }>> =>
  request<{ versionId: string, label: string, scenarioId: string, governanceState: string, createdAt: string, publishedAt: string, frozenAt: string }>('GET', `/context/versions/${versionId}`);

/** POST /api/v1/context/versions/:versionId/freeze — Freeze a version to prevent edits */
export const freezeContextVersions = (versionId: string, body: CreateContextVersionsFreezeRequest): Promise<ApiResult<{ versionId: string, governanceState: string, frozenAt: string }>> =>
  request<{ versionId: string, governanceState: string, frozenAt: string }>('POST', `/context/versions/${versionId}/freeze`, body);

/** POST /api/v1/context/versions/:versionId/publish — Publish a version for stakeholder visibility */
export const publishContextVersions = (versionId: string, body: CreateContextVersionsPublishRequest): Promise<ApiResult<{ versionId: string, governanceState: string, publishedAt: string }>> =>
  request<{ versionId: string, governanceState: string, publishedAt: string }>('POST', `/context/versions/${versionId}/publish`, body);

/** GET /api/v1/context/overview — Read-model for shell state, headline KPIs, alerts, and quick links */
export const getContextOverview = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string }): Promise<ApiResult<{ company: Record<string, unknown>, activeScenario: Record<string, unknown>, activeVersion: Record<string, unknown>, headlineKpis: Record<string, unknown>, alerts: unknown[], quickLinks: unknown[] }>> =>
  request<{ company: Record<string, unknown>, activeScenario: Record<string, unknown>, activeVersion: Record<string, unknown>, headlineKpis: Record<string, unknown>, alerts: unknown[], quickLinks: unknown[] }>('GET', '/context/overview', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// SCOPE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/scope/bundles — List scope bundles for the planning context */
export const getScopeBundles = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ scopeBundleId: string, name: string, status: string, dimensionCount: number }>>> =>
  request<Array<{ scopeBundleId: string, name: string, status: string, dimensionCount: number }>>('GET', '/scope/bundles', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/scope/bundles — Create a new scope bundle */
export const createScopeBundles = (body: CreateScopeBundlesRequest): Promise<ApiResult<{ scopeBundleId: string, name: string, status: string, createdAt: string }>> =>
  request<{ scopeBundleId: string, name: string, status: string, createdAt: string }>('POST', '/scope/bundles', body);

/** GET /api/v1/scope/bundles/:scopeBundleId — Retrieve a single scope bundle */
export const getScopeBundlesById = (scopeBundleId: string): Promise<ApiResult<{ scopeBundleId: string, name: string, items: unknown[], createdAt: string, updatedAt: string }>> =>
  request<{ scopeBundleId: string, name: string, items: unknown[], createdAt: string, updatedAt: string }>('GET', `/scope/bundles/${scopeBundleId}`);

/** PATCH /api/v1/scope/bundles/:scopeBundleId — Update a scope bundle */
export const updateScopeBundlesById = (scopeBundleId: string, body: UpdateScopeBundlesByIdRequest): Promise<ApiResult<{ scopeBundleId: string, name: string, updatedAt: string }>> =>
  request<{ scopeBundleId: string, name: string, updatedAt: string }>('PATCH', `/scope/bundles/${scopeBundleId}`, body);

/** POST /api/v1/scope/bundles/:scopeBundleId/apply — Apply a scope bundle to the selected scenario/version */
export const applyScopeBundles = (scopeBundleId: string, body: CreateScopeBundlesApplyRequest): Promise<ApiResult<{ applied: boolean, affectedEntities: number }>> =>
  request<{ applied: boolean, affectedEntities: number }>('POST', `/scope/bundles/${scopeBundleId}/apply`, body);

/** GET /api/v1/scope/formats — List available format dimension nodes */
export const getScopeFormats = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number }>>('GET', '/scope/formats', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/scope/categories — List available category dimension nodes */
export const getScopeCategories = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number }>>('GET', '/scope/categories', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/scope/portfolio-nodes — List portfolio hierarchy nodes */
export const getScopePortfolioNodes = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number, nodeType: string }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number, nodeType: string }>>('GET', '/scope/portfolio-nodes', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/scope/channels — List available channel dimension nodes */
export const getScopeChannels = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, channelType: string }>>> =>
  request<Array<{ nodeId: string, name: string, channelType: string }>>('GET', '/scope/channels', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/scope/operating-models — List available operating model dimension nodes */
export const getScopeOperatingModels = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, modelType: string }>>> =>
  request<Array<{ nodeId: string, name: string, modelType: string }>>('GET', '/scope/operating-models', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/scope/geographies — List available geography dimension nodes */
export const getScopeGeographies = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number, isoCode: string }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number, isoCode: string }>>('GET', '/scope/geographies', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/scope/review/validate — Validate the current scope bundle for completeness */
export const validateScopeReview = (body: CreateScopeReviewValidateRequest): Promise<ApiResult<{ valid: boolean, issues: unknown[] }>> =>
  request<{ valid: boolean, issues: unknown[] }>('POST', '/scope/review/validate', body);

/** GET /api/v1/scope/review/summary — Get summary of current scope selection state */
export const getScopeReviewSummary = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ totalNodes: number, includedNodes: number, excludedNodes: number, dimensionBreakdown: Record<string, unknown>, warnings: unknown[] }>> =>
  request<{ totalNodes: number, includedNodes: number, excludedNodes: number, dimensionBreakdown: Record<string, unknown>, warnings: unknown[] }>('GET', '/scope/review/summary', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// DECISIONS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/decisions/products — List products decisions for current context */
export const getDecisionsProducts = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>> =>
  request<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>('GET', '/decisions/products', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/decisions/products — Create a new product decision */
export const createDecisionsProducts = (body: CreateDecisionsProductsRequest): Promise<ApiResult<{ decisionId: string, title: string, status: string, createdAt: string }>> =>
  request<{ decisionId: string, title: string, status: string, createdAt: string }>('POST', '/decisions/products', body);

/** PATCH /api/v1/decisions/products/:decisionId — Update a product decision */
export const updateDecisionsProductsById = (decisionId: string, body: UpdateDecisionsProductsByIdRequest): Promise<ApiResult<{ decisionId: string, title: string, updatedAt: string }>> =>
  request<{ decisionId: string, title: string, updatedAt: string }>('PATCH', `/decisions/products/${decisionId}`, body);

/** GET /api/v1/decisions/markets — List markets decisions for current context */
export const getDecisionsMarkets = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>> =>
  request<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>('GET', '/decisions/markets', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/decisions/markets — Create a new market decision */
export const createDecisionsMarkets = (body: CreateDecisionsMarketsRequest): Promise<ApiResult<{ decisionId: string, title: string, status: string, createdAt: string }>> =>
  request<{ decisionId: string, title: string, status: string, createdAt: string }>('POST', '/decisions/markets', body);

/** PATCH /api/v1/decisions/markets/:decisionId — Update a market decision */
export const updateDecisionsMarketsById = (decisionId: string, body: UpdateDecisionsMarketsByIdRequest): Promise<ApiResult<{ decisionId: string, title: string, updatedAt: string }>> =>
  request<{ decisionId: string, title: string, updatedAt: string }>('PATCH', `/decisions/markets/${decisionId}`, body);

/** GET /api/v1/decisions/marketing — List marketing decisions for current context */
export const getDecisionsMarketing = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>> =>
  request<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>('GET', '/decisions/marketing', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/decisions/marketing — Create a new marketing decision */
export const createDecisionsMarketing = (body: CreateDecisionsMarketingRequest): Promise<ApiResult<{ decisionId: string, title: string, status: string, createdAt: string }>> =>
  request<{ decisionId: string, title: string, status: string, createdAt: string }>('POST', '/decisions/marketing', body);

/** PATCH /api/v1/decisions/marketing/:decisionId — Update a marketing decision */
export const updateDecisionsMarketingById = (decisionId: string, body: UpdateDecisionsMarketingByIdRequest): Promise<ApiResult<{ decisionId: string, title: string, updatedAt: string }>> =>
  request<{ decisionId: string, title: string, updatedAt: string }>('PATCH', `/decisions/marketing/${decisionId}`, body);

/** GET /api/v1/decisions/operations — List operations decisions for current context */
export const getDecisionsOperations = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>> =>
  request<Array<{ decisionId: string, title: string, status: string, effectivePeriod: string, owner: string, createdAt: string }>>('GET', '/decisions/operations', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/decisions/operations — Create a new operation decision */
export const createDecisionsOperations = (body: CreateDecisionsOperationsRequest): Promise<ApiResult<{ decisionId: string, title: string, status: string, createdAt: string }>> =>
  request<{ decisionId: string, title: string, status: string, createdAt: string }>('POST', '/decisions/operations', body);

/** PATCH /api/v1/decisions/operations/:decisionId — Update a operation decision */
export const updateDecisionsOperationsById = (decisionId: string, body: UpdateDecisionsOperationsByIdRequest): Promise<ApiResult<{ decisionId: string, title: string, updatedAt: string }>> =>
  request<{ decisionId: string, title: string, updatedAt: string }>('PATCH', `/decisions/operations/${decisionId}`, body);

/** POST /api/v1/decisions/markets/:decisionId/sequence — Set market rollout sequencing position for a decision */
export const sequenceDecisionsMarkets = (decisionId: string, body: CreateDecisionsMarketsSequenceRequest): Promise<ApiResult<{ decisionId: string, sequencePosition: number, updatedAt: string }>> =>
  request<{ decisionId: string, sequencePosition: number, updatedAt: string }>('POST', `/decisions/markets/${decisionId}/sequence`, body);

/** GET /api/v1/decisions/:decisionId/rationale — Retrieve rationale for a decision */
export const getDecisionsRationale = (decisionId: string): Promise<ApiResult<{ decisionId: string, rationale: string, evidenceRefs: unknown[], createdAt: string }>> =>
  request<{ decisionId: string, rationale: string, evidenceRefs: unknown[], createdAt: string }>('GET', `/decisions/${decisionId}/rationale`);

/** POST /api/v1/decisions/:decisionId/rationale — Add or update rationale for a decision */
export const rationaleDecisions = (decisionId: string, body: CreateDecisionsRationaleRequest): Promise<ApiResult<{ decisionId: string, rationale: string, updatedAt: string }>> =>
  request<{ decisionId: string, rationale: string, updatedAt: string }>('POST', `/decisions/${decisionId}/rationale`, body);

/** GET /api/v1/decisions/:decisionId/links — List dependency links for a decision */
export const getDecisionsLinks = (decisionId: string, params?: { limit?: number; offset?: number }): Promise<ApiResult<Array<{ linkId: string, sourceDecisionId: string, targetDecisionId: string, linkType: string }>>> =>
  request<Array<{ linkId: string, sourceDecisionId: string, targetDecisionId: string, linkType: string }>>('GET', `/decisions/${decisionId}/links`, params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/decisions/:decisionId/links — Create a dependency link between decisions */
export const linksDecisions = (decisionId: string, body: CreateDecisionsLinksRequest): Promise<ApiResult<{ linkId: string, sourceDecisionId: string, targetDecisionId: string, linkType: string }>> =>
  request<{ linkId: string, sourceDecisionId: string, targetDecisionId: string, linkType: string }>('POST', `/decisions/${decisionId}/links`, body);

// ─────────────────────────────────────────────────────────────────────
// ASSUMPTIONS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/assumptions/sets — List assumption sets for the planning context */
export const getAssumptionsSets = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ assumptionSetId: string, name: string, status: string, createdAt: string }>>> =>
  request<Array<{ assumptionSetId: string, name: string, status: string, createdAt: string }>>('GET', '/assumptions/sets', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/assumptions/sets — Create a new assumption set */
export const createAssumptionsSets = (body: CreateAssumptionsSetsRequest): Promise<ApiResult<{ assumptionSetId: string, name: string, createdAt: string }>> =>
  request<{ assumptionSetId: string, name: string, createdAt: string }>('POST', '/assumptions/sets', body);

/** GET /api/v1/assumptions/sets/:assumptionSetId — Retrieve a single assumption set */
export const getAssumptionsSetsById = (assumptionSetId: string): Promise<ApiResult<{ assumptionSetId: string, name: string, status: string, fieldCount: number, createdAt: string, updatedAt: string }>> =>
  request<{ assumptionSetId: string, name: string, status: string, fieldCount: number, createdAt: string, updatedAt: string }>('GET', `/assumptions/sets/${assumptionSetId}`);

/** PATCH /api/v1/assumptions/sets/:assumptionSetId — Update assumption set metadata */
export const updateAssumptionsSetsById = (assumptionSetId: string, body: UpdateAssumptionsSetsByIdRequest): Promise<ApiResult<{ assumptionSetId: string, name: string, updatedAt: string }>> =>
  request<{ assumptionSetId: string, name: string, updatedAt: string }>('PATCH', `/assumptions/sets/${assumptionSetId}`, body);

/** GET /api/v1/assumptions/packs — List available assumption packs */
export const getAssumptionsPacks = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ packId: string, name: string, category: string, fieldCount: number }>>> =>
  request<Array<{ packId: string, name: string, category: string, fieldCount: number }>>('GET', '/assumptions/packs', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/assumptions/packs — Create a reusable assumption pack */
export const createAssumptionsPacks = (body: CreateAssumptionsPacksRequest): Promise<ApiResult<{ packId: string, name: string, createdAt: string }>> =>
  request<{ packId: string, name: string, createdAt: string }>('POST', '/assumptions/packs', body);

/** POST /api/v1/assumptions/packs/:packId/apply — Apply an assumption pack to a target set and scope */
export const applyAssumptionsPacks = (packId: string, body: CreateAssumptionsPacksApplyRequest): Promise<ApiResult<{ applied: boolean, fieldsApplied: number }>> =>
  request<{ applied: boolean, fieldsApplied: number }>('POST', `/assumptions/packs/${packId}/apply`, body);

/** GET /api/v1/assumptions/demand — List demand assumptions for current context */
export const getAssumptionsDemand = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>> =>
  request<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>('GET', '/assumptions/demand', params as Record<string, string | number | boolean | undefined>);

/** PUT /api/v1/assumptions/demand/bulk — Bulk update demand assumptions */
export const upsertAssumptionsDemandBulk = (body: UpsertAssumptionsDemandBulkRequest): Promise<ApiResult<{ updated: number, skipped: number, errors: unknown[] }>> =>
  request<{ updated: number, skipped: number, errors: unknown[] }>('PUT', '/assumptions/demand/bulk', body);

/** GET /api/v1/assumptions/cost — List cost assumptions for current context */
export const getAssumptionsCost = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>> =>
  request<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>('GET', '/assumptions/cost', params as Record<string, string | number | boolean | undefined>);

/** PUT /api/v1/assumptions/cost/bulk — Bulk update cost assumptions */
export const upsertAssumptionsCostBulk = (body: UpsertAssumptionsCostBulkRequest): Promise<ApiResult<{ updated: number, skipped: number, errors: unknown[] }>> =>
  request<{ updated: number, skipped: number, errors: unknown[] }>('PUT', '/assumptions/cost/bulk', body);

/** GET /api/v1/assumptions/funding — List funding assumptions for current context */
export const getAssumptionsFunding = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>> =>
  request<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>('GET', '/assumptions/funding', params as Record<string, string | number | boolean | undefined>);

/** PUT /api/v1/assumptions/funding/bulk — Bulk update funding assumptions */
export const upsertAssumptionsFundingBulk = (body: UpsertAssumptionsFundingBulkRequest): Promise<ApiResult<{ updated: number, skipped: number, errors: unknown[] }>> =>
  request<{ updated: number, skipped: number, errors: unknown[] }>('PUT', '/assumptions/funding/bulk', body);

/** GET /api/v1/assumptions/working-capital — List working capital assumptions for current context */
export const getAssumptionsWorkingCapital = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>> =>
  request<Array<{ fieldId: string, name: string, value: number, unit: string, periodId: string, confidence: string, source: string }>>('GET', '/assumptions/working-capital', params as Record<string, string | number | boolean | undefined>);

/** PUT /api/v1/assumptions/working-capital/bulk — Bulk update working capital assumptions */
export const upsertAssumptionsWorkingCapitalBulk = (body: UpsertAssumptionsWorkingCapitalBulkRequest): Promise<ApiResult<{ updated: number, skipped: number, errors: unknown[] }>> =>
  request<{ updated: number, skipped: number, errors: unknown[] }>('PUT', '/assumptions/working-capital/bulk', body);

/** GET /api/v1/assumptions/overrides — List assumption overrides for context */
export const getAssumptionsOverrides = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ overrideId: string, fieldId: string, originalValue: number, overrideValue: number, reason: string, actor: string, createdAt: string }>>> =>
  request<Array<{ overrideId: string, fieldId: string, originalValue: number, overrideValue: number, reason: string, actor: string, createdAt: string }>>('GET', '/assumptions/overrides', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/assumptions/overrides — Create an assumption override with rationale */
export const createAssumptionsOverrides = (body: CreateAssumptionsOverridesRequest): Promise<ApiResult<{ overrideId: string, fieldId: string, overrideValue: number, createdAt: string }>> =>
  request<{ overrideId: string, fieldId: string, overrideValue: number, createdAt: string }>('POST', '/assumptions/overrides', body);

// ─────────────────────────────────────────────────────────────────────
// COMPUTE
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/compute/validations — Run validation on the current planning package */
export const createComputeValidations = (body: CreateComputeValidationsRequest): Promise<ApiResult<{ validationId: string, status: string, issueCounts: Record<string, unknown> }>> =>
  request<{ validationId: string, status: string, issueCounts: Record<string, unknown> }>('POST', '/compute/validations', body);

/** GET /api/v1/compute/validations/:validationId — Retrieve validation job details */
export const getComputeValidationsById = (validationId: string): Promise<ApiResult<{ validationId: string, status: string, issueCounts: Record<string, unknown>, createdAt: string, completedAt: string }>> =>
  request<{ validationId: string, status: string, issueCounts: Record<string, unknown>, createdAt: string, completedAt: string }>('GET', `/compute/validations/${validationId}`);

/** GET /api/v1/compute/validations/:validationId/issues — List issues found during validation */
export const getComputeValidationsIssues = (validationId: string, params?: { severity?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ code: string, severity: string, stage: string, surface: string, message: string, entityRefs: unknown[] }>>> =>
  request<Array<{ code: string, severity: string, stage: string, surface: string, message: string, entityRefs: unknown[] }>>('GET', `/compute/validations/${validationId}/issues`, params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/compute/runs — Start a new compute run for the planning package */
export const createComputeRuns = (body: CreateComputeRunsRequest): Promise<ApiResult<{ computeRunId: string, status: string, createdAt: string }>> =>
  request<{ computeRunId: string, status: string, createdAt: string }>('POST', '/compute/runs', body);

/** GET /api/v1/compute/runs — List compute runs for a scenario/version */
export const getComputeRuns = (params?: { companyId: string; scenarioId: string; versionId?: string; status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ computeRunId: string, status: string, triggerType: string, createdAt: string, completedAt: string }>>> =>
  request<Array<{ computeRunId: string, status: string, triggerType: string, createdAt: string, completedAt: string }>>('GET', '/compute/runs', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/compute/runs/:runId — Retrieve a single compute run by ID */
export const getComputeRunsById = (runId: string): Promise<ApiResult<{ computeRunId: string, status: string, triggerType: string, stepsTotal: number, stepsCompleted: number, createdAt: string, completedAt: string }>> =>
  request<{ computeRunId: string, status: string, triggerType: string, stepsTotal: number, stepsCompleted: number, createdAt: string, completedAt: string }>('GET', `/compute/runs/${runId}`);

/** POST /api/v1/compute/runs/:runId/cancel — Cancel a running or queued compute run */
export const cancelComputeRuns = (runId: string, body: CreateComputeRunsCancelRequest): Promise<ApiResult<{ computeRunId: string, status: string, cancelledAt: string }>> =>
  request<{ computeRunId: string, status: string, cancelledAt: string }>('POST', `/compute/runs/${runId}/cancel`, body);

/** GET /api/v1/compute/runs/:runId/steps — List individual steps within a compute run */
export const getComputeRunsSteps = (runId: string, params?: { limit?: number; offset?: number }): Promise<ApiResult<Array<{ stepId: string, name: string, status: string, startedAt: string, completedAt: string, durationMs: number }>>> =>
  request<Array<{ stepId: string, name: string, status: string, startedAt: string, completedAt: string, durationMs: number }>>('GET', `/compute/runs/${runId}/steps`, params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/compute/runs/:runId/results — Retrieve computed output summary for a run */
export const getComputeRunsResults = (runId: string): Promise<ApiResult<{ computeRunId: string, status: string, outputSummary: Record<string, unknown>, warnings: unknown[] }>> =>
  request<{ computeRunId: string, status: string, outputSummary: Record<string, unknown>, warnings: unknown[] }>('GET', `/compute/runs/${runId}/results`);

/** GET /api/v1/compute/dependencies — Show dependency graph for the compute pipeline */
export const getComputeDependencies = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ nodes: unknown[], edges: unknown[], criticalPath: unknown[] }>> =>
  request<{ nodes: unknown[], edges: unknown[], criticalPath: unknown[] }>('GET', '/compute/dependencies', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/compute/freshness — Check freshness status of computed outputs */
export const getComputeFreshness = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ freshness: string, lastRunId: string, lastRunAt: string, staleSurfaces: unknown[] }>> =>
  request<{ freshness: string, lastRunId: string, lastRunAt: string, staleSurfaces: unknown[] }>('GET', '/compute/freshness', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// FINANCIALS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/financials/executive-summary — Executive summary with headline KPIs from latest compute */
export const getFinancialsExecutiveSummary = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ revenue: number, grossProfit: number, ebitda: number, netIncome: number, burn: number, runway: number, irr: number, periodLabel: string }>> =>
  request<{ revenue: number, grossProfit: number, ebitda: number, netIncome: number, burn: number, runway: number, irr: number, periodLabel: string }>('GET', '/financials/executive-summary', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/pnl — P&L projection for the selected context */
export const getFinancialsPnl = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; granularity?: string }): Promise<ApiResult<{ periods: unknown[], lineItems: unknown[] }>> =>
  request<{ periods: unknown[], lineItems: unknown[] }>('GET', '/financials/pnl', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/cash-flow — Cash flow projection for the selected context */
export const getFinancialsCashFlow = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; granularity?: string }): Promise<ApiResult<{ periods: unknown[], lineItems: unknown[] }>> =>
  request<{ periods: unknown[], lineItems: unknown[] }>('GET', '/financials/cash-flow', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/balance-sheet — Balance sheet projection for the selected context */
export const getFinancialsBalanceSheet = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; granularity?: string }): Promise<ApiResult<{ periods: unknown[], lineItems: unknown[] }>> =>
  request<{ periods: unknown[], lineItems: unknown[] }>('GET', '/financials/balance-sheet', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/unit-economics — Unit economics breakdown for the selected context */
export const getFinancialsUnitEconomics = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; dimension?: string }): Promise<ApiResult<{ units: unknown[] }>> =>
  request<{ units: unknown[] }>('GET', '/financials/unit-economics', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/funding-summary — Funding summary including cash position, burn, runway, and events */
export const getFinancialsFundingSummary = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ cashPosition: number, monthlyBurn: number, runway: number, fundingEvents: unknown[], totalRaised: number }>> =>
  request<{ cashPosition: number, monthlyBurn: number, runway: number, fundingEvents: unknown[], totalRaised: number }>('GET', '/financials/funding-summary', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/financials/capital-strategy — Capital strategy view with return metrics and allocation */
export const getFinancialsCapitalStrategy = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ capitalLadder: unknown[], returnMetrics: Record<string, unknown>, dilutionImpact: Record<string, unknown> }>> =>
  request<{ capitalLadder: unknown[], returnMetrics: Record<string, unknown>, dilutionImpact: Record<string, unknown> }>('GET', '/financials/capital-strategy', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// ANALYSIS
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/analysis/comparisons — Create a scenario/version comparison */
export const createAnalysisComparisons = (body: CreateAnalysisComparisonsRequest): Promise<ApiResult<{ comparisonId: string, scenarios: unknown[], deltas: unknown[], createdAt: string }>> =>
  request<{ comparisonId: string, scenarios: unknown[], deltas: unknown[], createdAt: string }>('POST', '/analysis/comparisons', body);

/** GET /api/v1/analysis/comparisons/:comparisonId — Retrieve a saved comparison result */
export const getAnalysisComparisonsById = (comparisonId: string): Promise<ApiResult<{ comparisonId: string, scenarios: unknown[], deltas: unknown[], winnerByMetric: Record<string, unknown> }>> =>
  request<{ comparisonId: string, scenarios: unknown[], deltas: unknown[], winnerByMetric: Record<string, unknown> }>('GET', `/analysis/comparisons/${comparisonId}`);

/** GET /api/v1/analysis/explainability — Explain how drivers contribute to a target metric */
export const getAnalysisExplainability = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; targetMetric: string; timeCut?: string }): Promise<ApiResult<{ targetMetric: string, drivers: unknown[], totalEffect: number }>> =>
  request<{ targetMetric: string, drivers: unknown[], totalEffect: number }>('GET', '/analysis/explainability', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/analysis/sensitivity — Sensitivity analysis for key drivers */
export const getAnalysisSensitivity = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; targetMetric: string; drivers?: string }): Promise<ApiResult<{ targetMetric: string, sensitivities: unknown[] }>> =>
  request<{ targetMetric: string, sensitivities: unknown[] }>('GET', '/analysis/sensitivity', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/analysis/risk — Risk dashboard view with risk items by severity */
export const getAnalysisRisk = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ riskItems: unknown[], aggregateScore: number }>> =>
  request<{ riskItems: unknown[], aggregateScore: number }>('GET', '/analysis/risk', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/analysis/simulation-runs — Start a simulation run with parameter shocks (isolated from official compute) */
export const createAnalysisSimulationRuns = (body: CreateAnalysisSimulationRunsRequest): Promise<ApiResult<{ runId: string, status: string, createdAt: string }>> =>
  request<{ runId: string, status: string, createdAt: string }>('POST', '/analysis/simulation-runs', body);

/** GET /api/v1/analysis/simulation-runs/:runId — Retrieve simulation run results */
export const getAnalysisSimulationRunsById = (runId: string): Promise<ApiResult<{ runId: string, status: string, baseScenarioId: string, shocks: unknown[], results: Record<string, unknown>, completedAt: string }>> =>
  request<{ runId: string, status: string, baseScenarioId: string, shocks: unknown[], results: Record<string, unknown>, completedAt: string }>('GET', `/analysis/simulation-runs/${runId}`);

/** GET /api/v1/analysis/alerts — List active alerts and triggers */
export const getAnalysisAlerts = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; severity?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ alertId: string, severity: string, message: string, linkedEntity: Record<string, unknown>, suggestedAction: string, createdAt: string }>>> =>
  request<Array<{ alertId: string, severity: string, message: string, linkedEntity: Record<string, unknown>, suggestedAction: string, createdAt: string }>>('GET', '/analysis/alerts', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/analysis/portfolio — Portfolio analysis with market ranking and capital allocation */
export const getAnalysisPortfolio = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ markets: unknown[], totalCapital: number }>> =>
  request<{ markets: unknown[], totalCapital: number }>('GET', '/analysis/portfolio', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// CONFIDENCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/confidence/summary — Confidence summary at the selected entity grain */
export const getConfidenceSummary = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ overallConfidence: string, byStage: Record<string, unknown>, lowConfidenceItems: unknown[], evidenceCount: number }>> =>
  request<{ overallConfidence: string, byStage: Record<string, unknown>, lowConfidenceItems: unknown[], evidenceCount: number }>('GET', '/confidence/summary', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/confidence/evidence — List evidence items for the context */
export const getConfidenceEvidence = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; entityType?: string; entityId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ evidenceId: string, title: string, type: string, attachedTo: Record<string, unknown>, createdAt: string, quality: string }>>> =>
  request<Array<{ evidenceId: string, title: string, type: string, attachedTo: Record<string, unknown>, createdAt: string, quality: string }>>('GET', '/confidence/evidence', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/confidence/evidence — Create a new evidence item attached to an entity */
export const createConfidenceEvidence = (body: CreateConfidenceEvidenceRequest): Promise<ApiResult<{ evidenceId: string, title: string, createdAt: string }>> =>
  request<{ evidenceId: string, title: string, createdAt: string }>('POST', '/confidence/evidence', body);

/** GET /api/v1/confidence/evidence/:evidenceId — Retrieve a single evidence item */
export const getConfidenceEvidenceById = (evidenceId: string): Promise<ApiResult<{ evidenceId: string, title: string, description: string, entityType: string, entityId: string, sourceUrl: string, quality: string, createdAt: string }>> =>
  request<{ evidenceId: string, title: string, description: string, entityType: string, entityId: string, sourceUrl: string, quality: string, createdAt: string }>('GET', `/confidence/evidence/${evidenceId}`);

/** GET /api/v1/confidence/assessments — List confidence assessments for context */
export const getConfidenceAssessments = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ assessmentId: string, entityType: string, entityId: string, confidenceLevel: string, evidenceCount: number, updatedAt: string }>>> =>
  request<Array<{ assessmentId: string, entityType: string, entityId: string, confidenceLevel: string, evidenceCount: number, updatedAt: string }>>('GET', '/confidence/assessments', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/confidence/assessments — Create a confidence assessment for an entity */
export const createConfidenceAssessments = (body: CreateConfidenceAssessmentsRequest): Promise<ApiResult<{ assessmentId: string, confidenceLevel: string, createdAt: string }>> =>
  request<{ assessmentId: string, confidenceLevel: string, createdAt: string }>('POST', '/confidence/assessments', body);

/** PATCH /api/v1/confidence/assessments/:assessmentId — Update a confidence assessment */
export const updateConfidenceAssessmentsById = (assessmentId: string, body: UpdateConfidenceAssessmentsByIdRequest): Promise<ApiResult<{ assessmentId: string, confidenceLevel: string, updatedAt: string }>> =>
  request<{ assessmentId: string, confidenceLevel: string, updatedAt: string }>('PATCH', `/confidence/assessments/${assessmentId}`, body);

/** GET /api/v1/confidence/dqi — Retrieve data quality index scores */
export const getConfidenceDqi = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ overallDqi: number, factors: unknown[] }>> =>
  request<{ overallDqi: number, factors: unknown[] }>('GET', '/confidence/dqi', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/confidence/dqi — Submit DQI factor scores */
export const createConfidenceDqi = (body: CreateConfidenceDqiRequest): Promise<ApiResult<{ overallDqi: number, updatedAt: string }>> =>
  request<{ overallDqi: number, updatedAt: string }>('POST', '/confidence/dqi', body);

/** GET /api/v1/confidence/research-tasks — List open research tasks */
export const getConfidenceResearchTasks = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string; status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ taskId: string, title: string, assignee: string, dueDate: string, status: string, linkedEntity: Record<string, unknown> }>>> =>
  request<Array<{ taskId: string, title: string, assignee: string, dueDate: string, status: string, linkedEntity: Record<string, unknown> }>>('GET', '/confidence/research-tasks', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/confidence/research-tasks — Create a research task */
export const createConfidenceResearchTasks = (body: CreateConfidenceResearchTasksRequest): Promise<ApiResult<{ taskId: string, title: string, createdAt: string }>> =>
  request<{ taskId: string, title: string, createdAt: string }>('POST', '/confidence/research-tasks', body);

/** PATCH /api/v1/confidence/research-tasks/:taskId — Update a research task status or details */
export const updateConfidenceResearchTasksById = (taskId: string, body: UpdateConfidenceResearchTasksByIdRequest): Promise<ApiResult<{ taskId: string, status: string, updatedAt: string }>> =>
  request<{ taskId: string, status: string, updatedAt: string }>('PATCH', `/confidence/research-tasks/${taskId}`, body);

/** GET /api/v1/confidence/rollups — Get confidence rollup aggregations across the planning hierarchy */
export const getConfidenceRollups = (params?: { companyId: string; scenarioId?: string; versionId?: string; periodId?: string; scopeRef?: string }): Promise<ApiResult<{ rollups: unknown[] }>> =>
  request<{ rollups: unknown[] }>('GET', '/confidence/rollups', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// GOVERNANCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/governance/versions — List versions with governance state */
export const getGovernanceVersions = (params?: { companyId: string; status?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ versionId: string, label: string, scenarioId: string, governanceState: string, approvedAt: string, publishedAt: string }>>> =>
  request<Array<{ versionId: string, label: string, scenarioId: string, governanceState: string, approvedAt: string, publishedAt: string }>>('GET', '/governance/versions', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/governance/approval-workflows — List approval workflows */
export const getGovernanceApprovalWorkflows = (params?: { companyId: string; versionId?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ workflowId: string, versionId: string, status: string, submittedAt: string, steps: unknown[] }>>> =>
  request<Array<{ workflowId: string, versionId: string, status: string, submittedAt: string, steps: unknown[] }>>('GET', '/governance/approval-workflows', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/governance/approval-workflows/:workflowId/submit — Submit a version for governance review */
export const submitGovernanceApprovalWorkflows = (workflowId: string, body: CreateGovernanceApprovalWorkflowsSubmitRequest): Promise<ApiResult<{ workflowId: string, status: string, submittedAt: string }>> =>
  request<{ workflowId: string, status: string, submittedAt: string }>('POST', `/governance/approval-workflows/${workflowId}/submit`, body);

/** POST /api/v1/governance/approval-workflows/:workflowId/approve — Approve a submitted version */
export const approveGovernanceApprovalWorkflows = (workflowId: string, body: CreateGovernanceApprovalWorkflowsApproveRequest): Promise<ApiResult<{ workflowId: string, status: string, approvedAt: string }>> =>
  request<{ workflowId: string, status: string, approvedAt: string }>('POST', `/governance/approval-workflows/${workflowId}/approve`, body);

/** POST /api/v1/governance/approval-workflows/:workflowId/reject — Reject a submitted version with reason */
export const rejectGovernanceApprovalWorkflows = (workflowId: string, body: CreateGovernanceApprovalWorkflowsRejectRequest): Promise<ApiResult<{ workflowId: string, status: string, rejectedAt: string }>> =>
  request<{ workflowId: string, status: string, rejectedAt: string }>('POST', `/governance/approval-workflows/${workflowId}/reject`, body);

/** GET /api/v1/governance/events — List governance domain events */
export const getGovernanceEvents = (params?: { companyId: string; eventType?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ eventId: string, eventType: string, entityType: string, entityId: string, actor: string, timestamp: string, details: Record<string, unknown> }>>> =>
  request<Array<{ eventId: string, eventType: string, entityType: string, entityId: string, actor: string, timestamp: string, details: Record<string, unknown> }>>('GET', '/governance/events', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/governance/audit-log — Immutable audit log of planning and approval events */
export const getGovernanceAuditLog = (params?: { companyId: string; entityType?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ logId: string, action: string, actor: string, entityType: string, entityId: string, timestamp: string, changeDetails: Record<string, unknown>, surfaceContext: string }>>> =>
  request<Array<{ logId: string, action: string, actor: string, entityType: string, entityId: string, timestamp: string, changeDetails: Record<string, unknown>, surfaceContext: string }>>('GET', '/governance/audit-log', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/governance/decision-memory — List decision memory records */
export const getGovernanceDecisionMemory = (params?: { companyId: string; family?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ decisionRecordId: string, title: string, family: string, owner: string, decisionDate: string, linkedVersionId: string, outcome: string }>>> =>
  request<Array<{ decisionRecordId: string, title: string, family: string, owner: string, decisionDate: string, linkedVersionId: string, outcome: string }>>('GET', '/governance/decision-memory', params as Record<string, string | number | boolean | undefined>);

/** POST /api/v1/governance/decision-memory — Create a decision memory record */
export const createGovernanceDecisionMemory = (body: CreateGovernanceDecisionMemoryRequest): Promise<ApiResult<{ decisionRecordId: string, title: string, createdAt: string }>> =>
  request<{ decisionRecordId: string, title: string, createdAt: string }>('POST', '/governance/decision-memory', body);

/** GET /api/v1/governance/decision-memory/:decisionRecordId — Retrieve a single decision memory record */
export const getGovernanceDecisionMemoryById = (decisionRecordId: string): Promise<ApiResult<{ decisionRecordId: string, title: string, family: string, rationale: string, owner: string, decisionDate: string, linkedVersionId: string, outcome: string, lessons: string }>> =>
  request<{ decisionRecordId: string, title: string, family: string, rationale: string, owner: string, decisionDate: string, linkedVersionId: string, outcome: string, lessons: string }>('GET', `/governance/decision-memory/${decisionRecordId}`);

/** POST /api/v1/governance/publication/:versionId/publish — Publish a version through governance workflow */
export const publishGovernancePublication = (versionId: string, body: CreateGovernancePublicationPublishRequest): Promise<ApiResult<{ versionId: string, governanceState: string, publishedAt: string }>> =>
  request<{ versionId: string, governanceState: string, publishedAt: string }>('POST', `/governance/publication/${versionId}/publish`, body);

/** POST /api/v1/governance/publication/:versionId/unpublish — Unpublish a previously published version */
export const unpublishGovernancePublication = (versionId: string, body: CreateGovernancePublicationUnpublishRequest): Promise<ApiResult<{ versionId: string, governanceState: string, unpublishedAt: string }>> =>
  request<{ versionId: string, governanceState: string, unpublishedAt: string }>('POST', `/governance/publication/${versionId}/unpublish`, body);

// ─────────────────────────────────────────────────────────────────────
// REFERENCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/reference/geographies — List reference geography nodes */
export const getReferenceGeographies = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number, isoCode: string }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number, isoCode: string }>>('GET', '/reference/geographies', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/formats — List reference format taxonomy */
export const getReferenceFormats = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number }>>('GET', '/reference/formats', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/categories — List reference category taxonomy */
export const getReferenceCategories = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number }>>('GET', '/reference/categories', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/portfolio-hierarchy — List reference portfolio hierarchy */
export const getReferencePortfolioHierarchy = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, parentId: string, level: number, nodeType: string }>>> =>
  request<Array<{ nodeId: string, name: string, parentId: string, level: number, nodeType: string }>>('GET', '/reference/portfolio-hierarchy', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/channels — List reference channel definitions */
export const getReferenceChannels = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, channelType: string }>>> =>
  request<Array<{ nodeId: string, name: string, channelType: string }>>('GET', '/reference/channels', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/operating-models — List reference operating model definitions */
export const getReferenceOperatingModels = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ nodeId: string, name: string, modelType: string }>>> =>
  request<Array<{ nodeId: string, name: string, modelType: string }>>('GET', '/reference/operating-models', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/platforms — List reference platform definitions */
export const getReferencePlatforms = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ platformId: string, name: string, status: string }>>> =>
  request<Array<{ platformId: string, name: string, status: string }>>('GET', '/reference/platforms', params as Record<string, string | number | boolean | undefined>);

/** GET /api/v1/reference/product-families — List reference product family hierarchy */
export const getReferenceProductFamilies = (params?: { companyId?: string; search?: string; limit?: number; offset?: number }): Promise<ApiResult<Array<{ familyId: string, name: string, parentId: string, level: number }>>> =>
  request<Array<{ familyId: string, name: string, parentId: string, level: number }>>('GET', '/reference/product-families', params as Record<string, string | number | boolean | undefined>);

// ─────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/edit-suggestions — Get AI-generated edit suggestions for assumptions or decisions (advisory only) */
export const createAiEditSuggestions = (body: CreateAiEditSuggestionsRequest): Promise<ApiResult<{ suggestions: unknown[], draftOnly: boolean, disclaimer: string }>> =>
  request<{ suggestions: unknown[], draftOnly: boolean, disclaimer: string }>('POST', '/ai/edit-suggestions', body);

/** POST /api/v1/ai/analyze — AI-powered analysis of scenarios or metrics (advisory only) */
export const createAiAnalyze = (body: CreateAiAnalyzeRequest): Promise<ApiResult<{ insights: unknown[], caveats: unknown[], confidenceNote: string }>> =>
  request<{ insights: unknown[], caveats: unknown[], confidenceNote: string }>('POST', '/ai/analyze', body);

/** POST /api/v1/ai/explain — AI explanation of a metric's drivers and behavior (advisory only) */
export const createAiExplain = (body: CreateAiExplainRequest): Promise<ApiResult<{ explanation: string, drivers: unknown[], caveats: unknown[] }>> =>
  request<{ explanation: string, drivers: unknown[], caveats: unknown[] }>('POST', '/ai/explain', body);

/** POST /api/v1/ai/research-draft — AI-drafted research note for an entity (advisory only, not auto-published) */
export const createAiResearchDraft = (body: CreateAiResearchDraftRequest): Promise<ApiResult<{ draftNote: string, suggestedEvidence: unknown[], draftOnly: boolean }>> =>
  request<{ draftNote: string, suggestedEvidence: unknown[], draftOnly: boolean }>('POST', '/ai/research-draft', body);
