-- Enable UUID generation (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable trigram indexing for fast text search on names / descriptions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


CREATE TYPE scenario_type AS ENUM (
    'base', 'bull_case', 'bear_case', 'stress_test', 'custom'
);

CREATE TYPE plan_version_type AS ENUM (
    'budget', 'forecast', 'reforecast', 'board_submission', 'actuals'
);

CREATE TYPE plan_status AS ENUM (
    'draft', 'in_review', 'approved', 'published', 'archived', 'superseded'
);

CREATE TYPE geographic_level AS ENUM (
    'company', 'country', 'cluster', 'macro', 'micro', 'kitchen'
);

CREATE TYPE kitchen_format AS ENUM (
    'standard_dark', 'shared_commissary', 'satellite', 'ghost_suite'
);

CREATE TYPE platform_type AS ENUM (
    'aggregator', 'own_app', 'own_web', 'b2b', 'catering'
);

CREATE TYPE product_family_type AS ENUM (
    'pizza', 'sides', 'beverages', 'desserts', 'combos'
);

CREATE TYPE cost_behavior AS ENUM (
    'fixed', 'variable', 'semi_variable', 'step_fixed'
);

CREATE TYPE currency_code AS ENUM (
    'AED', 'USD', 'GBP', 'EUR', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
    'INR', 'PKR', 'EGP'
);

CREATE TYPE risk_category AS ENUM (
    'market', 'platform', 'food_cost', 'labor', 'expansion',
    'funding', 'regulatory', 'operational'
);

CREATE TYPE risk_likelihood AS ENUM (
    'very_low', 'low', 'medium', 'high', 'very_high'
);

CREATE TYPE risk_impact AS ENUM (
    'negligible', 'minor', 'moderate', 'major', 'critical'
);

CREATE TYPE kpi_category AS ENUM (
    'financial', 'liquidity', 'return', 'operational', 'commercial'
);

CREATE TYPE alert_severity AS ENUM (
    'info', 'warning', 'critical'
);

CREATE TYPE approval_status AS ENUM (
    'pending', 'approved', 'rejected', 'escalated'
);

CREATE TYPE governance_event_type AS ENUM (
    'plan_created', 'assumption_changed', 'scenario_cloned',
    'plan_approved', 'plan_published', 'plan_frozen', 'override_applied'
);

CREATE TYPE confidence_level AS ENUM (
    'very_low', 'low', 'medium', 'high', 'very_high'
);

CREATE TYPE evidence_source AS ENUM (
    'market_research', 'historical_data', 'industry_benchmark',
    'expert_estimate', 'platform_data', 'operator_input'
);

CREATE TYPE expansion_trigger_type AS ENUM (
    'utilization', 'financial', 'operational', 'capital', 'time_based'
);

CREATE TYPE hiring_trigger_type AS ENUM (
    'volume', 'utilization', 'quality', 'management_span'
);

CREATE TYPE simulator_type AS ENUM (
    'pricing', 'marketing', 'expansion', 'funding', 'cost_shock',
    'margin_recovery', 'monte_carlo', 'competition', 'macro',
    'capacity', 'staffing', 'platform'
);

CREATE TYPE sensitivity_type AS ENUM (
    'price', 'volume', 'cost', 'marketing', 'expansion', 'commission'
);

CREATE TYPE actuals_source AS ENUM (
    'pos', 'accounting_system', 'platform_report',
    'manual_entry', 'bank_feed'
);

CREATE TYPE variance_type AS ENUM (
    'volume', 'rate', 'mix', 'timing', 'one_off'
);

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    base_currency currency_code NOT NULL DEFAULT 'USD',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1
        CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    country_code TEXT NOT NULL,  -- ISO 2-char code (e.g. 'AE')
    metadata JSONB,              -- extensible attributes

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_by  UUID,
    is_deleted  BOOLEAN DEFAULT FALSE,
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_companies_tenant ON companies (tenant_id)
    WHERE is_deleted = FALSE;

CREATE TABLE planning_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,   -- e.g. "Fiscal 2025"
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_cal_company ON planning_calendars (company_id)
    WHERE is_deleted = FALSE;

CREATE TABLE planning_periods (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    calendar_id   UUID NOT NULL REFERENCES planning_calendars(id),
    name          TEXT NOT NULL,           -- e.g. "Jan 2025"
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    period_type   TEXT NOT NULL DEFAULT 'month',   -- month | quarter | year
    sequence_order INTEGER NOT NULL,               -- 1, 2, 3 … for sorting
    is_locked     BOOLEAN DEFAULT FALSE,           -- prevent edits on closed periods

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uniq_period_seq UNIQUE (calendar_id, sequence_order)
);

CREATE INDEX idx_period_cal ON planning_periods (calendar_id)
    WHERE is_deleted = FALSE;

CREATE TABLE scenarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    company_id       UUID NOT NULL REFERENCES companies(id),
    name             TEXT NOT NULL,         -- e.g. "Series A Base Case"
    scenario_type    scenario_type NOT NULL,
    description      TEXT,
    base_scenario_id UUID REFERENCES scenarios(id),  -- supports cloning/inheritance

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_scenario_company ON scenarios (company_id)
    WHERE is_deleted = FALSE;

CREATE TABLE assumption_sets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    scenario_id         UUID NOT NULL REFERENCES scenarios(id),
    name                TEXT NOT NULL,           -- e.g. "v1.2 Inflated Costs"
    is_active           BOOLEAN DEFAULT TRUE,
    overall_confidence  confidence_level DEFAULT 'medium',
    owner_id            UUID,                    -- user responsible for this set
    review_cadence      TEXT,                    -- e.g. "Monthly"

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_aset_scenario ON assumption_sets (scenario_id)
    WHERE is_deleted = FALSE;

CREATE TABLE plan_versions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    company_id        UUID NOT NULL REFERENCES companies(id),
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    name              TEXT NOT NULL,              -- e.g. "Q1 2025 Board Submission"
    version_type      plan_version_type NOT NULL,
    status            plan_status NOT NULL DEFAULT 'draft',
    is_frozen         BOOLEAN DEFAULT FALSE,      -- read-only lock post-approval

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pv_scenario ON plan_versions (scenario_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_pv_company  ON plan_versions (company_id)
    WHERE is_deleted = FALSE;

CREATE TABLE governance_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    plan_version_id  UUID NOT NULL REFERENCES plan_versions(id),
    event_type       governance_event_type NOT NULL,
    user_id          UUID NOT NULL,
    details          JSONB,         -- full context snapshot of the change

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gov_pv   ON governance_events (plan_version_id);

CREATE INDEX idx_gov_user ON governance_events (user_id);

CREATE TABLE assumption_lineage (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID NOT NULL,
    assumption_set_id         UUID NOT NULL REFERENCES assumption_sets(id),
    parent_assumption_set_id  UUID REFERENCES assumption_sets(id),
    cloned_at                 TIMESTAMPTZ DEFAULT NOW(),
    change_reason             TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alin_set    ON assumption_lineage (assumption_set_id);

CREATE INDEX idx_alin_parent ON assumption_lineage (parent_assumption_set_id);

CREATE TABLE compute_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    scenario_id     UUID NOT NULL REFERENCES scenarios(id),
    version_id      UUID REFERENCES plan_versions(id),
    scope_bundle_id UUID,
    trigger_type    TEXT NOT NULL DEFAULT 'manual',
    status          TEXT NOT NULL DEFAULT 'queued',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    triggered_by    UUID,
    error_message   TEXT,
    run_config      JSONB,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_runs_company_scenario ON compute_runs (company_id, scenario_id);
CREATE INDEX idx_compute_runs_status ON compute_runs (status);

CREATE TABLE compute_run_steps (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compute_run_id UUID NOT NULL REFERENCES compute_runs(id) ON DELETE CASCADE,
    step_code      TEXT NOT NULL,
    step_label     TEXT NOT NULL,
    step_order     INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'queued',
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    output_summary JSONB,
    error_message  TEXT,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_run_steps_run ON compute_run_steps (compute_run_id, step_order);

CREATE TABLE compute_run_artifacts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compute_run_id UUID NOT NULL REFERENCES compute_runs(id) ON DELETE CASCADE,
    artifact_type  TEXT NOT NULL,
    artifact_ref   TEXT,
    row_count      INTEGER,
    checksum       TEXT,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_run_artifacts_run ON compute_run_artifacts (compute_run_id);

CREATE TABLE compute_dependency_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compute_run_id      UUID NOT NULL REFERENCES compute_runs(id) ON DELETE CASCADE,
    snapshot_hash       TEXT,
    dependency_manifest JSONB,
    assumption_set_ids  JSONB,
    scope_bundle_state  JSONB,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_dependency_snapshots_run ON compute_dependency_snapshots (compute_run_id);

CREATE TABLE compute_validation_results (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compute_run_id   UUID REFERENCES compute_runs(id) ON DELETE CASCADE,
    validation_job_id UUID NOT NULL,
    issue_code       TEXT NOT NULL,
    severity         TEXT NOT NULL,
    stage_family     TEXT,
    surface_code     TEXT,
    entity_type      TEXT,
    entity_id        UUID,
    message          TEXT NOT NULL,
    resolution_state TEXT NOT NULL DEFAULT 'open',
    resolved_by      UUID,
    resolved_at      TIMESTAMPTZ,
    metadata         JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_validation_job ON compute_validation_results (validation_job_id);
CREATE INDEX idx_compute_validation_run ON compute_validation_results (compute_run_id);

CREATE TABLE countries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    company_id    UUID NOT NULL REFERENCES companies(id),
    name          TEXT NOT NULL,
    iso_code      TEXT NOT NULL,   -- ISO 3166-1 alpha-2
    currency_code currency_code NOT NULL,
    gdp_per_capita_usd     DECIMAL(19,4),
    population             BIGINT,
    food_delivery_index    DECIMAL(5,2),  -- 0-100 market maturity score

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE clusters (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    country_id UUID NOT NULL REFERENCES countries(id),
    name       TEXT NOT NULL,
    notes      TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE macros (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    cluster_id  UUID NOT NULL REFERENCES clusters(id),
    name        TEXT NOT NULL,
    population  BIGINT,
    avg_rent_per_sqm DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE micros (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    macro_id             UUID NOT NULL REFERENCES macros(id),
    name                 TEXT NOT NULL,
    attractiveness_score DECIMAL(5,2),   -- 0-100 composite score
    competition_index    DECIMAL(5,2),   -- 0-100 (100 = saturated)
    delivery_demand_proxy DECIMAL(19,4), -- estimated monthly orders in area

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE kitchens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    micro_id     UUID NOT NULL REFERENCES micros(id),
    name         TEXT NOT NULL,
    format       kitchen_format NOT NULL,
    launch_date  DATE,
    sqm          DECIMAL(8,2),
    status       TEXT DEFAULT 'planned',   -- planned | active | closed
    max_capacity_orders_day INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE platforms (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    company_id            UUID NOT NULL REFERENCES companies(id),
    name                  TEXT NOT NULL,
    platform_type         platform_type NOT NULL,
    base_commission_pct   DECIMAL(5,4),  -- 0.2500 = 25%
    payout_lag_days       INTEGER DEFAULT 7,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE product_families (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    company_id   UUID NOT NULL REFERENCES companies(id),
    name         TEXT NOT NULL,
    family_type  product_family_type NOT NULL,
    avg_prep_mins INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE competitor_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    micro_id    UUID REFERENCES micros(id),
    name        TEXT NOT NULL,
    price_index DECIMAL(5,2),  -- 1.0 = parity, 1.1 = 10% premium vs us
    platform_ids UUID[],       -- platforms they operate on

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE demand_drivers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    assumption_set_id   UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id          UUID REFERENCES kitchens(id),       -- NULL = market-level
    platform_id         UUID REFERENCES platforms(id),
    planning_period_id  UUID NOT NULL REFERENCES planning_periods(id),
    base_orders         DECIMAL(19,4) NOT NULL,
    growth_rate         DECIMAL(7,6),                       -- monthly growth rate
    seasonality_index   DECIMAL(5,4) DEFAULT 1.0,
    marketing_uplift    DECIMAL(5,4) DEFAULT 0.0,
    penetration_rate    DECIMAL(5,4),                       -- % of target market captured

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    assumption_set_id    UUID NOT NULL REFERENCES assumption_sets(id),
    product_family_id    UUID NOT NULL REFERENCES product_families(id),
    planning_period_id   UUID NOT NULL REFERENCES planning_periods(id),
    gross_list_price     DECIMAL(19,4) NOT NULL,
    discount_rate        DECIMAL(5,4) DEFAULT 0.0,
    net_realized_price   DECIMAL(19,4)
        GENERATED ALWAYS AS (gross_list_price * (1 - discount_rate)) STORED,
    platform_commission_override DECIMAL(5,4),   -- overrides platform default

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mix_plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    assumption_set_id    UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id           UUID REFERENCES kitchens(id),
    product_family_id    UUID NOT NULL REFERENCES product_families(id),
    planning_period_id   UUID NOT NULL REFERENCES planning_periods(id),
    mix_percentage       DECIMAL(5,4) NOT NULL,  -- must sum to 1.0 per kitchen/period
    attach_rate          DECIMAL(5,2),           -- sides/beverages attach per order

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE revenue_projection_lines (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL,
    scenario_id              UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id       UUID NOT NULL REFERENCES planning_periods(id),
    kitchen_id               UUID NOT NULL REFERENCES kitchens(id),
    product_family_id        UUID NOT NULL REFERENCES product_families(id),
    platform_id              UUID NOT NULL REFERENCES platforms(id),
    projected_volume         DECIMAL(19,4) NOT NULL,
    projected_gross_revenue  DECIMAL(19,4) NOT NULL,
    projected_net_revenue    DECIMAL(19,4) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assumption_confidence (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    entity_type       TEXT NOT NULL,           -- 'demand', 'price', 'cost' etc.
    entity_id         UUID NOT NULL,           -- FK to the specific driver record
    confidence_level  confidence_level NOT NULL,
    evidence_source   evidence_source NOT NULL,
    notes             TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE unit_cost_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    assumption_set_id       UUID NOT NULL REFERENCES assumption_sets(id),
    product_family_id       UUID NOT NULL REFERENCES product_families(id),
    planning_period_id      UUID NOT NULL REFERENCES planning_periods(id),
    food_cost_per_unit      DECIMAL(19,4) NOT NULL,
    packaging_cost_per_unit DECIMAL(19,4) NOT NULL,
    wastage_percentage      DECIMAL(5,4) DEFAULT 0.03,
    platform_bag_fee        DECIMAL(19,4) DEFAULT 0.0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE labor_models (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    role_name         TEXT NOT NULL,        -- 'Head Chef', 'Packer', 'Rider'
    monthly_cost      DECIMAL(19,4) NOT NULL,
    annual_increment_pct DECIMAL(5,4) DEFAULT 0.05,
    benefits_pct      DECIMAL(5,4) DEFAULT 0.10,
    hiring_trigger    hiring_trigger_type,
    trigger_value     DECIMAL(19,4),        -- e.g. 100 orders/day threshold

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE headcount_plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    kitchen_id        UUID REFERENCES kitchens(id),
    role_name         TEXT NOT NULL,
    headcount         DECIMAL(10,2) NOT NULL,   -- supports fractional FTEs
    total_cost        DECIMAL(19,4) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opex_plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id        UUID REFERENCES kitchens(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    category          TEXT NOT NULL,            -- 'Rent', 'Utilities', 'Tech SaaS'
    amount            DECIMAL(19,4) NOT NULL,
    cost_behavior     cost_behavior NOT NULL DEFAULT 'fixed',
    notes             TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing_plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id        UUID REFERENCES kitchens(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    channel           TEXT NOT NULL,            -- 'Google', 'Meta', 'Influencer'
    budget            DECIMAL(19,4) NOT NULL,
    target_cac        DECIMAL(19,4),
    expected_orders_uplift DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE capex_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    assumption_set_id   UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id          UUID REFERENCES kitchens(id),
    planning_period_id  UUID NOT NULL REFERENCES planning_periods(id),
    item_name           TEXT NOT NULL,          -- 'Pizza Oven', 'Fit-out'
    amount              DECIMAL(19,4) NOT NULL,
    depreciation_months INTEGER,
    capex_category      TEXT DEFAULT 'equipment', -- equipment | fitout | tech | permits

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE working_capital_policies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    receivable_days   INTEGER DEFAULT 7,     -- platform payout lag
    payable_days      INTEGER DEFAULT 30,    -- supplier payment terms
    inventory_days    INTEGER DEFAULT 7,     -- stock holding target

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equity_rounds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    scenario_id         UUID NOT NULL REFERENCES scenarios(id),
    round_name          TEXT NOT NULL,          -- 'Pre-Seed', 'Seed', 'Series A'
    close_date          DATE NOT NULL,
    amount_raised       DECIMAL(19,4) NOT NULL,
    valuation_pre_money DECIMAL(19,4),
    lead_investor       TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE debt_facilities (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    scenario_id          UUID NOT NULL REFERENCES scenarios(id),
    lender_name          TEXT NOT NULL,
    principal_amount     DECIMAL(19,4) NOT NULL,
    interest_rate_annual DECIMAL(5,4) NOT NULL,
    start_date           DATE NOT NULL,
    term_months          INTEGER NOT NULL,
    facility_type        TEXT DEFAULT 'term_loan', -- term_loan | revolving | overdraft

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE debt_repayment_schedules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    debt_facility_id  UUID NOT NULL REFERENCES debt_facilities(id),
    payment_date      DATE NOT NULL,
    principal_portion DECIMAL(19,4) NOT NULL,
    interest_portion  DECIMAL(19,4) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE capital_allocation_plans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    scenario_id      UUID NOT NULL REFERENCES scenarios(id),
    market_id        UUID REFERENCES clusters(id),
    allocated_amount DECIMAL(19,4) NOT NULL,
    allocation_label TEXT,   -- 'Kitchen Fit-out', 'Working Capital', 'Marketing'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dilution_models (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    scenario_id         UUID NOT NULL REFERENCES scenarios(id),
    founder_equity_pct  DECIMAL(5,4),
    investor_equity_pct DECIMAL(5,4),
    esop_pool_pct       DECIMAL(5,4),
    notes               TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pnl_projections (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    geographic_level  geographic_level NOT NULL,
    entity_id         UUID NOT NULL,            -- points to kitchen/micro/macro/cluster

    -- Revenue
    gross_revenue     DECIMAL(19,4) DEFAULT 0,
    platform_commission DECIMAL(19,4) DEFAULT 0,
    discounts         DECIMAL(19,4) DEFAULT 0,
    net_revenue       DECIMAL(19,4) DEFAULT 0,

    -- Costs
    cogs_total        DECIMAL(19,4) DEFAULT 0,
    gross_profit      DECIMAL(19,4) DEFAULT 0,
    labor_cost        DECIMAL(19,4) DEFAULT 0,
    marketing_cost    DECIMAL(19,4) DEFAULT 0,
    opex_total        DECIMAL(19,4) DEFAULT 0,

    -- Earnings
    ebitda            DECIMAL(19,4) DEFAULT 0,
    depreciation      DECIMAL(19,4) DEFAULT 0,
    ebit              DECIMAL(19,4) DEFAULT 0,
    interest_expense  DECIMAL(19,4) DEFAULT 0,
    net_income        DECIMAL(19,4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cashflow_projections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    scenario_id           UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id    UUID NOT NULL REFERENCES planning_periods(id),
    opening_balance       DECIMAL(19,4) NOT NULL,
    operating_cashflow    DECIMAL(19,4) NOT NULL,
    investing_cashflow    DECIMAL(19,4) NOT NULL,
    financing_cashflow    DECIMAL(19,4) NOT NULL,
    net_change            DECIMAL(19,4) NOT NULL,
    closing_balance       DECIMAL(19,4) NOT NULL,
    cash_runway_months    DECIMAL(5,1),           -- computed: balance / monthly burn

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE balance_sheet_projections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    scenario_id         UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id  UUID NOT NULL REFERENCES planning_periods(id),

    -- Assets
    cash_assets         DECIMAL(19,4) DEFAULT 0,
    inventory_assets    DECIMAL(19,4) DEFAULT 0,
    receivables         DECIMAL(19,4) DEFAULT 0,
    fixed_assets_gross  DECIMAL(19,4) DEFAULT 0,
    accumulated_depreciation DECIMAL(19,4) DEFAULT 0,
    fixed_assets_net    DECIMAL(19,4) DEFAULT 0,
    total_assets        DECIMAL(19,4) DEFAULT 0,

    -- Liabilities
    accounts_payable    DECIMAL(19,4) DEFAULT 0,
    short_term_debt     DECIMAL(19,4) DEFAULT 0,
    long_term_debt      DECIMAL(19,4) DEFAULT 0,
    total_liabilities   DECIMAL(19,4) DEFAULT 0,

    -- Equity
    paid_in_capital     DECIMAL(19,4) DEFAULT 0,
    retained_earnings   DECIMAL(19,4) DEFAULT 0,
    total_equity        DECIMAL(19,4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE unit_economics_projections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    scenario_id             UUID NOT NULL REFERENCES scenarios(id),
    kitchen_id              UUID NOT NULL REFERENCES kitchens(id),
    planning_period_id      UUID NOT NULL REFERENCES planning_periods(id),
    aov                     DECIMAL(19,4),   -- average order value
    cac                     DECIMAL(19,4),   -- customer acquisition cost
    clv                     DECIMAL(19,4),   -- customer lifetime value (12-month)
    orders_per_day          DECIMAL(8,2),
    contribution_margin_1   DECIMAL(19,4),   -- after food cost + packaging
    contribution_margin_2   DECIMAL(19,4),   -- after labor + marketing
    ebitda_per_order        DECIMAL(19,4),
    payback_months          INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kpi_projections (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    kpi_name          TEXT NOT NULL,        -- 'Burn Rate', 'Runway', 'IRR', 'ROIC'
    kpi_category      kpi_category NOT NULL,
    kpi_value         DECIMAL(19,4) NOT NULL,
    target_value      DECIMAL(19,4),
    traffic_light     TEXT,                 -- 'green' | 'amber' | 'red'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kpi_scenario ON kpi_projections (scenario_id, planning_period_id);

CREATE TABLE driver_explainability (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    scenario_id    UUID NOT NULL REFERENCES scenarios(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    target_metric  TEXT NOT NULL,           -- 'EBITDA', 'Net Revenue', 'Burn Rate'
    driver_name    TEXT NOT NULL,           -- 'Food Cost Increase', 'Volume Growth'
    impact_amount  DECIMAL(19,4) NOT NULL,  -- positive = benefit, negative = drag
    display_order  INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE variance_attribution (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    plan_version_a    UUID NOT NULL REFERENCES plan_versions(id),
    plan_version_b    UUID NOT NULL REFERENCES plan_versions(id),
    planning_period_id UUID REFERENCES planning_periods(id),
    metric_name       TEXT NOT NULL,
    variance_amount   DECIMAL(19,4) NOT NULL,
    attribution_factor TEXT,               -- 'Volume', 'Rate', 'Mix', 'Timing'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE performance_alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    scenario_id   UUID NOT NULL REFERENCES scenarios(id),
    alert_name    TEXT NOT NULL,
    severity      alert_severity NOT NULL,
    message       TEXT NOT NULL,
    is_resolved   BOOLEAN DEFAULT FALSE,
    resolved_at   TIMESTAMPTZ,
    resolved_by   UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_scenario ON performance_alerts (scenario_id)
    WHERE is_resolved = FALSE;

CREATE TABLE risk_objects (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    name             TEXT NOT NULL,         -- 'Cheese Price Spike'
    category         risk_category NOT NULL,
    likelihood       risk_likelihood NOT NULL,
    impact           risk_impact NOT NULL,
    risk_score       DECIMAL(5,2),          -- computed: likelihood × impact (1-25)
    mitigation_plan  TEXT,
    owner_id         UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk_scenarios (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL,
    risk_object_id           UUID NOT NULL REFERENCES risk_objects(id),
    scenario_id              UUID NOT NULL REFERENCES scenarios(id),
    probability_pct          DECIMAL(5,4),
    financial_impact_estimate DECIMAL(19,4),
    time_to_materialise_months INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE monte_carlo_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    scenario_id UUID NOT NULL REFERENCES scenarios(id),
    iterations  INTEGER NOT NULL DEFAULT 1000,
    status      TEXT DEFAULT 'running',     -- running | completed | failed
    run_params  JSONB,                      -- variable distributions used
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE monte_carlo_summaries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    run_id       UUID NOT NULL REFERENCES monte_carlo_runs(id),
    metric_name  TEXT NOT NULL,
    p10_value    DECIMAL(19,4),
    p25_value    DECIMAL(19,4),
    p50_value    DECIMAL(19,4),
    p75_value    DECIMAL(19,4),
    p90_value    DECIMAL(19,4),
    mean_value   DECIMAL(19,4),
    std_dev      DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trigger_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    scenario_id   UUID NOT NULL REFERENCES scenarios(id),
    trigger_type  expansion_trigger_type NOT NULL,
    triggered_at  TIMESTAMPTZ DEFAULT NOW(),
    entity_type   TEXT,                    -- 'kitchen', 'micro', 'macro'
    entity_id     UUID,
    action_taken  TEXT,
    auto_actioned BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE simulation_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    scenario_id     UUID NOT NULL REFERENCES scenarios(id),
    simulator_type  simulator_type NOT NULL,
    name            TEXT NOT NULL,
    input_params    JSONB NOT NULL,   -- slider values / parameter overrides
    status          TEXT DEFAULT 'pending',
    created_by      UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE simulation_results (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    run_id         UUID NOT NULL REFERENCES simulation_runs(id),
    metric_name    TEXT NOT NULL,
    metric_value   DECIMAL(19,4) NOT NULL,
    planning_period_id UUID REFERENCES planning_periods(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sensitivity_analyses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    variable_name     TEXT NOT NULL,
    sensitivity_type  sensitivity_type NOT NULL,
    base_value        DECIMAL(19,4),
    delta_pct         DECIMAL(5,4),   -- e.g. 0.10 = +10% shock
    impact_on_ebitda  DECIMAL(19,4),
    impact_on_npv     DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scenario_comparisons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    name              TEXT NOT NULL,
    scenario_ids      UUID[],            -- 2–4 scenarios to compare
    metric_names      TEXT[],            -- metrics to display
    created_by        UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expansion_plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    plan_name         TEXT NOT NULL,
    target_kitchen_count INTEGER,
    target_period_id  UUID REFERENCES planning_periods(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expansion_phases (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    expansion_plan_id UUID NOT NULL REFERENCES expansion_plans(id),
    phase_number      INTEGER NOT NULL,
    phase_name        TEXT NOT NULL,    -- 'Pilot', 'Scale', 'National'
    start_period_id   UUID REFERENCES planning_periods(id),
    end_period_id     UUID REFERENCES planning_periods(id),
    kitchen_target    INTEGER,
    capex_budget      DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attractiveness_scores (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    scenario_id        UUID NOT NULL REFERENCES scenarios(id),
    micro_id           UUID NOT NULL REFERENCES micros(id),
    demand_score       DECIMAL(5,2),   -- 0-100
    competition_score  DECIMAL(5,2),   -- 0-100 (inverted: low comp = high score)
    cost_score         DECIMAL(5,2),   -- 0-100 (low rent/labor = high score)
    strategic_score    DECIMAL(5,2),   -- 0-100
    composite_score    DECIMAL(5,2),   -- weighted composite
    recommended        BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_ramp_curves (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    kitchen_id        UUID NOT NULL REFERENCES kitchens(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    ramp_factor       DECIMAL(5,4) NOT NULL,  -- 0.1 in month 1, 1.0 at maturity
    months_to_maturity INTEGER DEFAULT 12,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE platform_promotions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    assumption_set_id  UUID NOT NULL REFERENCES assumption_sets(id),
    platform_id        UUID NOT NULL REFERENCES platforms(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    promo_name         TEXT NOT NULL,
    discount_pct       DECIMAL(5,4) NOT NULL,
    orders_uplift_pct  DECIMAL(5,4),
    cost_to_company    DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_plans (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    scenario_id    UUID NOT NULL REFERENCES scenarios(id),
    name           TEXT NOT NULL,          -- 'UAE 2026 Portfolio'
    optimization_objective TEXT DEFAULT 'max_irr',  -- max_irr | min_burn | balanced
    total_capital  DECIMAL(19,4) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_market_allocations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    portfolio_plan_id UUID NOT NULL REFERENCES portfolio_plans(id),
    market_id         UUID NOT NULL REFERENCES micros(id),
    priority_rank     INTEGER,
    allocated_capital DECIMAL(19,4) NOT NULL,
    target_kitchens   INTEGER DEFAULT 1,
    projected_irr     DECIMAL(5,4),
    projected_payback_months INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_kpi_rollups (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    portfolio_plan_id UUID NOT NULL REFERENCES portfolio_plans(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    total_revenue     DECIMAL(19,4),
    total_ebitda      DECIMAL(19,4),
    portfolio_irr     DECIMAL(5,4),
    total_capex       DECIMAL(19,4),
    total_kitchens    INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scenario_sensitivity_matrices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    scenario_id       UUID NOT NULL REFERENCES scenarios(id),
    variable_x        TEXT NOT NULL,       -- e.g. 'commission_rate'
    variable_y        TEXT NOT NULL,       -- e.g. 'food_cost_pct'
    matrix_data       JSONB NOT NULL,      -- 2D grid of EBITDA / NPV outputs
    target_metric     TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE decision_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    plan_version_id  UUID NOT NULL REFERENCES plan_versions(id),
    decision_title   TEXT NOT NULL,
    decision_type    TEXT NOT NULL,        -- 'expansion', 'pricing', 'capex', 'hire'
    decision_context TEXT,                 -- market conditions at time of decision
    rationale        TEXT,
    decided_by       UUID,
    decided_at       TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE decision_outcomes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    decision_record_id UUID NOT NULL REFERENCES decision_records(id),
    review_date       DATE NOT NULL,
    outcome_summary   TEXT,
    financial_variance DECIMAL(19,4),     -- actual vs projected delta
    lesson_learned    TEXT,
    reviewed_by       UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assumption_override_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
    field_name        TEXT NOT NULL,
    old_value         TEXT,
    new_value         TEXT,
    override_reason   TEXT,
    overridden_by     UUID NOT NULL,
    overridden_at     TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_workflows (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    plan_version_id   UUID NOT NULL REFERENCES plan_versions(id),
    approver_id       UUID NOT NULL,
    approval_status   approval_status NOT NULL DEFAULT 'pending',
    comments          TEXT,
    actioned_at       TIMESTAMPTZ,
    approval_step     INTEGER DEFAULT 1,  -- supports multi-step workflows

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_headers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    kitchen_id      UUID NOT NULL REFERENCES kitchens(id),
    platform_id     UUID NOT NULL REFERENCES platforms(id),
    order_placed_at TIMESTAMPTZ NOT NULL,
    gross_value     DECIMAL(19,4) NOT NULL,
    discount_amount DECIMAL(19,4) DEFAULT 0,
    net_value       DECIMAL(19,4) NOT NULL,
    status          TEXT DEFAULT 'delivered',  -- delivered | cancelled | refunded

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    order_id          UUID NOT NULL REFERENCES order_headers(id) ON DELETE CASCADE,
    product_sku_id    UUID,                -- links to product_skus when available
    product_family_id UUID REFERENCES product_families(id),
    quantity          INTEGER NOT NULL DEFAULT 1,
    unit_price        DECIMAL(19,4) NOT NULL,
    line_total        DECIMAL(19,4) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_skus (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    product_family_id UUID NOT NULL REFERENCES product_families(id),
    name              TEXT NOT NULL,
    base_price        DECIMAL(19,4) NOT NULL,
    food_cost         DECIMAL(19,4),
    prep_time_mins    INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE actuals_bridge (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    plan_version_id   UUID NOT NULL REFERENCES plan_versions(id),
    planning_period_id UUID NOT NULL REFERENCES planning_periods(id),
    metric_name       TEXT NOT NULL,
    projected_value   DECIMAL(19,4),
    actual_value      DECIMAL(19,4),
    variance_amount   DECIMAL(19,4),
    variance_type     variance_type,
    actuals_source    actuals_source NOT NULL,
    ingested_at       TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE intraday_demand_slots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    kitchen_id        UUID NOT NULL REFERENCES kitchens(id),
    slot_date         DATE NOT NULL,
    slot_hour         INTEGER NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
    projected_orders  DECIMAL(8,2),
    actual_orders     INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_cohorts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    kitchen_id        UUID REFERENCES kitchens(id),
    cohort_month      DATE NOT NULL,              -- month of first order
    cohort_size       INTEGER NOT NULL,
    m1_retention      DECIMAL(5,4),
    m3_retention      DECIMAL(5,4),
    m6_retention      DECIMAL(5,4),
    m12_retention     DECIMAL(5,4),
    avg_clv_12m       DECIMAL(19,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_versions_co_sc ON plan_versions (company_id, scenario_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_periods_calendar ON planning_periods (calendar_id, sequence_order)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_demand_aset_period ON demand_drivers
    (assumption_set_id, planning_period_id);

CREATE INDEX idx_price_aset_period ON price_plans
    (assumption_set_id, planning_period_id, product_family_id);

CREATE INDEX idx_mix_aset_period ON mix_plans
    (assumption_set_id, planning_period_id, kitchen_id);

CREATE INDEX idx_opex_aset_period ON opex_plans
    (assumption_set_id, planning_period_id);

CREATE INDEX idx_pnl_scenario_period ON pnl_projections
    (scenario_id, planning_period_id, geographic_level);

CREATE INDEX idx_pnl_entity ON pnl_projections
    (entity_id, planning_period_id);

CREATE INDEX idx_cf_scenario_period ON cashflow_projections
    (scenario_id, planning_period_id);

CREATE INDEX idx_ue_kitchen_period ON unit_economics_projections
    (kitchen_id, planning_period_id, scenario_id);

CREATE INDEX idx_rev_proj_composite ON revenue_projection_lines
    (scenario_id, kitchen_id, platform_id, planning_period_id);

CREATE INDEX idx_kpi_sc_period ON kpi_projections
    (scenario_id, planning_period_id, kpi_name);

CREATE INDEX idx_driver_explain ON driver_explainability
    (scenario_id, planning_period_id, target_metric);

CREATE INDEX idx_risk_scenario ON risk_scenarios
    (scenario_id, risk_object_id);

CREATE INDEX idx_mc_summaries ON monte_carlo_summaries
    (run_id, metric_name);

CREATE INDEX idx_sim_results ON simulation_results
    (run_id, metric_name);

CREATE INDEX idx_sensitivity ON sensitivity_analyses
    (scenario_id, sensitivity_type);

CREATE INDEX idx_gov_events_pv ON governance_events
    (plan_version_id, created_at DESC);

CREATE INDEX idx_approval_pv ON approval_workflows
    (plan_version_id, approval_status);

CREATE INDEX idx_trigger_log_sc ON trigger_log
    (scenario_id, triggered_at DESC);

CREATE INDEX idx_kitchens_micro ON kitchens (micro_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_micros_macro ON micros (macro_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_macros_cluster ON macros (cluster_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_clusters_country ON clusters (country_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_companies_name_trgm ON companies
    USING GIN (name gin_trgm_ops);

CREATE INDEX idx_kitchens_name_trgm ON kitchens
    USING GIN (name gin_trgm_ops);
