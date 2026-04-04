// Generated from specos/artifacts/canonical_schema.json enum_types
// DO NOT EDIT — regenerate from SpecOS artifacts

/** Workspace stage classification for entities and events */
export enum StageFamily {
  CONTEXT = 'context',
  SCOPE = 'scope',
  DECISIONS = 'decisions',
  ASSUMPTIONS = 'assumptions',
  COMPUTE = 'compute',
  FINANCIALS = 'financials',
  CONFIDENCE = 'confidence',
  GOVERNANCE = 'governance',
  INTERPRETATION = 'interpretation',
}

/** Top-level decision family classification */
export enum DecisionFamily {
  PRODUCT = 'product',
  MARKET = 'market',
  MARKETING = 'marketing',
  OPERATIONS = 'operations',
  GOVERNANCE = 'governance',
}

/** Canonical assumption family classification */
export enum AssumptionFamily {
  PRODUCT = 'product',
  MARKET = 'market',
  CAPACITY = 'capacity',
  OPERATIONS = 'operations',
  FUNDING = 'funding',
}

/** Confidence level labels with numeric score mapping: High(80-100), Medium(60-79), Low(30-59), Estimated(1-29), Unknown(0/null) */
export enum ConfidenceState {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  ESTIMATED = 'estimated',
  UNKNOWN = 'unknown',
}

/** Data Quality Index scoring dimensions */
export enum DqiDimension {
  SOURCE_QUALITY = 'source_quality',
  FRESHNESS = 'freshness',
  COMPLETENESS = 'completeness',
  RELEVANCE = 'relevance',
  GRANULARITY = 'granularity',
  CONSISTENCY = 'consistency',
  TRACEABILITY = 'traceability',
}

/** Compute run lifecycle states */
export enum ComputeRunStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** Severity levels for validation issues */
export enum ValidationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/** Canonical business dimension families */
export enum DimensionFamily {
  FORMAT = 'format',
  CATEGORY = 'category',
  PORTFOLIO = 'portfolio',
  CHANNEL = 'channel',
  OPERATING_MODEL = 'operating_model',
  GEOGRAPHY = 'geography',
}

/** Entity types that can receive confidence, evidence, or polymorphic attachments */
export enum EntityAttachmentType {
  ASSUMPTION_FIELD = 'assumption_field',
  ASSUMPTION_PACK = 'assumption_pack',
  DECISION = 'decision',
  SCOPE_BUNDLE = 'scope_bundle',
  COMPUTE_OUTPUT = 'compute_output',
  RECOMMENDATION = 'recommendation',
  VERSION = 'version',
}

/** Types of evidence sources */
export enum EvidenceSourceType {
  INTERNAL_HISTORICAL = 'internal_historical',
  INTERNAL_ACTUALS = 'internal_actuals',
  PRIMARY_RESEARCH = 'primary_research',
  SME_JUDGMENT = 'sme_judgment',
  FIELD_OBSERVATION = 'field_observation',
  BENCHMARK_DATASET = 'benchmark_dataset',
  SECONDARY_RESEARCH = 'secondary_research',
  VENDOR_INFO = 'vendor_info',
  MODELED_ESTIMATE = 'modeled_estimate',
  TEMPLATE_DEFAULT = 'template_default',
}

/** Confidence review workflow states */
export enum ReviewStatus {
  DRAFT = 'draft',
  UNDER_RESEARCH = 'under_research',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  EXPIRED = 'expired',
  NEEDS_REFRESH = 'needs_refresh',
}

/** Types of geography hierarchy nodes */
export enum GeographyNodeType {
  REGION = 'region',
  COUNTRY = 'country',
  STATE = 'state',
  CLUSTER = 'cluster',
  MACRO_MARKET = 'macro_market',
  MICRO_MARKET = 'micro_market',
  SITE = 'site',
}

/** How a dimension node participates in scope */
export enum GrainRole {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

/** What initiated a compute run */
export enum TriggerType {
  MANUAL = 'manual',
  AUTO = 'auto',
  PUBLISH_GATE = 'publish_gate',
  COMPARE_PREP = 'compare_prep',
  SCHEDULED = 'scheduled',
}

/** Plan version lifecycle states */
export enum VersionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  FROZEN = 'frozen',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/** How an assumption pack originated */
export enum PackSourceType {
  TEMPLATE = 'template',
  BENCHMARK = 'benchmark',
  COPIED = 'copied',
  SCENARIO_SPECIFIC = 'scenario_specific',
}
