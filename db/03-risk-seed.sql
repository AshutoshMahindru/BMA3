-- Risk Seed Data for Phase 4
-- Company/Tenant IDs from 02-seed.sql
-- cccccccc-0001-0000-0000-000000000001 Scenario ID

DO $$ 
DECLARE 
    tenant_id UUID := '10000000-0000-4000-8000-000000000001';
    scenario_id UUID := 'cccccccc-0001-0000-0000-000000000001';
    ro_id UUID;
BEGIN
    -- R-01: Platform Commission Hike
    INSERT INTO risk_objects (tenant_id, name, category, likelihood, impact, mitigation_plan)
    VALUES (tenant_id, 'Platform Commission Hike (>25%)', 'platform', 'high', 'major', 'Diversify to own-app delivery channels')
    RETURNING id INTO ro_id;
    
    INSERT INTO risk_scenarios (tenant_id, risk_object_id, scenario_id, probability_pct, financial_impact_estimate, time_to_materialise_months)
    VALUES (tenant_id, ro_id, scenario_id, 0.65, 450000, 6);

    -- R-02: Demand Slump (Competitor Entry)
    INSERT INTO risk_objects (tenant_id, name, category, likelihood, impact, mitigation_plan)
    VALUES (tenant_id, 'Demand Slump (Competitor Entry)', 'market', 'medium', 'major', 'Aggressive loyalty program and discount vouchers')
    RETURNING id INTO ro_id;
    
    INSERT INTO risk_scenarios (tenant_id, risk_object_id, scenario_id, probability_pct, financial_impact_estimate, time_to_materialise_months)
    VALUES (tenant_id, ro_id, scenario_id, 0.35, 380000, 3);

    -- R-03: Food Cost Inflation
    INSERT INTO risk_objects (tenant_id, name, category, likelihood, impact, mitigation_plan)
    VALUES (tenant_id, 'COGS Inflation (Cheese/Protein)', 'food_cost', 'high', 'moderate', 'Locked supplier contracts for 12 months')
    RETURNING id INTO ro_id;
    
    INSERT INTO risk_scenarios (tenant_id, risk_object_id, scenario_id, probability_pct, financial_impact_estimate, time_to_materialise_months)
    VALUES (tenant_id, ro_id, scenario_id, 0.75, 250000, 4);

    -- R-04: Series A Funding Delay
    INSERT INTO risk_objects (tenant_id, name, category, likelihood, impact, mitigation_plan)
    VALUES (tenant_id, 'Series A Delay (>3 months)', 'funding', 'medium', 'critical', 'Secure venture debt bridge facility')
    RETURNING id INTO ro_id;
    
    INSERT INTO risk_scenarios (tenant_id, risk_object_id, scenario_id, probability_pct, financial_impact_estimate, time_to_materialise_months)
    VALUES (tenant_id, ro_id, scenario_id, 0.25, 1200000, 9);
END $$;
