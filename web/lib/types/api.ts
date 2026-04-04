// Generated from specos/artifacts/api_contracts.json
// DO NOT EDIT — regenerate from SpecOS artifacts
// Lean subset: GET and POST response types for frontend consumption

// ─────────────────────────────────────────────────────────────────────
// Shared envelope types
// ─────────────────────────────────────────────────────────────────────

export interface ResponseMeta {
  requestId: string;
  companyId?: string;
  scenarioId?: string;
  versionId?: string;
  periodId?: string | null;
  scopeRef?: string | null;
  freshness: "fresh" | "stale" | "running" | "failed";
  computeRunId?: string | null;
  governanceState?: "draft" | "in_review" | "approved" | "published" | "frozen" | "rejected";
  confidenceState?: "high" | "medium" | "low" | "estimated" | "unknown";
  generatedAt: string;
}

export interface ApiErrorObject {
  code: string;
  message: string;
  severity: "info" | "warning" | "error" | "fatal";
  retryable: boolean;
  suggestedAction?: string | null;
}

export interface ApiResult<T> {
  data: T | null;
  meta?: ResponseMeta;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/context/companies — List all companies the user has access to */
export interface GetContextCompaniesResponse {
  data:  Array<{
    companyId: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/context/companies — Create a new company record */
export interface CreateContextCompaniesRequest {
  name: string;  // Company name
  industry: string;  // Industry classification
  baseCurrency: string;  // ISO 4217 currency code
  fiscalYearStart?: number;  // Fiscal year start month (1-12)
}

export interface CreateContextCompaniesResponse {
  data:  {
    companyId: string;
    name: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/companies/:companyId — Retrieve a single company by ID */
export interface GetContextCompaniesByIdResponse {
  data:  {
    companyId: string;
    name: string;
    industry: string;
    baseCurrency: string;
    fiscalYearStart: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/companies/:companyId/calendars — List planning calendars for a company */
export interface GetContextCompaniesCalendarsResponse {
  data:  Array<{
    calendarId: string;
    name: string;
    fiscalYearStart: number;
    periodGranularity: string;
    periods: unknown[];
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/context/companies/:companyId/calendars — Create a planning calendar for a company */
export interface CreateContextCompaniesCalendarsRequest {
  name: string;  // Calendar name
  fiscalYearStart: number;  // Start month (1-12)
  periodGranularity: string;  // monthly|quarterly|annual
  horizonYears?: number;  // Planning horizon in years
}

export interface CreateContextCompaniesCalendarsResponse {
  data:  {
    calendarId: string;
    name: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/planning-periods — List planning periods for the selected calendar */
export interface GetContextPlanningPeriodsResponse {
  data:  Array<{
    periodId: string;
    label: string;
    startDate: string;
    endDate: string;
    granularity: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/context/scenarios — List scenarios for a company */
export interface GetContextScenariosResponse {
  data:  Array<{
    scenarioId: string;
    name: string;
    status: string;
    createdAt: string;
    latestVersionId: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/context/scenarios — Create a new scenario */
export interface CreateContextScenariosRequest {
  companyId: string;  // Company ID
  name: string;  // Scenario name
  description?: string;  // Description
  baseScenarioId?: string;  // Base scenario for inheritance
}

export interface CreateContextScenariosResponse {
  data:  {
    scenarioId: string;
    name: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/context/scenarios/:scenarioId/clone — Clone a scenario into a new draft */
export interface CreateContextScenariosCloneRequest {
  name: string;  // Cloned scenario name
  includeAssumptions?: boolean;  // Clone assumptions (default true)
  includeDecisions?: boolean;  // Clone decisions (default true)
}

export interface CreateContextScenariosCloneResponse {
  data:  {
    scenarioId: string;
    name: string;
    clonedFrom: string;
    status: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/versions — List plan versions for a scenario */
export interface GetContextVersionsResponse {
  data:  Array<{
    versionId: string;
    label: string;
    status: string;
    governanceState: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/context/versions — Create a new plan version under a scenario */
export interface CreateContextVersionsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  label: string;  // Version label
  baseVersionId?: string;  // Base version for iteration
}

export interface CreateContextVersionsResponse {
  data:  {
    versionId: string;
    label: string;
    governanceState: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/versions/:versionId — Retrieve a single plan version */
export interface GetContextVersionsByIdResponse {
  data:  {
    versionId: string;
    label: string;
    scenarioId: string;
    governanceState: string;
    createdAt: string;
    publishedAt: string;
    frozenAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/context/versions/:versionId/freeze — Freeze a version to prevent edits */
export interface CreateContextVersionsFreezeRequest {
  reason: string;  // Audit reason for freezing
}

export interface CreateContextVersionsFreezeResponse {
  data:  {
    versionId: string;
    governanceState: string;
    frozenAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/context/versions/:versionId/publish — Publish a version for stakeholder visibility */
export interface CreateContextVersionsPublishRequest {
  reason: string;  // Audit reason for publishing
}

export interface CreateContextVersionsPublishResponse {
  data:  {
    versionId: string;
    governanceState: string;
    publishedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/context/overview — Read-model for shell state, headline KPIs, alerts, and quick links */
export interface GetContextOverviewResponse {
  data:  {
    company: Record<string, unknown>;
    activeScenario: Record<string, unknown>;
    activeVersion: Record<string, unknown>;
    headlineKpis: Record<string, unknown>;
    alerts: unknown[];
    quickLinks: unknown[];
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// SCOPE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/scope/bundles — List scope bundles for the planning context */
export interface GetScopeBundlesResponse {
  data:  Array<{
    scopeBundleId: string;
    name: string;
    status: string;
    dimensionCount: number;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/scope/bundles — Create a new scope bundle */
export interface CreateScopeBundlesRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  name: string;  // Bundle name
  items: unknown[];
}

export interface CreateScopeBundlesResponse {
  data:  {
    scopeBundleId: string;
    name: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/scope/bundles/:scopeBundleId — Retrieve a single scope bundle */
export interface GetScopeBundlesByIdResponse {
  data:  {
    scopeBundleId: string;
    name: string;
    items: unknown[];
    createdAt: string;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/scope/bundles/:scopeBundleId/apply — Apply a scope bundle to the selected scenario/version */
export interface CreateScopeBundlesApplyRequest {
  scenarioId: string;  // Target scenario
  versionId: string;  // Target version
}

export interface CreateScopeBundlesApplyResponse {
  data:  {
    applied: boolean;
    affectedEntities: number;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/scope/formats — List available format dimension nodes */
export interface GetScopeFormatsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/scope/categories — List available category dimension nodes */
export interface GetScopeCategoriesResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/scope/portfolio-nodes — List portfolio hierarchy nodes */
export interface GetScopePortfolioNodesResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
    nodeType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/scope/channels — List available channel dimension nodes */
export interface GetScopeChannelsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    channelType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/scope/operating-models — List available operating model dimension nodes */
export interface GetScopeOperatingModelsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    modelType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/scope/geographies — List available geography dimension nodes */
export interface GetScopeGeographiesResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
    isoCode: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/scope/review/validate — Validate the current scope bundle for completeness */
export interface CreateScopeReviewValidateRequest {
  scopeBundleId: string;  // Scope bundle to validate
}

export interface CreateScopeReviewValidateResponse {
  data:  {
    valid: boolean;
    issues: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/scope/review/summary — Get summary of current scope selection state */
export interface GetScopeReviewSummaryResponse {
  data:  {
    totalNodes: number;
    includedNodes: number;
    excludedNodes: number;
    dimensionBreakdown: Record<string, unknown>;
    warnings: unknown[];
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// DECISIONS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/decisions/products — List products decisions for current context */
export interface GetDecisionsProductsResponse {
  data:  Array<{
    decisionId: string;
    title: string;
    status: string;
    effectivePeriod: string;
    owner: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/products — Create a new product decision */
export interface CreateDecisionsProductsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId?: string;  // Version ID
  title: string;  // Decision title
  description?: string;  // Decision description
  effectivePeriod?: string;  // Target period
  rationale?: string;  // Decision rationale
  scopeRef?: string;  // Linked scope bundle
}

export interface CreateDecisionsProductsResponse {
  data:  {
    decisionId: string;
    title: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/decisions/markets — List markets decisions for current context */
export interface GetDecisionsMarketsResponse {
  data:  Array<{
    decisionId: string;
    title: string;
    status: string;
    effectivePeriod: string;
    owner: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/markets — Create a new market decision */
export interface CreateDecisionsMarketsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId?: string;  // Version ID
  title: string;  // Decision title
  description?: string;  // Decision description
  effectivePeriod?: string;  // Target period
  rationale?: string;  // Decision rationale
  scopeRef?: string;  // Linked scope bundle
}

export interface CreateDecisionsMarketsResponse {
  data:  {
    decisionId: string;
    title: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/decisions/marketing — List marketing decisions for current context */
export interface GetDecisionsMarketingResponse {
  data:  Array<{
    decisionId: string;
    title: string;
    status: string;
    effectivePeriod: string;
    owner: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/marketing — Create a new marketing decision */
export interface CreateDecisionsMarketingRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId?: string;  // Version ID
  title: string;  // Decision title
  description?: string;  // Decision description
  effectivePeriod?: string;  // Target period
  rationale?: string;  // Decision rationale
  scopeRef?: string;  // Linked scope bundle
}

export interface CreateDecisionsMarketingResponse {
  data:  {
    decisionId: string;
    title: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/decisions/operations — List operations decisions for current context */
export interface GetDecisionsOperationsResponse {
  data:  Array<{
    decisionId: string;
    title: string;
    status: string;
    effectivePeriod: string;
    owner: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/operations — Create a new operation decision */
export interface CreateDecisionsOperationsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId?: string;  // Version ID
  title: string;  // Decision title
  description?: string;  // Decision description
  effectivePeriod?: string;  // Target period
  rationale?: string;  // Decision rationale
  scopeRef?: string;  // Linked scope bundle
}

export interface CreateDecisionsOperationsResponse {
  data:  {
    decisionId: string;
    title: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/markets/:decisionId/sequence — Set market rollout sequencing position for a decision */
export interface CreateDecisionsMarketsSequenceRequest {
  sequencePosition: number;  // Position in rollout sequence
  rationale?: string;  // Reason for sequencing
}

export interface CreateDecisionsMarketsSequenceResponse {
  data:  {
    decisionId: string;
    sequencePosition: number;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/decisions/:decisionId/rationale — Retrieve rationale for a decision */
export interface GetDecisionsRationaleResponse {
  data:  {
    decisionId: string;
    rationale: string;
    evidenceRefs: unknown[];
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/:decisionId/rationale — Add or update rationale for a decision */
export interface CreateDecisionsRationaleRequest {
  rationale: string;  // Rationale text
  evidenceRefs?: unknown[];  // Linked evidence IDs
}

export interface CreateDecisionsRationaleResponse {
  data:  {
    decisionId: string;
    rationale: string;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/decisions/:decisionId/links — List dependency links for a decision */
export interface GetDecisionsLinksResponse {
  data:  Array<{
    linkId: string;
    sourceDecisionId: string;
    targetDecisionId: string;
    linkType: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/decisions/:decisionId/links — Create a dependency link between decisions */
export interface CreateDecisionsLinksRequest {
  targetDecisionId: string;  // Target decision
  linkType: string;  // requires|blocks|informs
}

export interface CreateDecisionsLinksResponse {
  data:  {
    linkId: string;
    sourceDecisionId: string;
    targetDecisionId: string;
    linkType: string;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// ASSUMPTIONS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/assumptions/sets — List assumption sets for the planning context */
export interface GetAssumptionsSetsResponse {
  data:  Array<{
    assumptionSetId: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/assumptions/sets — Create a new assumption set */
export interface CreateAssumptionsSetsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId?: string;  // Version ID
  name: string;  // Set name
  baseSetId?: string;  // Base set for inheritance
}

export interface CreateAssumptionsSetsResponse {
  data:  {
    assumptionSetId: string;
    name: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/sets/:assumptionSetId — Retrieve a single assumption set */
export interface GetAssumptionsSetsByIdResponse {
  data:  {
    assumptionSetId: string;
    name: string;
    status: string;
    fieldCount: number;
    createdAt: string;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/packs — List available assumption packs */
export interface GetAssumptionsPacksResponse {
  data:  Array<{
    packId: string;
    name: string;
    category: string;
    fieldCount: number;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/assumptions/packs — Create a reusable assumption pack */
export interface CreateAssumptionsPacksRequest {
  name: string;  // Pack name
  category?: string;  // demand|cost|funding|working_capital
  fields: unknown[];  // Field bindings with values
  description?: string;  // Pack description
}

export interface CreateAssumptionsPacksResponse {
  data:  {
    packId: string;
    name: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/assumptions/packs/:packId/apply — Apply an assumption pack to a target set and scope */
export interface CreateAssumptionsPacksApplyRequest {
  targetSetId: string;  // Target assumption set
  scopeBundleId?: string;  // Scope to apply within
}

export interface CreateAssumptionsPacksApplyResponse {
  data:  {
    applied: boolean;
    fieldsApplied: number;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/demand — List demand assumptions for current context */
export interface GetAssumptionsDemandResponse {
  data:  Array<{
    fieldId: string;
    name: string;
    value: number;
    unit: string;
    periodId: string;
    confidence: string;
    source: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/cost — List cost assumptions for current context */
export interface GetAssumptionsCostResponse {
  data:  Array<{
    fieldId: string;
    name: string;
    value: number;
    unit: string;
    periodId: string;
    confidence: string;
    source: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/funding — List funding assumptions for current context */
export interface GetAssumptionsFundingResponse {
  data:  Array<{
    fieldId: string;
    name: string;
    value: number;
    unit: string;
    periodId: string;
    confidence: string;
    source: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/working-capital — List working capital assumptions for current context */
export interface GetAssumptionsWorkingCapitalResponse {
  data:  Array<{
    fieldId: string;
    name: string;
    value: number;
    unit: string;
    periodId: string;
    confidence: string;
    source: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/assumptions/overrides — List assumption overrides for context */
export interface GetAssumptionsOverridesResponse {
  data:  Array<{
    overrideId: string;
    fieldId: string;
    originalValue: number;
    overrideValue: number;
    reason: string;
    actor: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/assumptions/overrides — Create an assumption override with rationale */
export interface CreateAssumptionsOverridesRequest {
  fieldId: string;  // Field to override
  overrideValue: number;  // New value
  reason: string;  // Override rationale
  evidenceRef?: string;  // Optional linked evidence
}

export interface CreateAssumptionsOverridesResponse {
  data:  {
    overrideId: string;
    fieldId: string;
    overrideValue: number;
    createdAt: string;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// COMPUTE
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/compute/validations — Run validation on the current planning package */
export interface CreateComputeValidationsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId: string;  // Version ID
}

export interface CreateComputeValidationsResponse {
  data:  {
    validationId: string;
    status: string;
    issueCounts: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/validations/:validationId — Retrieve validation job details */
export interface GetComputeValidationsByIdResponse {
  data:  {
    validationId: string;
    status: string;
    issueCounts: Record<string, unknown>;
    createdAt: string;
    completedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/validations/:validationId/issues — List issues found during validation */
export interface GetComputeValidationsIssuesResponse {
  data:  Array<{
    code: string;
    severity: string;
    stage: string;
    surface: string;
    message: string;
    entityRefs: unknown[];
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/compute/runs — Start a new compute run for the planning package */
export interface CreateComputeRunsRequest {
  companyId: string;  // Company ID
  scenarioId: string;  // Scenario ID
  versionId: string;  // Version ID
  triggerType?: string;  // manual|auto|recompute
}

export interface CreateComputeRunsResponse {
  data:  {
    computeRunId: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/runs — List compute runs for a scenario/version */
export interface GetComputeRunsResponse {
  data:  Array<{
    computeRunId: string;
    status: string;
    triggerType: string;
    createdAt: string;
    completedAt: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/compute/runs/:runId — Retrieve a single compute run by ID */
export interface GetComputeRunsByIdResponse {
  data:  {
    computeRunId: string;
    status: string;
    triggerType: string;
    stepsTotal: number;
    stepsCompleted: number;
    createdAt: string;
    completedAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/compute/runs/:runId/cancel — Cancel a running or queued compute run */
export interface CreateComputeRunsCancelRequest {
  reason: string;  // Cancellation reason
}

export interface CreateComputeRunsCancelResponse {
  data:  {
    computeRunId: string;
    status: string;
    cancelledAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/runs/:runId/steps — List individual steps within a compute run */
export interface GetComputeRunsStepsResponse {
  data:  Array<{
    stepId: string;
    name: string;
    status: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/compute/runs/:runId/results — Retrieve computed output summary for a run */
export interface GetComputeRunsResultsResponse {
  data:  {
    computeRunId: string;
    status: string;
    outputSummary: Record<string, unknown>;
    warnings: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/dependencies — Show dependency graph for the compute pipeline */
export interface GetComputeDependenciesResponse {
  data:  {
    nodes: unknown[];
    edges: unknown[];
    criticalPath: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/compute/freshness — Check freshness status of computed outputs */
export interface GetComputeFreshnessResponse {
  data:  {
    freshness: string;
    lastRunId: string;
    lastRunAt: string;
    staleSurfaces: unknown[];
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// FINANCIALS
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/financials/executive-summary — Executive summary with headline KPIs from latest compute */
export interface GetFinancialsExecutiveSummaryResponse {
  data:  {
    revenue: number;
    grossProfit: number;
    ebitda: number;
    netIncome: number;
    burn: number;
    runway: number;
    irr: number;
    periodLabel: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/pnl — P&L projection for the selected context */
export interface GetFinancialsPnlResponse {
  data:  {
    periods: unknown[];
    lineItems: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/cash-flow — Cash flow projection for the selected context */
export interface GetFinancialsCashFlowResponse {
  data:  {
    periods: unknown[];
    lineItems: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/balance-sheet — Balance sheet projection for the selected context */
export interface GetFinancialsBalanceSheetResponse {
  data:  {
    periods: unknown[];
    lineItems: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/unit-economics — Unit economics breakdown for the selected context */
export interface GetFinancialsUnitEconomicsResponse {
  data:  {
    units: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/funding-summary — Funding summary including cash position, burn, runway, and events */
export interface GetFinancialsFundingSummaryResponse {
  data:  {
    cashPosition: number;
    monthlyBurn: number;
    runway: number;
    fundingEvents: unknown[];
    totalRaised: number;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/financials/capital-strategy — Capital strategy view with return metrics and allocation */
export interface GetFinancialsCapitalStrategyResponse {
  data:  {
    capitalLadder: unknown[];
    returnMetrics: Record<string, unknown>;
    dilutionImpact: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// ANALYSIS
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/analysis/comparisons — Create a scenario/version comparison */
export interface CreateAnalysisComparisonsRequest {
  scenarioIds: unknown[];  // Scenario IDs to compare (2-4)
  versionIds?: unknown[];  // Optional version IDs
  metrics: unknown[];  // Metrics to compare (revenue, ebitda, etc.)
  periodRange?: Record<string, unknown>;  // Period range for comparison
}

export interface CreateAnalysisComparisonsResponse {
  data:  {
    comparisonId: string;
    scenarios: unknown[];
    deltas: unknown[];
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/comparisons/:comparisonId — Retrieve a saved comparison result */
export interface GetAnalysisComparisonsByIdResponse {
  data:  {
    comparisonId: string;
    scenarios: unknown[];
    deltas: unknown[];
    winnerByMetric: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/explainability — Explain how drivers contribute to a target metric */
export interface GetAnalysisExplainabilityResponse {
  data:  {
    targetMetric: string;
    drivers: unknown[];
    totalEffect: number;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/sensitivity — Sensitivity analysis for key drivers */
export interface GetAnalysisSensitivityResponse {
  data:  {
    targetMetric: string;
    sensitivities: unknown[];
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/risk — Risk dashboard view with risk items by severity */
export interface GetAnalysisRiskResponse {
  data:  {
    riskItems: unknown[];
    aggregateScore: number;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/analysis/simulation-runs — Start a simulation run with parameter shocks (isolated from official compute) */
export interface CreateAnalysisSimulationRunsRequest {
  baseScenarioId: string;  // Baseline scenario
  shocks: unknown[];
  label?: string;  // Simulation label
}

export interface CreateAnalysisSimulationRunsResponse {
  data:  {
    runId: string;
    status: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/simulation-runs/:runId — Retrieve simulation run results */
export interface GetAnalysisSimulationRunsByIdResponse {
  data:  {
    runId: string;
    status: string;
    baseScenarioId: string;
    shocks: unknown[];
    results: Record<string, unknown>;
    completedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/alerts — List active alerts and triggers */
export interface GetAnalysisAlertsResponse {
  data:  Array<{
    alertId: string;
    severity: string;
    message: string;
    linkedEntity: Record<string, unknown>;
    suggestedAction: string;
    createdAt: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/analysis/portfolio — Portfolio analysis with market ranking and capital allocation */
export interface GetAnalysisPortfolioResponse {
  data:  {
    markets: unknown[];
    totalCapital: number;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// CONFIDENCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/confidence/summary — Confidence summary at the selected entity grain */
export interface GetConfidenceSummaryResponse {
  data:  {
    overallConfidence: string;
    byStage: Record<string, unknown>;
    lowConfidenceItems: unknown[];
    evidenceCount: number;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/evidence — List evidence items for the context */
export interface GetConfidenceEvidenceResponse {
  data:  Array<{
    evidenceId: string;
    title: string;
    type: string;
    attachedTo: Record<string, unknown>;
    createdAt: string;
    quality: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/confidence/evidence — Create a new evidence item attached to an entity */
export interface CreateConfidenceEvidenceRequest {
  title: string;  // Evidence title
  description?: string;  // Evidence description
  entityType: string;  // assumption|decision|recommendation|version
  entityId: string;  // Entity to attach to
  sourceUrl?: string;  // External source URL
  quality?: string;  // high|medium|low
}

export interface CreateConfidenceEvidenceResponse {
  data:  {
    evidenceId: string;
    title: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/evidence/:evidenceId — Retrieve a single evidence item */
export interface GetConfidenceEvidenceByIdResponse {
  data:  {
    evidenceId: string;
    title: string;
    description: string;
    entityType: string;
    entityId: string;
    sourceUrl: string;
    quality: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/assessments — List confidence assessments for context */
export interface GetConfidenceAssessmentsResponse {
  data:  Array<{
    assessmentId: string;
    entityType: string;
    entityId: string;
    confidenceLevel: string;
    evidenceCount: number;
    updatedAt: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/confidence/assessments — Create a confidence assessment for an entity */
export interface CreateConfidenceAssessmentsRequest {
  entityType: string;  // Entity type being assessed
  entityId: string;  // Entity ID
  confidenceLevel: string;  // high|medium|low|estimated|unknown
  rationale?: string;  // Assessment rationale
  evidenceRefs?: unknown[];  // Linked evidence IDs
}

export interface CreateConfidenceAssessmentsResponse {
  data:  {
    assessmentId: string;
    confidenceLevel: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/dqi — Retrieve data quality index scores */
export interface GetConfidenceDqiResponse {
  data:  {
    overallDqi: number;
    factors: unknown[];
  };
  meta: ResponseMeta;
}

/** POST /api/v1/confidence/dqi — Submit DQI factor scores */
export interface CreateConfidenceDqiRequest {
  companyId?: string;  // Company ID
  scenarioId?: string;  // Scenario ID
  factors: unknown[];
}

export interface CreateConfidenceDqiResponse {
  data:  {
    overallDqi: number;
    updatedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/research-tasks — List open research tasks */
export interface GetConfidenceResearchTasksResponse {
  data:  Array<{
    taskId: string;
    title: string;
    assignee: string;
    dueDate: string;
    status: string;
    linkedEntity: Record<string, unknown>;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/confidence/research-tasks — Create a research task */
export interface CreateConfidenceResearchTasksRequest {
  title: string;  // Task title
  description?: string;  // Task description
  assignee?: string;  // Assignee
  dueDate?: string;  // Due date
  linkedEntityType?: string;  // Entity type
  linkedEntityId?: string;  // Entity ID
}

export interface CreateConfidenceResearchTasksResponse {
  data:  {
    taskId: string;
    title: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/confidence/rollups — Get confidence rollup aggregations across the planning hierarchy */
export interface GetConfidenceRollupsResponse {
  data:  {
    rollups: unknown[];
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// GOVERNANCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/governance/versions — List versions with governance state */
export interface GetGovernanceVersionsResponse {
  data:  Array<{
    versionId: string;
    label: string;
    scenarioId: string;
    governanceState: string;
    approvedAt: string;
    publishedAt: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/governance/approval-workflows — List approval workflows */
export interface GetGovernanceApprovalWorkflowsResponse {
  data:  Array<{
    workflowId: string;
    versionId: string;
    status: string;
    submittedAt: string;
    steps: unknown[];
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/governance/approval-workflows/:workflowId/submit — Submit a version for governance review */
export interface CreateGovernanceApprovalWorkflowsSubmitRequest {
  reason: string;  // Submission reason
  notes?: string;  // Additional notes for reviewers
}

export interface CreateGovernanceApprovalWorkflowsSubmitResponse {
  data:  {
    workflowId: string;
    status: string;
    submittedAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/governance/approval-workflows/:workflowId/approve — Approve a submitted version */
export interface CreateGovernanceApprovalWorkflowsApproveRequest {
  reason: string;  // Approval rationale
}

export interface CreateGovernanceApprovalWorkflowsApproveResponse {
  data:  {
    workflowId: string;
    status: string;
    approvedAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/governance/approval-workflows/:workflowId/reject — Reject a submitted version with reason */
export interface CreateGovernanceApprovalWorkflowsRejectRequest {
  reason: string;  // Rejection reason
  suggestedActions?: unknown[];  // Suggested corrective actions
}

export interface CreateGovernanceApprovalWorkflowsRejectResponse {
  data:  {
    workflowId: string;
    status: string;
    rejectedAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/governance/events — List governance domain events */
export interface GetGovernanceEventsResponse {
  data:  Array<{
    eventId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    actor: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/governance/audit-log — Immutable audit log of planning and approval events */
export interface GetGovernanceAuditLogResponse {
  data:  Array<{
    logId: string;
    action: string;
    actor: string;
    entityType: string;
    entityId: string;
    timestamp: string;
    changeDetails: Record<string, unknown>;
    surfaceContext: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/governance/decision-memory — List decision memory records */
export interface GetGovernanceDecisionMemoryResponse {
  data:  Array<{
    decisionRecordId: string;
    title: string;
    family: string;
    owner: string;
    decisionDate: string;
    linkedVersionId: string;
    outcome: string;
  }>;
  meta: ResponseMeta;
}

/** POST /api/v1/governance/decision-memory — Create a decision memory record */
export interface CreateGovernanceDecisionMemoryRequest {
  title: string;  // Decision title
  family: string;  // market|product|marketing|operations
  rationale?: string;  // Decision rationale
  owner?: string;  // Decision owner
  decisionDate: string;  // Date of decision
  linkedVersionId?: string;  // Linked plan version
  linkedDecisionId?: string;  // Linked live decision
}

export interface CreateGovernanceDecisionMemoryResponse {
  data:  {
    decisionRecordId: string;
    title: string;
    createdAt: string;
  };
  meta: ResponseMeta;
}

/** GET /api/v1/governance/decision-memory/:decisionRecordId — Retrieve a single decision memory record */
export interface GetGovernanceDecisionMemoryByIdResponse {
  data:  {
    decisionRecordId: string;
    title: string;
    family: string;
    rationale: string;
    owner: string;
    decisionDate: string;
    linkedVersionId: string;
    outcome: string;
    lessons: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/governance/publication/:versionId/publish — Publish a version through governance workflow */
export interface CreateGovernancePublicationPublishRequest {
  reason: string;  // Publication reason
}

export interface CreateGovernancePublicationPublishResponse {
  data:  {
    versionId: string;
    governanceState: string;
    publishedAt: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/governance/publication/:versionId/unpublish — Unpublish a previously published version */
export interface CreateGovernancePublicationUnpublishRequest {
  reason: string;  // Unpublication reason
}

export interface CreateGovernancePublicationUnpublishResponse {
  data:  {
    versionId: string;
    governanceState: string;
    unpublishedAt: string;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// REFERENCE
// ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/reference/geographies — List reference geography nodes */
export interface GetReferenceGeographiesResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
    isoCode: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/formats — List reference format taxonomy */
export interface GetReferenceFormatsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/categories — List reference category taxonomy */
export interface GetReferenceCategoriesResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/portfolio-hierarchy — List reference portfolio hierarchy */
export interface GetReferencePortfolioHierarchyResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    parentId: string;
    level: number;
    nodeType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/channels — List reference channel definitions */
export interface GetReferenceChannelsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    channelType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/operating-models — List reference operating model definitions */
export interface GetReferenceOperatingModelsResponse {
  data:  Array<{
    nodeId: string;
    name: string;
    modelType: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/platforms — List reference platform definitions */
export interface GetReferencePlatformsResponse {
  data:  Array<{
    platformId: string;
    name: string;
    status: string;
  }>;
  meta: ResponseMeta;
}

/** GET /api/v1/reference/product-families — List reference product family hierarchy */
export interface GetReferenceProductFamiliesResponse {
  data:  Array<{
    familyId: string;
    name: string;
    parentId: string;
    level: number;
  }>;
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/ai/edit-suggestions — Get AI-generated edit suggestions for assumptions or decisions (advisory only) */
export interface CreateAiEditSuggestionsRequest {
  context: Record<string, unknown>;  // Planning context
  prompt: string;  // User prompt for AI assistance
  entityRefs?: unknown[];  // Optional entity references for context
}

export interface CreateAiEditSuggestionsResponse {
  data:  {
    suggestions: unknown[];
    draftOnly: boolean;
    disclaimer: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/ai/analyze — AI-powered analysis of scenarios or metrics (advisory only) */
export interface CreateAiAnalyzeRequest {
  context: Record<string, unknown>;  // Planning context
  analysisType: string;  // gap_analysis|trend_detection|anomaly_detection|recommendation
  targetMetric?: string;  // Optional target metric
}

export interface CreateAiAnalyzeResponse {
  data:  {
    insights: unknown[];
    caveats: unknown[];
    confidenceNote: string;
  };
  meta: ResponseMeta;
}

/** POST /api/v1/ai/explain — AI explanation of a metric's drivers and behavior (advisory only) */
export interface CreateAiExplainRequest {
  metricId: string;  // Metric to explain
  scenarioId: string;  // Scenario context
  versionId?: string;  // Optional version context
  periodRange?: Record<string, unknown>;  // Optional period range
}

export interface CreateAiExplainResponse {
  data:  {
    explanation: string;
    drivers: unknown[];
    caveats: unknown[];
  };
  meta: ResponseMeta;
}

/** POST /api/v1/ai/research-draft — AI-drafted research note for an entity (advisory only, not auto-published) */
export interface CreateAiResearchDraftRequest {
  entityType: string;  // Entity type to research
  entityId: string;  // Entity ID
  researchQuestion: string;  // Research question or topic
  context?: Record<string, unknown>;  // Optional planning context
}

export interface CreateAiResearchDraftResponse {
  data:  {
    draftNote: string;
    suggestedEvidence: unknown[];
    draftOnly: boolean;
  };
  meta: ResponseMeta;
}

// ─────────────────────────────────────────────────────────────────────
// Missing PATCH/PUT request types — pragmatic stubs until Wave 2 rebuild
// ─────────────────────────────────────────────────────────────────────

/** PATCH /api/v1/context/companies/:companyId */
export type UpdateContextCompaniesByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/context/scenarios/:scenarioId */
export type UpdateContextScenariosByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/scope/bundles/:scopeBundleId */
export type UpdateScopeBundlesByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/decisions/products/:decisionId */
export type UpdateDecisionsProductsByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/decisions/markets/:decisionId */
export type UpdateDecisionsMarketsByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/decisions/marketing/:decisionId */
export type UpdateDecisionsMarketingByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/decisions/operations/:decisionId */
export type UpdateDecisionsOperationsByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/assumptions/sets/:assumptionSetId */
export type UpdateAssumptionsSetsByIdRequest = Record<string, unknown>;

/** PUT /api/v1/assumptions/demand/bulk */
export type UpsertAssumptionsDemandBulkRequest = Record<string, unknown>;

/** PUT /api/v1/assumptions/cost/bulk */
export type UpsertAssumptionsCostBulkRequest = Record<string, unknown>;

/** PUT /api/v1/assumptions/funding/bulk */
export type UpsertAssumptionsFundingBulkRequest = Record<string, unknown>;

/** PUT /api/v1/assumptions/working-capital/bulk */
export type UpsertAssumptionsWorkingCapitalBulkRequest = Record<string, unknown>;

/** PATCH /api/v1/confidence/assessments/:assessmentId */
export type UpdateConfidenceAssessmentsByIdRequest = Record<string, unknown>;

/** PATCH /api/v1/confidence/research-tasks/:taskId */
export type UpdateConfidenceResearchTasksByIdRequest = Record<string, unknown>;
