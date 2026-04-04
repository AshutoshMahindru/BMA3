// Generated from specos/artifacts/canonical_schema.json
// DO NOT EDIT — regenerate from SpecOS artifacts
// Entity count: 50 (all 50 entities, alphabetised by interface name)
// Source: specos/artifacts/canonical_schema.json  generated_at=2026-04-04T02:45:52Z

// prettier-ignore
import {
  StageFamily, DecisionFamily, AssumptionFamily, ConfidenceState, DqiDimension, ComputeRunStatus, ValidationSeverity, DimensionFamily, EntityAttachmentType, EvidenceSourceType, ReviewStatus, GeographyNodeType, GrainRole, TriggerType, VersionStatus, PackSourceType
} from './enums';

// NOTE: Enum fields are typed as string in the DB schema; cast to the appropriate
// enum type at the application boundary if needed.

/** Individual steps within an approval workflow. Defines required roles, order, and conditions for each approval stage. */
export interface ApprovalWorkflowSteps {
  id: string; // UUID; Workflow step primary key
  workflow_id: string; // UUID; Parent approval workflow
  step_order: number;  // Order of this step in the workflow
  step_name: string;  // Display name for this step
  required_role?: string | null;  // Role required to complete this step (planner, finance_reviewer, domain_reviewer, approver, governance_owner)
  step_type: string;  // Type of step
  is_mandatory: boolean;  // Whether this step can be skipped
  condition_expression?: Record<string, unknown> | null;  // Optional condition for conditional steps
  timeout_hours?: number | null;  // Hours after which this step escalates or times out
  metadata?: Record<string, unknown> | null;  // Extensible step metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ApprovalWorkflowStepsInsert = Omit<ApprovalWorkflowSteps, 'created_at' | 'id' | 'updated_at'>;
export type ApprovalWorkflowStepsUpdate = Partial<ApprovalWorkflowStepsInsert>;

/** Defines approval workflow templates for scenarios, versions, decisions, and publications. Specifies required steps and roles. */
export interface ApprovalWorkflows {
  id: string; // UUID; Approval workflow primary key
  company_id: string; // UUID; Tenant / company reference
  workflow_name: string;  // Display name of the workflow
  entity_type: string;  // Type of entity this workflow applies to (version, decision, publication)
  status: string;  // Workflow template status
  min_confidence_required?: string | null;  // Minimum confidence state required for approval
  description?: string | null;  // Description of the workflow
  metadata?: Record<string, unknown> | null;  // Extensible workflow metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ApprovalWorkflowsInsert = Omit<ApprovalWorkflows, 'created_at' | 'id' | 'updated_at'>;
export type ApprovalWorkflowsUpdate = Partial<ApprovalWorkflowsInsert>;

/** Explicit links between assumptions and the decisions they parameterize. Decisions define intent; assumptions define the conditions under which decisions are evaluated. */
export interface AssumptionDecisionLinks {
  id: string; // UUID; Link primary key
  assumption_pack_id: string; // UUID; The assumption pack
  decision_id: string; // UUID; The decision being parameterized
  link_type: string;  // Relationship type
  description?: string | null;  // Description of the link
  metadata?: Record<string, unknown> | null;  // Extensible link metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionDecisionLinksInsert = Omit<AssumptionDecisionLinks, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionDecisionLinksUpdate = Partial<AssumptionDecisionLinksInsert>;

/** Individual assumption values at a specific grain. Each record represents one assumption variable bound to a specific dimensional context (geography, category, period, etc.). */
export interface AssumptionFieldBindings {
  id: string; // UUID; Field binding primary key
  pack_id: string; // UUID; Parent assumption pack
  variable_name: string;  // Assumption variable identifier (e.g. 'demand_density_index', 'take_rate', 'labor_cost_index')
  grain_signature: Record<string, unknown>;  // Dimensional grain at which this value applies {geography_id, format_id, category_id, channel_id, period_id, etc.}
  value: Record<string, unknown>;  // Assumption value (numeric, text, or structured)
  unit?: string | null;  // Unit of the value (currency, percent, index, orders, days, etc.)
  data_type?: string | null;  // Data type hint
  is_override: boolean;  // Whether this is an explicit override of a broader default
  inherited_from_id?: string | null; // UUID; Link to the broader-grain binding this overrides
  evidence_ref?: string | null; // UUID; Link to supporting evidence
  confidence_assessment_id?: string | null; // UUID; Link to confidence assessment for this specific field
  metadata?: Record<string, unknown> | null;  // Extensible field binding metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionFieldBindingsInsert = Omit<AssumptionFieldBindings, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionFieldBindingsUpdate = Partial<AssumptionFieldBindingsInsert>;

/** Audit log for assumption value changes. Tracks previous/new values, who changed them, and why, for governance and lineage. */
export interface AssumptionOverrideLog {
  id: string; // UUID; Override log entry primary key
  binding_id: string; // UUID; The assumption field binding that was changed
  previous_value?: Record<string, unknown> | null;  // Value before the change
  new_value: Record<string, unknown>;  // Value after the change
  changed_by?: string | null; // UUID; User who made the change
  changed_at: string; // ISO timestamp; When the change occurred
  reason?: string | null;  // Reason for the override
  change_source?: string | null;  // Source of the change
  metadata?: Record<string, unknown> | null;  // Extensible override log metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionOverrideLogInsert = Omit<AssumptionOverrideLog, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionOverrideLogUpdate = Partial<AssumptionOverrideLogInsert>;

/** Links assumption packs to scenarios, versions, or scope bundles. Enables reusable pack application across multiple planning contexts. */
export interface AssumptionPackBindings {
  id: string; // UUID; Pack binding primary key
  pack_id: string; // UUID; The assumption pack being bound
  scenario_id?: string | null; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  binding_status: string;  // Binding status
  applied_by?: string | null; // UUID; User who applied this binding
  applied_at?: string | null; // ISO timestamp; When the binding was applied
  metadata?: Record<string, unknown> | null;  // Extensible binding metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionPackBindingsInsert = Omit<AssumptionPackBindings, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionPackBindingsUpdate = Partial<AssumptionPackBindingsInsert>;

/** Reusable grouped bundles of assumptions (e.g. conservative market-entry pack, premium assortment pack). Composable for scenario creation, templates, and AI-assisted editing. */
export interface AssumptionPacks {
  id: string; // UUID; Assumption pack primary key
  company_id: string; // UUID; Tenant / company reference
  assumption_set_id?: string | null; // UUID; Optional parent assumption set
  assumption_family: string;  // Assumption family
  pack_name: string;  // Display name of the pack
  source_type: string;  // How this pack originated
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  decision_id?: string | null; // UUID; Linked decision if pack is decision-bound
  default_confidence_assessment_id?: string | null; // UUID; Default confidence for the pack
  status: string;  // Pack lifecycle status
  effective_period_range?: Record<string, unknown> | null;  // Period range this pack covers {from_period_id, to_period_id}
  description?: string | null;  // Human description of the pack's use case
  metadata?: Record<string, unknown> | null;  // Extensible pack metadata (compatible formats/categories/channels, intended use case)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionPacksInsert = Omit<AssumptionPacks, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionPacksUpdate = Partial<AssumptionPacksInsert>;

/** Container for a coherent set of assumptions within a scenario/version. Acts as the mutable draft envelope; plan_version is the immutable governed snapshot. */
export interface AssumptionSets {
  id: string; // UUID; Assumption set primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  name?: string | null;  // Optional display name for the assumption set
  status: string;  // Set lifecycle status
  owner?: string | null; // UUID; User who owns this assumption set
  confidence_state?: string | null;  // Overall confidence state of the set
  parent_set_id?: string | null; // UUID; Inherited-from parent set for lineage
  metadata?: Record<string, unknown> | null;  // Extensible set metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type AssumptionSetsInsert = Omit<AssumptionSets, 'created_at' | 'id' | 'updated_at'>;
export type AssumptionSetsUpdate = Partial<AssumptionSetsInsert>;

/** Balance sheet projection outputs. Holds assets, liabilities, equity, working capital, and balance sheet line items by period. */
export interface BalanceSheetProjections {
  id: string; // UUID; balance_sheet_projections primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  metric_name: string;  // Financial metric identifier (e.g. net_revenue, cogs, ebitda)
  value?: number | null;  // Computed metric value
  currency?: string | null;  // Currency code for monetary values
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain: {geography_id, format_id, category_id, channel_id, operating_model_id}
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  is_provisional: boolean;  // Whether this value is provisional/stale
  metadata?: Record<string, unknown> | null;  // Extensible output metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type BalanceSheetProjectionsInsert = Omit<BalanceSheetProjections, 'created_at' | 'id' | 'updated_at'>;
export type BalanceSheetProjectionsUpdate = Partial<BalanceSheetProjectionsInsert>;

/** Cash flow projection outputs. Holds operating cash flow, investing, financing, burn, runway, and cash balance projections. */
export interface CashflowProjections {
  id: string; // UUID; cashflow_projections primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  metric_name: string;  // Financial metric identifier (e.g. net_revenue, cogs, ebitda)
  value?: number | null;  // Computed metric value
  currency?: string | null;  // Currency code for monetary values
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain: {geography_id, format_id, category_id, channel_id, operating_model_id}
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  is_provisional: boolean;  // Whether this value is provisional/stale
  metadata?: Record<string, unknown> | null;  // Extensible output metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type CashflowProjectionsInsert = Omit<CashflowProjections, 'created_at' | 'id' | 'updated_at'>;
export type CashflowProjectionsUpdate = Partial<CashflowProjectionsInsert>;

/** Classifies food/beverage category or menu domain (pizza, burgers, coffee, etc.). Category affects price bands, margins, complexity, spoilage, cross-sell. */
export interface CategoryTaxonomyNodes {
  id: string; // UUID; category_taxonomy_nodes primary key
  company_id?: string | null; // UUID; Tenant / company reference
  taxonomy_family: string;  // Taxonomy family this node belongs to
  parent_node_id?: string | null; // UUID; Parent node for hierarchy navigation
  code: string;  // Stable machine-readable code
  label: string;  // Human-readable display label
  level?: string | null;  // Hierarchy level name (e.g. group, type, subtype)
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  effective_from?: string | null; // YYYY-MM-DD; Date from which this node is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which this node is effective
  sort_order?: number | null;  // Display ordering within siblings
  metadata?: Record<string, unknown> | null;  // Extensible node attributes and taxonomy-specific properties
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type CategoryTaxonomyNodesInsert = Omit<CategoryTaxonomyNodes, 'created_at' | 'id' | 'updated_at'>;
export type CategoryTaxonomyNodesUpdate = Partial<CategoryTaxonomyNodesInsert>;

/** Classifies commercial routes through which orders/revenue are generated (aggregator, direct, dine-in, catering, etc.). */
export interface ChannelTaxonomyNodes {
  id: string; // UUID; channel_taxonomy_nodes primary key
  company_id?: string | null; // UUID; Tenant / company reference
  taxonomy_family: string;  // Taxonomy family this node belongs to
  parent_node_id?: string | null; // UUID; Parent node for hierarchy navigation
  code: string;  // Stable machine-readable code
  label: string;  // Human-readable display label
  level?: string | null;  // Hierarchy level name (e.g. group, type, subtype)
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  effective_from?: string | null; // YYYY-MM-DD; Date from which this node is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which this node is effective
  sort_order?: number | null;  // Display ordering within siblings
  metadata?: Record<string, unknown> | null;  // Extensible node attributes and taxonomy-specific properties
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ChannelTaxonomyNodesInsert = Omit<ChannelTaxonomyNodes, 'created_at' | 'id' | 'updated_at'>;
export type ChannelTaxonomyNodesUpdate = Partial<ChannelTaxonomyNodesInsert>;

/** Top-level tenant / business entity under which all planning occurs. Root of the planning spine. */
export interface Companies {
  id: string; // UUID; Company primary key
  slug: string;  // URL-friendly unique identifier
  name: string;  // Display name of the company
  legal_name?: string | null;  // Legal entity name if different from display name
  status: string;  // Company lifecycle status
  default_currency: string;  // Default reporting currency ISO code
  fiscal_year_start_month: number;  // Month number fiscal year begins
  metadata?: Record<string, unknown> | null;  // Extensible company-level metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type CompaniesInsert = Omit<Companies, 'created_at' | 'id' | 'updated_at'>;
export type CompaniesUpdate = Partial<CompaniesInsert>;

/** Frozen snapshot of all inputs that a compute run consumed. Enables reproducibility and freshness comparison. */
export interface ComputeDependencySnapshots {
  id: string; // UUID; Dependency snapshot primary key
  compute_run_id: string; // UUID; Parent compute run
  snapshot_hash: string;  // Content hash of the dependency manifest for comparison
  dependency_manifest: Record<string, unknown>;  // Complete manifest of consumed inputs: assumption set IDs, pack IDs, scope bundle state, version state
  assumption_set_ids?: Record<string, unknown> | null;  // Array of assumption set IDs consumed
  scope_bundle_state?: Record<string, unknown> | null;  // Snapshot of scope bundle configuration at run time
  metadata?: Record<string, unknown> | null;  // Extensible snapshot metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ComputeDependencySnapshotsInsert = Omit<ComputeDependencySnapshots, 'created_at' | 'id' | 'updated_at'>;
export type ComputeDependencySnapshotsUpdate = Partial<ComputeDependencySnapshotsInsert>;

/** Output artifacts produced by a compute run. References generated projections, reports, or snapshots for traceability. */
export interface ComputeRunArtifacts {
  id: string; // UUID; Artifact primary key
  compute_run_id: string; // UUID; Parent compute run
  artifact_type: string;  // Type of artifact
  artifact_ref?: string | null;  // Reference to the artifact (table name, file path, or URI)
  row_count?: number | null;  // Number of output rows generated
  checksum?: string | null;  // Hash of artifact contents for integrity checks
  metadata?: Record<string, unknown> | null;  // Extensible artifact metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ComputeRunArtifactsInsert = Omit<ComputeRunArtifacts, 'created_at' | 'id' | 'updated_at'>;
export type ComputeRunArtifactsUpdate = Partial<ComputeRunArtifactsInsert>;

/** Individual steps within a compute run. Tracks step sequencing, status, and timing for each compute pipeline stage. */
export interface ComputeRunSteps {
  id: string; // UUID; Compute run step primary key
  compute_run_id: string; // UUID; Parent compute run
  step_code: string;  // Machine identifier for the step (e.g. 'demand_calc', 'pnl_gen', 'cashflow_gen')
  step_label?: string | null;  // Human-readable step label
  step_order: number;  // Execution order within the run
  status: string;  // Step status
  started_at?: string | null; // ISO timestamp; Step start time
  completed_at?: string | null; // ISO timestamp; Step completion time
  output_summary?: Record<string, unknown> | null;  // Summary of step outputs (row counts, metrics)
  error_message?: string | null;  // Error details if step failed
  metadata?: Record<string, unknown> | null;  // Extensible step metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ComputeRunStepsInsert = Omit<ComputeRunSteps, 'created_at' | 'id' | 'updated_at'>;
export type ComputeRunStepsUpdate = Partial<ComputeRunStepsInsert>;

/** First-class compute execution records. Tracks when projections were computed, by whom, with what trigger, and resulting status. */
export interface ComputeRuns {
  id: string; // UUID; Compute run primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  trigger_type: string;  // What initiated the run
  status: string;  // Run lifecycle status
  started_at?: string | null; // ISO timestamp; When the run started executing
  completed_at?: string | null; // ISO timestamp; When the run finished
  triggered_by?: string | null; // UUID; User or system actor who triggered the run
  error_message?: string | null;  // Error details if the run failed
  run_config?: Record<string, unknown> | null;  // Configuration parameters for the run
  metadata?: Record<string, unknown> | null;  // Extensible run metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ComputeRunsInsert = Omit<ComputeRuns, 'created_at' | 'id' | 'updated_at'>;
export type ComputeRunsUpdate = Partial<ComputeRunsInsert>;

/** Validation issues detected during a compute run. Tracks issue codes, severity, affected entities, and resolution state. */
export interface ComputeValidationResults {
  id: string; // UUID; Validation result primary key
  compute_run_id?: string | null; // UUID; Compute run that found this issue (null if standalone validation)
  validation_job_id?: string | null; // UUID; Standalone validation job ID if not part of a compute run
  issue_code: string;  // Machine-readable issue code
  severity: string;  // Issue severity
  stage_family?: string | null;  // Which stage family the issue affects
  surface_code?: string | null;  // Which UI surface should display this issue
  entity_type?: string | null;  // Type of entity affected
  entity_id?: string | null; // UUID; ID of the affected entity
  message: string;  // Human-readable issue message
  resolution_state: string;  // Resolution status
  resolved_by?: string | null; // UUID; User who resolved this issue
  resolved_at?: string | null; // ISO timestamp; When the issue was resolved
  metadata?: Record<string, unknown> | null;  // Extensible validation result metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ComputeValidationResultsInsert = Omit<ComputeValidationResults, 'created_at' | 'id' | 'updated_at'>;
export type ComputeValidationResultsUpdate = Partial<ComputeValidationResultsInsert>;

/** Planner-facing evaluation of how trustworthy an assumption, decision, or other entity is. Supports High/Medium/Low/Estimated/Unknown states and numeric scores. */
export interface ConfidenceAssessments {
  id: string; // UUID; Confidence assessment primary key
  company_id: string; // UUID; Tenant / company reference
  entity_type: string;  // Type of entity being assessed
  entity_id: string; // UUID; ID of the assessed entity
  state: string;  // Confidence state label
  numeric_score?: number | null;  // Normalized confidence score 0-100
  owner_user_id?: string | null; // UUID; User responsible for this assessment
  review_status?: string | null;  // Review workflow status
  last_reviewed_at?: string | null; // ISO timestamp; When this assessment was last reviewed
  review_due_at?: string | null; // ISO timestamp; Next scheduled review date
  status: string;  // Assessment lifecycle status
  rationale?: string | null;  // Rationale for the confidence level
  evidence_count?: number | null;  // Number of linked evidence items
  downgrade_reason?: string | null;  // Reason if confidence was downgraded
  upgrade_reason?: string | null;  // Reason if confidence was upgraded
  metadata?: Record<string, unknown> | null;  // Extensible assessment metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ConfidenceAssessmentsInsert = Omit<ConfidenceAssessments, 'created_at' | 'id' | 'updated_at'>;
export type ConfidenceAssessmentsUpdate = Partial<ConfidenceAssessmentsInsert>;

/** Summarized confidence at higher levels: assumption family, market, scenario, plan version. Supports weighted rollup with critical-path awareness. */
export interface ConfidenceRollups {
  id: string; // UUID; Confidence rollup primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  rollup_scope: string;  // What this rollup covers
  scope_ref_id?: string | null; // UUID; Reference ID for the scope being rolled up
  scope_ref_label?: string | null;  // Human label for the rollup scope
  overall_state: string;  // Rolled-up confidence state
  overall_score?: number | null;  // Rolled-up numeric score (0-100)
  component_count?: number | null;  // Number of component assessments included
  critical_low_count?: number | null;  // Count of critical-path low-confidence components
  weakest_component_summary?: string | null;  // Summary of the weakest component driving the rollup
  rollup_method?: string | null;  // Method used for rollup (weighted, worst_case, hybrid)
  computed_at?: string | null; // ISO timestamp; When this rollup was last computed
  metadata?: Record<string, unknown> | null;  // Extensible rollup metadata (weights, penalties applied)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ConfidenceRollupsInsert = Omit<ConfidenceRollups, 'created_at' | 'id' | 'updated_at'>;
export type ConfidenceRollupsUpdate = Partial<ConfidenceRollupsInsert>;

/** Prerequisite or blocking relationships between decisions. Models which decisions must be completed before others can proceed. */
export interface DecisionDependencies {
  id: string; // UUID; Decision dependency primary key
  decision_id: string; // UUID; The dependent decision
  depends_on_decision_id: string; // UUID; The prerequisite decision
  dependency_type: string;  // Type of dependency
  description?: string | null;  // Description of the dependency relationship
  metadata?: Record<string, unknown> | null;  // Extensible dependency metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionDependenciesInsert = Omit<DecisionDependencies, 'created_at' | 'id' | 'updated_at'>;
export type DecisionDependenciesUpdate = Partial<DecisionDependenciesInsert>;

/** Dimensional bindings for decisions — specifies which geographies, formats, categories, channels, and operating models a decision targets. */
export interface DecisionDimensions {
  id: string; // UUID; Decision dimension primary key
  decision_id: string; // UUID; Parent decision
  dimension_family: string;  // Which dimension family
  node_id: string; // UUID; Reference to taxonomy/geography node
  role: string;  // How this dimension relates to the decision
  metadata?: Record<string, unknown> | null;  // Extensible dimension binding metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionDimensionsInsert = Omit<DecisionDimensions, 'created_at' | 'id' | 'updated_at'>;
export type DecisionDimensionsUpdate = Partial<DecisionDimensionsInsert>;

/** Expected effects of a decision on demand, capacity, margin, burn, capital, confidence, and other impact dimensions. */
export interface DecisionImpacts {
  id: string; // UUID; Decision impact primary key
  decision_id: string; // UUID; Parent decision
  impact_dimension: string;  // What the decision affects (demand, capacity, margin, burn, capital, confidence, risk, rollout)
  impact_direction?: string | null;  // Direction of impact
  impact_magnitude?: string | null;  // Magnitude classification
  impact_description?: string | null;  // Human description of the expected impact
  quantitative_estimate?: number | null;  // Estimated numeric impact value
  estimate_unit?: string | null;  // Unit for quantitative estimate (currency, percent, orders, etc.)
  confidence_level?: string | null;  // Confidence in impact estimate
  metadata?: Record<string, unknown> | null;  // Extensible impact metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionImpactsInsert = Omit<DecisionImpacts, 'created_at' | 'id' | 'updated_at'>;
export type DecisionImpactsUpdate = Partial<DecisionImpactsInsert>;

/** Records the observed or expected outcomes of decisions for governance-grade decision memory. Preserves the confidence state at decision time for future review. */
export interface DecisionOutcomes {
  id: string; // UUID; Decision outcome primary key
  decision_id: string; // UUID; Source decision
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  outcome_type: string;  // Type of outcome
  outcome_summary?: string | null;  // Narrative summary of outcome
  confidence_state_at_decision?: string | null;  // Confidence state snapshot at the time the decision was made
  confidence_score_at_decision?: number | null;  // Numeric confidence score at the time of decision
  recorded_by?: string | null; // UUID; User who recorded the outcome
  recorded_at?: string | null; // ISO timestamp; When the outcome was recorded
  metadata?: Record<string, unknown> | null;  // Extensible outcome metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionOutcomesInsert = Omit<DecisionOutcomes, 'created_at' | 'id' | 'updated_at'>;
export type DecisionOutcomesUpdate = Partial<DecisionOutcomesInsert>;

/** Detailed rationale entries for decisions, supporting auditability. Links decisions to evidence for governance review. */
export interface DecisionRationales {
  id: string; // UUID; Decision rationale primary key
  decision_id: string; // UUID; Parent decision
  summary: string;  // Rationale summary text
  rationale_type?: string | null;  // Type of rationale
  evidence_ref?: string | null; // UUID; Optional link to an evidence item
  authored_by?: string | null; // UUID; User who authored this rationale
  metadata?: Record<string, unknown> | null;  // Extensible rationale metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionRationalesInsert = Omit<DecisionRationales, 'created_at' | 'id' | 'updated_at'>;
export type DecisionRationalesUpdate = Partial<DecisionRationalesInsert>;

/** Canonical cross-family decision header. Represents a planner's controllable choice (product, market, marketing, operations, governance) as a first-class auditable planning object. */
export interface DecisionRecords {
  id: string; // UUID; Decision record primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  decision_family: string;  // Top-level decision family
  decision_status: string;  // Decision lifecycle status
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  title: string;  // Short descriptive title of the decision
  rationale_summary?: string | null;  // Brief rationale for this decision
  owner_user_id?: string | null; // UUID; User who owns this decision
  effective_from_period_id?: string | null; // UUID; Period from which this decision takes effect
  effective_to_period_id?: string | null; // UUID; Period until which this decision applies
  confidence_assessment_id?: string | null; // UUID; Link to confidence assessment
  metadata?: Record<string, unknown> | null;  // Extensible decision metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DecisionRecordsInsert = Omit<DecisionRecords, 'created_at' | 'id' | 'updated_at'>;
export type DecisionRecordsUpdate = Partial<DecisionRecordsInsert>;

/** Data Quality Index sub-scores explaining why an assumption is high or low confidence. Seven canonical DQI dimensions scored individually with weighted rollup. */
export interface DqiScores {
  id: string; // UUID; DQI score primary key
  company_id: string; // UUID; Tenant / company reference
  entity_type: string;  // Type of entity being scored
  entity_id: string; // UUID; ID of the scored entity
  confidence_assessment_id?: string | null; // UUID; Linked confidence assessment
  source_quality_score?: number | null;  // Source credibility and authority (0-100)
  freshness_score?: number | null;  // How current the support is (0-100)
  completeness_score?: number | null;  // Whether enough relevant evidence exists (0-100)
  relevance_score?: number | null;  // How well evidence matches current context (0-100)
  granularity_score?: number | null;  // Whether evidence is at the needed grain (0-100)
  consistency_score?: number | null;  // Whether sources agree or conflict (0-100)
  traceability_score?: number | null;  // Whether another reviewer can inspect and re-derive (0-100)
  overall_score?: number | null;  // Weighted overall DQI score (0-100)
  scoring_method?: string | null;  // Method used for scoring (manual, automated, hybrid)
  scored_by?: string | null; // UUID; User or system that produced the scores
  scored_at?: string | null; // ISO timestamp; When the scores were computed
  metadata?: Record<string, unknown> | null;  // Extensible DQI metadata (weights, notes)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DqiScoresInsert = Omit<DqiScores, 'created_at' | 'id' | 'updated_at'>;
export type DqiScoresUpdate = Partial<DqiScoresInsert>;

/** Driver decomposition and financial bridge records. Explains which upstream drivers caused each major output change — the bridge between inputs and financial outcomes. */
export interface DriverExplainability {
  id: string; // UUID; Driver explainability primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  target_metric: string;  // The output metric being explained (e.g. net_revenue, ebitda, burn)
  driver_name: string;  // Name of the upstream driver
  driver_type?: string | null;  // Classification of the driver (assumption, decision, external, computed)
  contribution_value?: number | null;  // Quantified contribution to the target metric
  contribution_pct?: number | null;  // Percentage contribution to the target metric
  direction?: string | null;  // Direction of contribution
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain at which this explanation applies
  confidence_note?: string | null;  // Confidence context for this driver explanation
  metadata?: Record<string, unknown> | null;  // Extensible explainability metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type DriverExplainabilityInsert = Omit<DriverExplainability, 'created_at' | 'id' | 'updated_at'>;
export type DriverExplainabilityUpdate = Partial<DriverExplainabilityInsert>;

/** Material used to justify assumptions or conclusions. Represents research, benchmarks, actuals, expert judgment, and other evidence sources. */
export interface EvidenceItems {
  id: string; // UUID; Evidence item primary key
  company_id: string; // UUID; Tenant / company reference
  source_type: string;  // Evidence source type
  source_name?: string | null;  // Name or title of the source
  source_url?: string | null;  // Link to the source or attachment
  title: string;  // Evidence item title
  description?: string | null;  // Extended description of the evidence
  collection_date?: string | null; // YYYY-MM-DD; When the evidence was collected
  effective_from?: string | null; // YYYY-MM-DD; Start of the period this evidence is relevant to
  effective_to?: string | null; // YYYY-MM-DD; End of the period this evidence is relevant to
  geography_node_id?: string | null; // UUID; Geography relevance
  format_relevance?: string | null;  // Format relevance (free text or node code)
  category_relevance?: string | null;  // Category relevance (free text or node code)
  method_note?: string | null;  // Collection methodology note
  completeness_note?: string | null;  // Note on data completeness
  caveats_note?: string | null;  // Known caveats or biases
  collected_by?: string | null; // UUID; User who collected or uploaded this evidence
  metadata?: Record<string, unknown> | null;  // Extensible evidence metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type EvidenceItemsInsert = Omit<EvidenceItems, 'created_at' | 'id' | 'updated_at'>;
export type EvidenceItemsUpdate = Partial<EvidenceItemsInsert>;

/** Attaches evidence items to specific entities (assumptions, decisions, packs, recommendations, versions). Polymorphic attachment via entity_type + entity_id. */
export interface EvidenceLinks {
  id: string; // UUID; Evidence link primary key
  evidence_id: string; // UUID; The evidence item being linked
  entity_type: string;  // Type of entity being linked to
  entity_id: string; // UUID; ID of the entity being linked to
  link_type: string;  // Nature of the link
  relevance_note?: string | null;  // Note on why this evidence is relevant
  linked_by?: string | null; // UUID; User who created this link
  metadata?: Record<string, unknown> | null;  // Extensible link metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type EvidenceLinksInsert = Omit<EvidenceLinks, 'created_at' | 'id' | 'updated_at'>;
export type EvidenceLinksUpdate = Partial<EvidenceLinksInsert>;

/** Classifies commercial-operating format of the business (dark kitchen, QSR, café, kiosk, etc.). Format affects demand, capacity, labor, capex, channel relevance. */
export interface FormatTaxonomyNodes {
  id: string; // UUID; format_taxonomy_nodes primary key
  company_id?: string | null; // UUID; Tenant / company reference
  taxonomy_family: string;  // Taxonomy family this node belongs to
  parent_node_id?: string | null; // UUID; Parent node for hierarchy navigation
  code: string;  // Stable machine-readable code
  label: string;  // Human-readable display label
  level?: string | null;  // Hierarchy level name (e.g. group, type, subtype)
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  effective_from?: string | null; // YYYY-MM-DD; Date from which this node is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which this node is effective
  sort_order?: number | null;  // Display ordering within siblings
  metadata?: Record<string, unknown> | null;  // Extensible node attributes and taxonomy-specific properties
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type FormatTaxonomyNodesInsert = Omit<FormatTaxonomyNodes, 'created_at' | 'id' | 'updated_at'>;
export type FormatTaxonomyNodesUpdate = Partial<FormatTaxonomyNodesInsert>;

/** Generalized geography hierarchy: region → country → state/province → cluster → macro market → micro market → site/unit. Supports both administrative and commercial market geography. */
export interface GeographyNodes {
  id: string; // UUID; Geography node primary key
  company_id?: string | null; // UUID; Tenant / company reference
  parent_node_id?: string | null; // UUID; Parent geography node
  node_type: string;  // Type of geography node
  code: string;  // Stable geography code (e.g. ISO country code)
  label: string;  // Display label
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  latitude?: number | null;  // Latitude for mapping
  longitude?: number | null;  // Longitude for mapping
  timezone?: string | null;  // IANA timezone identifier
  currency?: string | null;  // Local currency ISO code
  metadata?: Record<string, unknown> | null;  // Extensible geo attributes (urban/suburban, density class, rent class, competition class, strategic tier)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type GeographyNodesInsert = Omit<GeographyNodes, 'created_at' | 'id' | 'updated_at'>;
export type GeographyNodesUpdate = Partial<GeographyNodesInsert>;

/** Audit trail of governance actions: approvals, rejections, state transitions, publications, freezes, and other lifecycle events. */
export interface GovernanceEvents {
  id: string; // UUID; Governance event primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id?: string | null; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  event_type: string;  // Type of governance event
  entity_type?: string | null;  // Type of entity this event applies to
  entity_id?: string | null; // UUID; ID of the entity this event applies to
  actor_user_id?: string | null; // UUID; User who performed the action
  actor_role?: string | null;  // Role of the acting user
  previous_state?: string | null;  // State before the event
  new_state?: string | null;  // State after the event
  reason?: string | null;  // Reason for the governance action
  event_timestamp: string; // ISO timestamp; When the event occurred
  metadata?: Record<string, unknown> | null;  // Extensible event metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type GovernanceEventsInsert = Omit<GovernanceEvents, 'created_at' | 'id' | 'updated_at'>;
export type GovernanceEventsUpdate = Partial<GovernanceEventsInsert>;

/** KPI projection outputs. Breakeven metrics, return metrics (IRR, payback), utilization, growth rates, and other derived KPIs. */
export interface KpiProjections {
  id: string; // UUID; kpi_projections primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  metric_name: string;  // Financial metric identifier (e.g. net_revenue, cogs, ebitda)
  value?: number | null;  // Computed metric value
  currency?: string | null;  // Currency code for monetary values
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain: {geography_id, format_id, category_id, channel_id, operating_model_id}
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  is_provisional: boolean;  // Whether this value is provisional/stale
  metadata?: Record<string, unknown> | null;  // Extensible output metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type KpiProjectionsInsert = Omit<KpiProjections, 'created_at' | 'id' | 'updated_at'>;
export type KpiProjectionsUpdate = Partial<KpiProjectionsInsert>;

/** Classifies how food is produced, assembled, and fulfilled (cook-to-order, batch prep, assembly-led, hub-and-spoke, etc.). */
export interface OperatingModelNodes {
  id: string; // UUID; operating_model_nodes primary key
  company_id?: string | null; // UUID; Tenant / company reference
  taxonomy_family: string;  // Taxonomy family this node belongs to
  parent_node_id?: string | null; // UUID; Parent node for hierarchy navigation
  code: string;  // Stable machine-readable code
  label: string;  // Human-readable display label
  level?: string | null;  // Hierarchy level name (e.g. group, type, subtype)
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  effective_from?: string | null; // YYYY-MM-DD; Date from which this node is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which this node is effective
  sort_order?: number | null;  // Display ordering within siblings
  metadata?: Record<string, unknown> | null;  // Extensible node attributes and taxonomy-specific properties
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type OperatingModelNodesInsert = Omit<OperatingModelNodes, 'created_at' | 'id' | 'updated_at'>;
export type OperatingModelNodesUpdate = Partial<OperatingModelNodesInsert>;

/** Versioned snapshots of a scenario — draft, reviewed, frozen, published, or archived. Supports governance, comparison, and reproducibility. */
export interface PlanVersions {
  id: string; // UUID; Plan version primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_number: number;  // Sequential version number within the scenario
  label?: string | null;  // Human-friendly version label
  status: string;  // Version lifecycle state
  created_by?: string | null; // UUID; User who created this version
  frozen_at?: string | null; // ISO timestamp; Timestamp when the version was frozen
  published_at?: string | null; // ISO timestamp; Timestamp when the version was published
  approved_by?: string | null; // UUID; User who approved this version
  metadata?: Record<string, unknown> | null;  // Extensible version metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PlanVersionsInsert = Omit<PlanVersions, 'created_at' | 'id' | 'updated_at'>;
export type PlanVersionsUpdate = Partial<PlanVersionsInsert>;

/** Defines the fiscal calendar and planning horizon for a company. Anchor for all time-based planning. */
export interface PlanningCalendars {
  id: string; // UUID; Calendar primary key
  company_id: string; // UUID; Tenant / company reference
  name: string;  // Calendar name (e.g. 'FY2026 Planning Calendar')
  fiscal_year_label: string;  // Fiscal year label
  start_date: string; // YYYY-MM-DD; First day of the planning horizon
  end_date: string; // YYYY-MM-DD; Last day of the planning horizon
  default_grain: string;  // Default planning grain
  status: string;  // Calendar status
  metadata?: Record<string, unknown> | null;  // Extensible calendar metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PlanningCalendarsInsert = Omit<PlanningCalendars, 'created_at' | 'id' | 'updated_at'>;
export type PlanningCalendarsUpdate = Partial<PlanningCalendarsInsert>;

/** Individual time periods within a planning calendar. Monthly is the canonical core grain; quarterly and annual are rollups. */
export interface PlanningPeriods {
  id: string; // UUID; Period primary key
  calendar_id: string; // UUID; Parent planning calendar
  company_id: string; // UUID; Tenant / company reference
  label: string;  // Display label (e.g. 'Jan 2026')
  grain: string;  // Period grain type
  start_date: string; // YYYY-MM-DD; Period start date
  end_date: string; // YYYY-MM-DD; Period end date
  fiscal_year: number;  // Fiscal year number
  fiscal_quarter?: number | null;  // Fiscal quarter number
  fiscal_month?: number | null;  // Fiscal month number
  sequence_number: number;  // Ordinal position within calendar
  trading_days?: number | null;  // Number of operating / trading days in the period
  is_actual: boolean;  // Whether this period contains actuals vs forecast
  metadata?: Record<string, unknown> | null;  // Extensible period metadata (seasonality markers, event flags)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PlanningPeriodsInsert = Omit<PlanningPeriods, 'created_at' | 'id' | 'updated_at'>;
export type PlanningPeriodsUpdate = Partial<PlanningPeriodsInsert>;

/** Profit & Loss projection outputs. Holds revenue stack, contribution margin ladder, EBITDA, EBIT, and all P&L line items by period and dimensional grain. */
export interface PnlProjections {
  id: string; // UUID; pnl_projections primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  metric_name: string;  // Financial metric identifier (e.g. net_revenue, cogs, ebitda)
  value?: number | null;  // Computed metric value
  currency?: string | null;  // Currency code for monetary values
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain: {geography_id, format_id, category_id, channel_id, operating_model_id}
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  is_provisional: boolean;  // Whether this value is provisional/stale
  metadata?: Record<string, unknown> | null;  // Extensible output metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PnlProjectionsInsert = Omit<PnlProjections, 'created_at' | 'id' | 'updated_at'>;
export type PnlProjectionsUpdate = Partial<PnlProjectionsInsert>;

/** Hierarchical product offering structure: category group → category → subcategory → product family → item → SKU/variant. */
export interface PortfolioNodes {
  id: string; // UUID; portfolio_nodes primary key
  company_id?: string | null; // UUID; Tenant / company reference
  taxonomy_family: string;  // Taxonomy family this node belongs to
  parent_node_id?: string | null; // UUID; Parent node for hierarchy navigation
  code: string;  // Stable machine-readable code
  label: string;  // Human-readable display label
  level?: string | null;  // Hierarchy level name (e.g. group, type, subtype)
  description?: string | null;  // Extended description
  status: string;  // Node lifecycle status
  effective_from?: string | null; // YYYY-MM-DD; Date from which this node is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which this node is effective
  sort_order?: number | null;  // Display ordering within siblings
  metadata?: Record<string, unknown> | null;  // Extensible node attributes and taxonomy-specific properties
  hero_flag?: boolean | null;  // Whether this is a hero/anchor product
  complexity_class?: string | null;  // Operational complexity classification (low, medium, high)
  price_band?: string | null;  // Price positioning band (value, mid, premium)
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PortfolioNodesInsert = Omit<PortfolioNodes, 'created_at' | 'id' | 'updated_at'>;
export type PortfolioNodesUpdate = Partial<PortfolioNodesInsert>;

/** Records when a plan version or scenario output is published for consumption. Tracks publication scope, audience, and related governance state. */
export interface PublicationEvents {
  id: string; // UUID; Publication event primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  publication_type: string;  // Type of publication
  published_by?: string | null; // UUID; User who published
  published_at: string; // ISO timestamp; Publication timestamp
  audience?: string | null;  // Intended audience description
  notes?: string | null;  // Publication notes
  compute_run_id?: string | null; // UUID; Compute run this publication is based on
  confidence_snapshot?: Record<string, unknown> | null;  // Snapshot of confidence state at publication time
  metadata?: Record<string, unknown> | null;  // Extensible publication metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type PublicationEventsInsert = Omit<PublicationEvents, 'created_at' | 'id' | 'updated_at'>;
export type PublicationEventsUpdate = Partial<PublicationEventsInsert>;

/** Researcher notes, benchmark summaries, and findings attached to research tasks. Supports the researcher role in improving model confidence. */
export interface ResearchNotes {
  id: string; // UUID; Research note primary key
  research_task_id?: string | null; // UUID; Parent research task
  company_id: string; // UUID; Tenant / company reference
  note_type: string;  // Type of note
  title?: string | null;  // Note title
  content: string;  // Note content / body text
  authored_by?: string | null; // UUID; User who authored the note
  evidence_refs?: Record<string, unknown> | null;  // Array of evidence item IDs referenced
  confidence_impact?: string | null;  // How this note affects confidence (upgrade, downgrade, neutral, requires_further)
  metadata?: Record<string, unknown> | null;  // Extensible note metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ResearchNotesInsert = Omit<ResearchNotes, 'created_at' | 'id' | 'updated_at'>;
export type ResearchNotesUpdate = Partial<ResearchNotesInsert>;

/** Research backlog items for improving model confidence. Tracks evidence gaps, required investigations, and researcher assignments. */
export interface ResearchTasks {
  id: string; // UUID; Research task primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id?: string | null; // UUID; Scenario reference
  entity_type?: string | null;  // Type of entity this research targets
  entity_id?: string | null; // UUID; ID of the entity this research targets
  title: string;  // Research task title
  description?: string | null;  // Detailed description of what needs to be researched
  priority: string;  // Task priority
  status: string;  // Task status
  assigned_to?: string | null; // UUID; Researcher assigned to this task
  due_date?: string | null; // YYYY-MM-DD; Target completion date
  completed_at?: string | null; // ISO timestamp; When the task was completed
  outcome_summary?: string | null;  // Summary of research findings
  evidence_items_created?: Record<string, unknown> | null;  // Array of evidence item IDs produced by this research
  metadata?: Record<string, unknown> | null;  // Extensible task metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ResearchTasksInsert = Omit<ResearchTasks, 'created_at' | 'id' | 'updated_at'>;
export type ResearchTasksUpdate = Partial<ResearchTasksInsert>;

/** Structured scenario comparison results. Stores delta analysis between scenarios or versions including what changed, which decisions differed, and impact on outputs. */
export interface ScenarioComparisons {
  id: string; // UUID; Scenario comparison primary key
  company_id: string; // UUID; Tenant / company reference
  base_scenario_id: string; // UUID; Base scenario for comparison
  base_version_id?: string | null; // UUID; Base version for comparison
  compare_scenario_id: string; // UUID; Comparison scenario
  compare_version_id?: string | null; // UUID; Comparison version
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  comparison_type: string;  // Type of comparison
  delta_summary?: Record<string, unknown> | null;  // Structured summary of deltas across key metrics
  decision_deltas?: Record<string, unknown> | null;  // Which decisions differ between compared scenarios
  assumption_deltas?: Record<string, unknown> | null;  // Which assumptions differ between compared scenarios
  confidence_comparison?: Record<string, unknown> | null;  // Confidence quality comparison
  generated_at: string; // ISO timestamp; When this comparison was generated
  metadata?: Record<string, unknown> | null;  // Extensible comparison metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ScenarioComparisonsInsert = Omit<ScenarioComparisons, 'created_at' | 'id' | 'updated_at'>;
export type ScenarioComparisonsUpdate = Partial<ScenarioComparisonsInsert>;

/** Modeled alternative futures (Base, Bull, Bear, Stress, strategic option, management case). Core of scenario-driven planning. */
export interface Scenarios {
  id: string; // UUID; Scenario primary key
  company_id: string; // UUID; Tenant / company reference
  name: string;  // Display name of the scenario
  scenario_family?: string | null;  // Classification: base, upside, downside, stress, strategic_option, management_case, investor_case
  parent_scenario_id?: string | null; // UUID; Parent scenario for branching / inheritance
  status: string;  // Scenario lifecycle status
  description?: string | null;  // Human-readable description of the scenario intent
  active_scope_bundle_id?: string | null; // UUID; Currently active scope bundle for this scenario
  metadata?: Record<string, unknown> | null;  // Extensible scenario metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ScenariosInsert = Omit<Scenarios, 'created_at' | 'id' | 'updated_at'>;
export type ScenariosUpdate = Partial<ScenariosInsert>;

/** Individual dimension node selections within a scope bundle. Attaches format, category, channel, geography, or operating-model nodes with include/exclude semantics. */
export interface ScopeBundleItems {
  id: string; // UUID; Scope bundle item primary key
  scope_bundle_id: string; // UUID; Scope bundle reference
  dimension_family: string;  // Which dimension family this item belongs to
  node_id: string; // UUID; Reference to the selected taxonomy/geography node
  grain_role: string;  // How this node participates in scope
  metadata?: Record<string, unknown> | null;  // Extensible item metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ScopeBundleItemsInsert = Omit<ScopeBundleItems, 'created_at' | 'id' | 'updated_at'>;
export type ScopeBundleItemsUpdate = Partial<ScopeBundleItemsInsert>;

/** Versioned snapshots of scope bundles for governance and audit. Tracks changes to scope definitions over time. */
export interface ScopeBundleVersions {
  id: string; // UUID; Scope bundle version primary key
  scope_bundle_id: string; // UUID; Scope bundle reference
  version_number: number;  // Sequential version number
  snapshot_data: Record<string, unknown>;  // Frozen snapshot of scope bundle items at this version
  status: string;  // Version status
  created_by?: string | null; // UUID; User who created this version
  approved_by?: string | null; // UUID; User who approved this version
  approved_at?: string | null; // ISO timestamp; Timestamp of approval
  change_summary?: string | null;  // Human-readable summary of changes from previous version
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ScopeBundleVersionsInsert = Omit<ScopeBundleVersions, 'created_at' | 'id' | 'updated_at'>;
export type ScopeBundleVersionsUpdate = Partial<ScopeBundleVersionsInsert>;

/** Reusable planning boundary definitions for a scenario/version. Stores which business dimensions (format, category, channel, geography, operating model) are in scope. */
export interface ScopeBundles {
  id: string; // UUID; Scope bundle primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id?: string | null; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  bundle_name: string;  // Display name of the scope bundle
  status: string;  // Bundle lifecycle status
  is_default: boolean;  // Whether this is the default bundle for the scenario
  created_by?: string | null; // UUID; User who created this bundle
  approved_by?: string | null; // UUID; User who approved this bundle
  description?: string | null;  // Human description of scope intent
  metadata?: Record<string, unknown> | null;  // Extensible scope bundle metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type ScopeBundlesInsert = Omit<ScopeBundles, 'created_at' | 'id' | 'updated_at'>;
export type ScopeBundlesUpdate = Partial<ScopeBundlesInsert>;

/** Cross-references between taxonomy families. Binds format, category, channel, operating model, and geography nodes to enable reusable selectors, scope composition, and assumption/analysis targeting. */
export interface TaxonomyBindings {
  id: string; // UUID; Taxonomy binding primary key
  company_id?: string | null; // UUID; Tenant / company reference
  source_family: string;  // Source taxonomy family
  source_node_id: string; // UUID; Source taxonomy/geography node ID
  target_family: string;  // Target taxonomy family
  target_node_id: string; // UUID; Target taxonomy/geography node ID
  binding_type: string;  // Nature of the binding
  effective_from?: string | null; // YYYY-MM-DD; Date from which binding is effective
  effective_to?: string | null; // YYYY-MM-DD; Date until which binding is effective
  metadata?: Record<string, unknown> | null;  // Extensible binding metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type TaxonomyBindingsInsert = Omit<TaxonomyBindings, 'created_at' | 'id' | 'updated_at'>;
export type TaxonomyBindingsUpdate = Partial<TaxonomyBindingsInsert>;

/** Unit economics projection outputs. Per-order, per-unit, and per-site economics including revenue/order, COGS/order, CM/order, and related unit-level metrics. */
export interface UnitEconomicsProjections {
  id: string; // UUID; unit_economics_projections primary key
  company_id: string; // UUID; Tenant / company reference
  scenario_id: string; // UUID; Scenario reference
  version_id?: string | null; // UUID; Plan version reference
  period_id?: string | null; // UUID; Planning period reference
  compute_run_id?: string | null; // UUID; Compute run that produced this output
  metric_name: string;  // Financial metric identifier (e.g. net_revenue, cogs, ebitda)
  value?: number | null;  // Computed metric value
  currency?: string | null;  // Currency code for monetary values
  dimension_signatures?: Record<string, unknown> | null;  // Dimensional grain: {geography_id, format_id, category_id, channel_id, operating_model_id}
  scope_bundle_id?: string | null; // UUID; Scope bundle reference
  is_provisional: boolean;  // Whether this value is provisional/stale
  metadata?: Record<string, unknown> | null;  // Extensible output metadata
  created_at: string; // ISO timestamp; Row creation timestamp
  updated_at: string; // ISO timestamp; Row last-update timestamp
}

export type UnitEconomicsProjectionsInsert = Omit<UnitEconomicsProjections, 'created_at' | 'id' | 'updated_at'>;
export type UnitEconomicsProjectionsUpdate = Partial<UnitEconomicsProjectionsInsert>;
