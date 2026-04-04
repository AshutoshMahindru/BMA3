INSERT INTO companies (
    id, tenant_id, name, base_currency, fiscal_year_start_month, country_code
) VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'tttttttt-0000-0000-0000-000000000001',
    'PizzaCo Dark Kitchen Operations',
    'AED',
    1,
    'AE'
);

INSERT INTO planning_calendars (
    id, tenant_id, company_id, name, start_date, end_date
) VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'tttttttt-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Fiscal Year 2025',
    '2025-01-01',
    '2025-12-31'
);

DO $$
DECLARE
    cal_id UUID := 'bbbbbbbb-0000-0000-0000-000000000001';
    t_id   UUID := 'tttttttt-0000-0000-0000-000000000001';
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
     'tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Base Case 2025', 'base',
     'Realistic central case: avg growth, stable food costs, on-plan expansion'),

    ('cccccccc-0002-0000-0000-000000000001',
     'tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Bull Case 2025', 'bull_case',
     '20% volume upside, lower CAC, faster market ramp'),

    ('cccccccc-0003-0000-0000-000000000001',
     'tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Bear Case 2025', 'bear_case',
     'Slower ramp, food cost +15%, platform commission increase'),

    ('cccccccc-0004-0000-0000-000000000001',
     'tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Stress Test 2025', 'stress_test',
     'Commission spike to 35%, food cost +25%, delayed expansion by 2 months');

INSERT INTO assumption_sets (
    tenant_id, scenario_id, name, overall_confidence, review_cadence
)
SELECT
    'tttttttt-0000-0000-0000-000000000001',
    id,
    name || ' — Assumptions v1.0',
    'medium',
    'Monthly'
FROM scenarios
WHERE tenant_id = 'tttttttt-0000-0000-0000-000000000001';

INSERT INTO countries (tenant_id, company_id, name, iso_code, currency_code)
VALUES (
    'tttttttt-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'United Arab Emirates', 'AE', 'AED'
);

INSERT INTO clusters (tenant_id, country_id, name)
SELECT 'tttttttt-0000-0000-0000-000000000001', id, 'Dubai'
FROM countries WHERE iso_code = 'AE'
    AND tenant_id = 'tttttttt-0000-0000-0000-000000000001';

INSERT INTO macros (tenant_id, cluster_id, name)
SELECT 'tttttttt-0000-0000-0000-000000000001', id, 'Dubai City'
FROM clusters WHERE name = 'Dubai'
    AND tenant_id = 'tttttttt-0000-0000-0000-000000000001';

INSERT INTO micros (tenant_id, macro_id, name, attractiveness_score)
SELECT 'tttttttt-0000-0000-0000-000000000001', id, 'Jumeirah Lake Towers', 78.5
FROM macros WHERE name = 'Dubai City'
    AND tenant_id = 'tttttttt-0000-0000-0000-000000000001';

INSERT INTO platforms (tenant_id, company_id, name, platform_type, base_commission_pct, payout_lag_days)
VALUES
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Talabat', 'aggregator', 0.2800, 14),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Deliveroo', 'aggregator', 0.3000, 7),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Uber Eats', 'aggregator', 0.3000, 7),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001',
     'Own App', 'own_app', 0.0, 1);

INSERT INTO product_families (tenant_id, company_id, name, family_type, avg_prep_mins)
VALUES
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Pizza', 'pizza', 18),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Sides', 'sides', 8),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Beverages', 'beverages', 2),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Desserts', 'desserts', 6),
    ('tttttttt-0000-0000-0000-000000000001',
     'aaaaaaaa-0000-0000-0000-000000000001', 'Combos', 'combos', 20);