INSERT INTO companies (
    id, tenant_id, name, base_currency, fiscal_year_start_month, country_code
) VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'PizzaCo Dark Kitchen Operations',
    'AED',
    1,
    'AE'
);

INSERT INTO planning_calendars (
    id, tenant_id, company_id, name, start_date, end_date
) VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Fiscal Year 2025',
    '2025-01-01',
    '2025-12-31'
);

DO $$
DECLARE
    cal_id UUID := 'bbbbbbbb-0000-0000-0000-000000000001';
    t_id   UUID := '10000000-0000-4000-8000-000000000001';
    month_names TEXT[] := ARRAY[
        'Jan 2025','Feb 2025','Mar 2025','Apr 2025',
        'May 2025','Jun 2025','Jul 2025','Aug 2025',
        'Sep 2025','Oct 2025','Nov 2025','Dec 2025'
    ];
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        INSERT INTO planning_periods (
            tenant_id, calendar_id, name, start_date, end_date,
            period_type, sequence_order
        ) VALUES (
            t_id, cal_id,
            month_names[i],
            DATE_TRUNC('month', ('2025-01-01'::DATE + ((i-1) || ' months')::INTERVAL)),
            DATE_TRUNC('month', ('2025-01-01'::DATE + (i || ' months')::INTERVAL)) - INTERVAL '1 day',
            'month',
            i
        );
    END LOOP;
END $$;

INSERT INTO scenarios (id, tenant_id, company_id, name, scenario_type, description)
VALUES
    ('cccccccc-0001-0000-0000-000000000001',
     '10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Base Case 2025', 'base',
     'Realistic central case: avg growth, stable food costs, on-plan expansion'),

    ('cccccccc-0002-0000-0000-000000000001',
     '10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Bull Case 2025', 'bull_case',
     '20% volume upside, lower CAC, faster market ramp'),

    ('cccccccc-0003-0000-0000-000000000001',
     '10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Bear Case 2025', 'bear_case',
     'Slower ramp, food cost +15%, platform commission increase'),

    ('cccccccc-0004-0000-0000-000000000001',
     '10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Stress Test 2025', 'stress_test',
     'Commission spike to 35%, food cost +25%, delayed expansion by 2 months');

INSERT INTO assumption_sets (
    tenant_id, scenario_id, name, overall_confidence, review_cadence
)
SELECT
    '10000000-0000-4000-8000-000000000001',
    id,
    name || ' — Assumptions v1.0',
    'medium',
    'Monthly'
FROM scenarios
WHERE tenant_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO plan_versions (
    id, tenant_id, company_id, scenario_id, assumption_set_id, name, version_type, status, is_frozen
)
SELECT
    CASE s.id
      WHEN 'cccccccc-0001-0000-0000-000000000001' THEN 'dddddddd-0001-4000-8000-000000000001'::UUID
      WHEN 'cccccccc-0002-0000-0000-000000000001' THEN 'dddddddd-0002-4000-8000-000000000001'::UUID
      WHEN 'cccccccc-0003-0000-0000-000000000001' THEN 'dddddddd-0003-4000-8000-000000000001'::UUID
      WHEN 'cccccccc-0004-0000-0000-000000000001' THEN 'dddddddd-0004-4000-8000-000000000001'::UUID
      ELSE gen_random_uuid()
    END,
    s.tenant_id,
    s.company_id,
    s.id,
    aset.id,
    s.name || ' Forecast v1',
    'forecast',
    'draft',
    FALSE
FROM scenarios s
JOIN assumption_sets aset
  ON aset.scenario_id = s.id
WHERE s.tenant_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO countries (tenant_id, company_id, name, iso_code, currency_code)
VALUES (
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'United Arab Emirates', 'AE', 'AED'
);

INSERT INTO clusters (tenant_id, country_id, name)
SELECT '10000000-0000-4000-8000-000000000001', id, 'Dubai'
FROM countries WHERE iso_code = 'AE'
    AND tenant_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO macros (tenant_id, cluster_id, name)
SELECT '10000000-0000-4000-8000-000000000001', id, 'Dubai City'
FROM clusters WHERE name = 'Dubai'
    AND tenant_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO micros (tenant_id, macro_id, name, attractiveness_score)
SELECT '10000000-0000-4000-8000-000000000001', id, 'Jumeirah Lake Towers', 78.5
FROM macros WHERE name = 'Dubai City'
    AND tenant_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO platforms (tenant_id, company_id, name, platform_type, base_commission_pct, payout_lag_days)
VALUES
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Talabat', 'aggregator', 0.2800, 14),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Deliveroo', 'aggregator', 0.3000, 7),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Uber Eats', 'aggregator', 0.3000, 7),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Own App', 'own_app', 0.0, 1);

INSERT INTO product_families (tenant_id, company_id, name, family_type, avg_prep_mins)
VALUES
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Pizza', 'pizza', 18),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Sides', 'sides', 8),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Beverages', 'beverages', 2),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Desserts', 'desserts', 6),
    ('10000000-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Combos', 'combos', 20);

INSERT INTO kitchens (
    id, tenant_id, micro_id, name, format, launch_date, sqm, status, max_capacity_orders_day
)
SELECT
    'eeeeeeee-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    id,
    'JLT Flagship Kitchen',
    'standard_dark',
    '2024-11-01',
    145.0,
    'active',
    420
FROM micros
WHERE name = 'Jumeirah Lake Towers'
  AND tenant_id = '10000000-0000-4000-8000-000000000001';

-- Seed a coherent 12-month financial model for each seeded scenario so the
-- canonical finance and compute routes have live, non-zero outputs on a clean bootstrap.
CREATE TEMP TABLE seed_projection_base AS
WITH scenario_factors AS (
    SELECT *
    FROM (VALUES
        (
            'cccccccc-0001-0000-0000-000000000001'::UUID,
            1.00::DECIMAL(10,4), 1.00::DECIMAL(10,4), 0.2800::DECIMAL(10,4), 0.0350::DECIMAL(10,4),
            1.00::DECIMAL(10,4), 1.00::DECIMAL(10,4), 1.00::DECIMAL(10,4), 1.00::DECIMAL(10,4), 1.00::DECIMAL(10,4),
            900000::DECIMAL(19,4), 320000::DECIMAL(19,4), 0::DECIMAL(19,4), 280000::DECIMAL(19,4), 1850000::DECIMAL(19,4),
            28.0::DECIMAL(10,4), 19.0::DECIMAL(10,4),
            14000::DECIMAL(19,4), 9000::DECIMAL(19,4), -8000::DECIMAL(19,4), 5000::DECIMAL(19,4), -4500::DECIMAL(19,4)
        ),
        (
            'cccccccc-0002-0000-0000-000000000001'::UUID,
            1.18::DECIMAL(10,4), 1.04::DECIMAL(10,4), 0.2650::DECIMAL(10,4), 0.0250::DECIMAL(10,4),
            0.96::DECIMAL(10,4), 0.95::DECIMAL(10,4), 0.92::DECIMAL(10,4), 1.02::DECIMAL(10,4), 1.10::DECIMAL(10,4),
            980000::DECIMAL(19,4), 280000::DECIMAL(19,4), 0::DECIMAL(19,4), 260000::DECIMAL(19,4), 1900000::DECIMAL(19,4),
            34.0::DECIMAL(10,4), 25.0::DECIMAL(10,4),
            24000::DECIMAL(19,4), 16000::DECIMAL(19,4), -6000::DECIMAL(19,4), 9000::DECIMAL(19,4), -2500::DECIMAL(19,4)
        ),
        (
            'cccccccc-0003-0000-0000-000000000001'::UUID,
            0.87::DECIMAL(10,4), 0.99::DECIMAL(10,4), 0.3000::DECIMAL(10,4), 0.0500::DECIMAL(10,4),
            1.12::DECIMAL(10,4), 1.05::DECIMAL(10,4), 1.08::DECIMAL(10,4), 1.08::DECIMAL(10,4), 1.05::DECIMAL(10,4),
            760000::DECIMAL(19,4), 250000::DECIMAL(19,4), 200000::DECIMAL(19,4), 360000::DECIMAL(19,4), 1800000::DECIMAL(19,4),
            16.0::DECIMAL(10,4), 11.0::DECIMAL(10,4),
            -9000::DECIMAL(19,4), 2000::DECIMAL(19,4), -18000::DECIMAL(19,4), -7000::DECIMAL(19,4), -11000::DECIMAL(19,4)
        ),
        (
            'cccccccc-0004-0000-0000-000000000001'::UUID,
            0.76::DECIMAL(10,4), 0.97::DECIMAL(10,4), 0.3300::DECIMAL(10,4), 0.0600::DECIMAL(10,4),
            1.20::DECIMAL(10,4), 1.10::DECIMAL(10,4), 1.12::DECIMAL(10,4), 1.12::DECIMAL(10,4), 1.08::DECIMAL(10,4),
            650000::DECIMAL(19,4), 300000::DECIMAL(19,4), 350000::DECIMAL(19,4), 420000::DECIMAL(19,4), 1750000::DECIMAL(19,4),
            9.0::DECIMAL(10,4), 6.0::DECIMAL(10,4),
            -18000::DECIMAL(19,4), -4000::DECIMAL(19,4), -26000::DECIMAL(19,4), -12000::DECIMAL(19,4), -18000::DECIMAL(19,4)
        )
    ) AS sf (
        scenario_id,
        volume_mult, price_mult, commission_rate, discount_rate,
        cogs_mult, labor_mult, marketing_mult, opex_mult, capex_mult,
        initial_cash, financing_m1, financing_m7, debt_balance, paid_in_capital,
        irr_pct, roic_pct,
        bridge_volume, bridge_pricing, bridge_food, bridge_labor, bridge_platform
    )
),
periods AS (
    SELECT
        pp.id AS planning_period_id,
        pp.sequence_order,
        pp.start_date,
        pp.end_date,
        (pp.end_date - pp.start_date + 1) AS day_count
    FROM planning_periods pp
    JOIN planning_calendars pc ON pc.id = pp.calendar_id
    WHERE pc.company_id = 'aaaaaaaa-0000-0000-0000-000000000001'::UUID
      AND pc.is_deleted = FALSE
      AND pp.is_deleted = FALSE
),
base0 AS (
    SELECT
        '10000000-0000-4000-8000-000000000001'::UUID AS tenant_id,
        sf.scenario_id,
        p.planning_period_id,
        p.sequence_order,
        p.day_count,
        sf.volume_mult,
        sf.price_mult,
        sf.commission_rate,
        sf.discount_rate,
        sf.cogs_mult,
        sf.labor_mult,
        sf.marketing_mult,
        sf.opex_mult,
        sf.capex_mult,
        sf.initial_cash,
        sf.financing_m1,
        sf.financing_m7,
        sf.debt_balance,
        sf.paid_in_capital,
        sf.irr_pct,
        sf.roic_pct,
        sf.bridge_volume,
        sf.bridge_pricing,
        sf.bridge_food,
        sf.bridge_labor,
        sf.bridge_platform,
        ROUND((7800 + (p.sequence_order * 340)) * sf.volume_mult, 4) AS projected_volume,
        ROUND((420000 + (p.sequence_order * 24000)) * sf.volume_mult * sf.price_mult, 4) AS gross_revenue
    FROM scenario_factors sf
    CROSS JOIN periods p
),
pnl0 AS (
    SELECT
        *,
        ROUND(gross_revenue * commission_rate, 4) AS platform_commission,
        ROUND(gross_revenue * discount_rate, 4) AS discounts,
        ROUND(gross_revenue * (1 - commission_rate - discount_rate), 4) AS net_revenue
    FROM base0
),
pnl1 AS (
    SELECT
        *,
        ROUND(net_revenue * (0.30 + (sequence_order * 0.0015)) * cogs_mult, 4) AS cogs_total,
        ROUND(net_revenue * 0.18 * labor_mult, 4) AS labor_cost,
        ROUND(net_revenue * 0.065 * marketing_mult, 4) AS marketing_cost,
        ROUND((82000 + (sequence_order * 1800)) * opex_mult, 4) AS opex_total,
        ROUND(14000 + (sequence_order * 550), 4) AS depreciation,
        ROUND(debt_balance * 0.0105, 4) AS interest_expense
    FROM pnl0
),
pnl2 AS (
    SELECT
        *,
        ROUND(net_revenue - cogs_total, 4) AS gross_profit,
        ROUND((net_revenue - cogs_total) - labor_cost - marketing_cost - opex_total, 4) AS ebitda,
        ROUND(((net_revenue - cogs_total) - labor_cost - marketing_cost - opex_total) - depreciation, 4) AS ebit,
        ROUND((((net_revenue - cogs_total) - labor_cost - marketing_cost - opex_total) - depreciation) - interest_expense, 4) AS net_income,
        ROUND((((net_revenue - cogs_total) - labor_cost - marketing_cost - opex_total) * 0.88)
            - CASE WHEN sequence_order <= 3 THEN 18000 ELSE 9000 END, 4) AS operating_cashflow,
        ROUND((CASE sequence_order
            WHEN 1 THEN -210000
            WHEN 2 THEN -120000
            WHEN 3 THEN -70000
            WHEN 6 THEN -55000
            ELSE -18000
        END) * capex_mult, 4) AS investing_cashflow,
        ROUND(CASE
            WHEN sequence_order = 1 THEN financing_m1
            WHEN sequence_order = 7 THEN financing_m7
            ELSE 0
        END, 4) AS financing_cashflow
    FROM pnl1
),
cash0 AS (
    SELECT
        *,
        ROUND(operating_cashflow + investing_cashflow + financing_cashflow, 4) AS net_change
    FROM pnl2
),
cash1 AS (
    SELECT
        *,
        ROUND(
            initial_cash
            + COALESCE(
                SUM(net_change) OVER (
                    PARTITION BY scenario_id
                    ORDER BY sequence_order
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
                0
            ),
            4
        ) AS opening_balance,
        ROUND(
            initial_cash
            + SUM(net_change) OVER (
                PARTITION BY scenario_id
                ORDER BY sequence_order
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ),
            4
        ) AS closing_balance,
        ROUND(
            CASE
                WHEN operating_cashflow < 0 THEN GREATEST(
                    (
                        initial_cash
                        + SUM(net_change) OVER (
                            PARTITION BY scenario_id
                            ORDER BY sequence_order
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        )
                    ) / NULLIF(ABS(operating_cashflow), 0),
                    0
                )
                ELSE 18 + (sequence_order / 2.0)
            END,
            1
        ) AS cash_runway_months,
        ROUND(
            560000
            + ABS(
                SUM(investing_cashflow) OVER (
                    PARTITION BY scenario_id
                    ORDER BY sequence_order
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                )
            ),
            4
        ) AS fixed_assets_gross,
        ROUND(
            SUM(depreciation) OVER (
                PARTITION BY scenario_id
                ORDER BY sequence_order
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ),
            4
        ) AS accumulated_depreciation,
        ROUND(42000 + (sequence_order * 2600 * cogs_mult), 4) AS inventory_assets,
        ROUND(net_revenue * 0.09, 4) AS receivables,
        ROUND(cogs_total * 0.21, 4) AS accounts_payable,
        ROUND(
            debt_balance * CASE
                WHEN sequence_order <= 4 THEN 0.34
                WHEN sequence_order <= 8 THEN 0.28
                ELSE 0.20
            END,
            4
        ) AS short_term_debt,
        ROUND(
            debt_balance
            - (
                debt_balance * CASE
                    WHEN sequence_order <= 4 THEN 0.34
                    WHEN sequence_order <= 8 THEN 0.28
                    ELSE 0.20
                END
            ),
            4
        ) AS long_term_debt,
        ROUND(
            paid_in_capital
            + SUM(GREATEST(financing_cashflow, 0)) OVER (
                PARTITION BY scenario_id
                ORDER BY sequence_order
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ),
            4
        ) AS paid_in_capital_total
    FROM cash0
)
SELECT
    tenant_id,
    scenario_id,
    planning_period_id,
    sequence_order,
    projected_volume,
    gross_revenue,
    platform_commission,
    discounts,
    net_revenue,
    cogs_total,
    gross_profit,
    labor_cost,
    marketing_cost,
    opex_total,
    ebitda,
    depreciation,
    ebit,
    interest_expense,
    net_income,
    opening_balance,
    operating_cashflow,
    investing_cashflow,
    financing_cashflow,
    net_change,
    closing_balance,
    cash_runway_months,
    inventory_assets,
    receivables,
    fixed_assets_gross,
    accumulated_depreciation,
    ROUND(fixed_assets_gross - accumulated_depreciation, 4) AS fixed_assets_net,
    accounts_payable,
    short_term_debt,
    long_term_debt,
    paid_in_capital_total,
    ROUND(
        closing_balance
        + inventory_assets
        + receivables
        + (fixed_assets_gross - accumulated_depreciation),
        4
    ) AS total_assets,
    ROUND(accounts_payable + short_term_debt + long_term_debt, 4) AS total_liabilities,
    ROUND(
        (
            closing_balance
            + inventory_assets
            + receivables
            + (fixed_assets_gross - accumulated_depreciation)
        )
        - (accounts_payable + short_term_debt + long_term_debt),
        4
    ) AS total_equity,
    ROUND(
        (
            (
                closing_balance
                + inventory_assets
                + receivables
                + (fixed_assets_gross - accumulated_depreciation)
            )
            - (accounts_payable + short_term_debt + long_term_debt)
        ) - paid_in_capital_total,
        4
    ) AS retained_earnings,
    ROUND(net_revenue / NULLIF(projected_volume, 0), 4) AS aov,
    ROUND((12.5 * marketing_mult) + (sequence_order * 0.15), 4) AS cac,
    ROUND((net_revenue / NULLIF(projected_volume, 0)) * (6.0 + (volume_mult * 1.5)), 4) AS clv,
    ROUND(projected_volume / NULLIF(day_count, 0), 2) AS orders_per_day,
    ROUND(gross_profit / NULLIF(projected_volume, 0), 4) AS contribution_margin_1,
    ROUND((gross_profit - labor_cost - marketing_cost) / NULLIF(projected_volume, 0), 4) AS contribution_margin_2,
    ROUND(ebitda / NULLIF(projected_volume, 0), 4) AS ebitda_per_order,
    GREATEST(
        8,
        ROUND(
            18 - (volume_mult * 3) + (cogs_mult * 2) + CASE WHEN sequence_order > 6 THEN -2 ELSE 0 END,
            0
        )::INTEGER
    ) AS payback_months,
    irr_pct,
    roic_pct,
    bridge_volume,
    bridge_pricing,
    bridge_food,
    bridge_labor,
    bridge_platform
FROM cash1;

INSERT INTO revenue_projection_lines (
    tenant_id, scenario_id, planning_period_id, kitchen_id, product_family_id, platform_id,
    projected_volume, projected_gross_revenue, projected_net_revenue
)
SELECT
    spb.tenant_id,
    spb.scenario_id,
    spb.planning_period_id,
    'eeeeeeee-0000-4000-8000-000000000001'::UUID,
    (
        SELECT pf.id
        FROM product_families pf
        WHERE pf.tenant_id = spb.tenant_id
          AND pf.company_id = 'aaaaaaaa-0000-0000-0000-000000000001'::UUID
          AND pf.name = 'Pizza'
        LIMIT 1
    ),
    (
        SELECT p.id
        FROM platforms p
        WHERE p.tenant_id = spb.tenant_id
          AND p.company_id = 'aaaaaaaa-0000-0000-0000-000000000001'::UUID
          AND p.name = 'Talabat'
        LIMIT 1
    ),
    spb.projected_volume,
    spb.gross_revenue,
    spb.net_revenue
FROM seed_projection_base spb;

INSERT INTO pnl_projections (
    tenant_id, scenario_id, planning_period_id, geographic_level, entity_id,
    gross_revenue, platform_commission, discounts, net_revenue,
    cogs_total, gross_profit, labor_cost, marketing_cost, opex_total,
    ebitda, depreciation, ebit, interest_expense, net_income
)
SELECT
    tenant_id,
    scenario_id,
    planning_period_id,
    'kitchen',
    'eeeeeeee-0000-4000-8000-000000000001'::UUID,
    gross_revenue,
    platform_commission,
    discounts,
    net_revenue,
    cogs_total,
    gross_profit,
    labor_cost,
    marketing_cost,
    opex_total,
    ebitda,
    depreciation,
    ebit,
    interest_expense,
    net_income
FROM seed_projection_base;

INSERT INTO cashflow_projections (
    tenant_id, scenario_id, planning_period_id,
    opening_balance, operating_cashflow, investing_cashflow, financing_cashflow,
    net_change, closing_balance, cash_runway_months
)
SELECT
    tenant_id,
    scenario_id,
    planning_period_id,
    opening_balance,
    operating_cashflow,
    investing_cashflow,
    financing_cashflow,
    net_change,
    closing_balance,
    cash_runway_months
FROM seed_projection_base;

INSERT INTO balance_sheet_projections (
    tenant_id, scenario_id, planning_period_id,
    cash_assets, inventory_assets, receivables, fixed_assets_gross,
    accumulated_depreciation, fixed_assets_net, total_assets,
    accounts_payable, short_term_debt, long_term_debt, total_liabilities,
    paid_in_capital, retained_earnings, total_equity
)
SELECT
    tenant_id,
    scenario_id,
    planning_period_id,
    closing_balance,
    inventory_assets,
    receivables,
    fixed_assets_gross,
    accumulated_depreciation,
    fixed_assets_net,
    total_assets,
    accounts_payable,
    short_term_debt,
    long_term_debt,
    total_liabilities,
    paid_in_capital_total,
    retained_earnings,
    total_equity
FROM seed_projection_base;

INSERT INTO unit_economics_projections (
    tenant_id, scenario_id, kitchen_id, planning_period_id,
    aov, cac, clv, orders_per_day, contribution_margin_1, contribution_margin_2,
    ebitda_per_order, payback_months
)
SELECT
    tenant_id,
    scenario_id,
    'eeeeeeee-0000-4000-8000-000000000001'::UUID,
    planning_period_id,
    aov,
    cac,
    clv,
    orders_per_day,
    contribution_margin_1,
    contribution_margin_2,
    ebitda_per_order,
    payback_months
FROM seed_projection_base;

INSERT INTO kpi_projections (
    tenant_id, scenario_id, planning_period_id, kpi_name, kpi_category, kpi_value, target_value, traffic_light
)
SELECT tenant_id, scenario_id, planning_period_id, 'Burn Rate', 'liquidity'::kpi_category, ABS(LEAST(net_change, 0)), 85000,
       CASE WHEN ABS(LEAST(net_change, 0)) <= 85000 THEN 'green' WHEN ABS(LEAST(net_change, 0)) <= 120000 THEN 'amber' ELSE 'red' END
FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'Runway', 'liquidity'::kpi_category, cash_runway_months, 9,
       CASE WHEN cash_runway_months >= 9 THEN 'green' WHEN cash_runway_months >= 6 THEN 'amber' ELSE 'red' END
FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'IRR', 'return'::kpi_category, irr_pct, 20,
       CASE WHEN irr_pct >= 20 THEN 'green' WHEN irr_pct >= 14 THEN 'amber' ELSE 'red' END
FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'ROIC', 'return'::kpi_category, roic_pct, 15,
       CASE WHEN roic_pct >= 15 THEN 'green' WHEN roic_pct >= 10 THEN 'amber' ELSE 'red' END
FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA Margin', 'financial'::kpi_category,
       ROUND(CASE WHEN net_revenue = 0 THEN 0 ELSE (ebitda / net_revenue) * 100 END, 4), 18,
       CASE
           WHEN CASE WHEN net_revenue = 0 THEN 0 ELSE (ebitda / net_revenue) * 100 END >= 18 THEN 'green'
           WHEN CASE WHEN net_revenue = 0 THEN 0 ELSE (ebitda / net_revenue) * 100 END >= 12 THEN 'amber'
           ELSE 'red'
       END
FROM seed_projection_base;

INSERT INTO driver_explainability (
    tenant_id, scenario_id, planning_period_id, target_metric, driver_name, impact_amount, display_order
)
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA', 'Volume Growth', bridge_volume, 1 FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA', 'Menu Pricing', bridge_pricing, 2 FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA', 'Food Cost', bridge_food, 3 FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA', 'Labor Productivity', bridge_labor, 4 FROM seed_projection_base
UNION ALL
SELECT tenant_id, scenario_id, planning_period_id, 'EBITDA', 'Platform Mix', bridge_platform, 5 FROM seed_projection_base;
