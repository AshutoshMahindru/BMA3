-- Migration 005: Seed canonical assumption packs + field bindings for the
-- clean local bootstrap after the SpecOS assumption-pack tables exist.
--
-- The legacy bootstrap seeds assumption_sets and governed plan_versions, but
-- the compute DAG resolves its variables from assumption_packs →
-- assumption_pack_bindings → assumption_field_bindings. Without a canonical
-- pack seed, a fresh local stack cannot complete node_assumption_packs.

BEGIN;

WITH pack_templates AS (
  SELECT *
  FROM (
    VALUES
      ('market'::assumption_family),
      ('product'::assumption_family),
      ('capacity'::assumption_family),
      ('operations'::assumption_family),
      ('funding'::assumption_family)
  ) AS pt(family)
),
inserted_packs AS (
  INSERT INTO assumption_packs (
    company_id,
    family,
    name,
    status,
    source_type,
    is_deleted,
    assumption_set_id,
    assumption_family,
    pack_name,
    description
  )
  SELECT
    s.company_id,
    pt.family,
    s.name || ' — ' || initcap(replace(pt.family::text, '_', ' ')) || ' assumptions',
    'draft'::governance_status,
    'scenario_specific'::assumption_source_type,
    FALSE,
    aset.id,
    pt.family,
    s.name || ' — ' || initcap(replace(pt.family::text, '_', ' ')) || ' assumptions',
    'Bootstrap canonical assumption pack for local SpecOS runtime verification.'
  FROM assumption_sets aset
  JOIN scenarios s
    ON s.id = aset.scenario_id
  CROSS JOIN pack_templates pt
  WHERE aset.is_deleted = FALSE
    AND s.is_deleted = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM assumption_packs existing
      WHERE existing.assumption_set_id = aset.id
        AND COALESCE(existing.assumption_family, existing.family) = pt.family
        AND existing.is_deleted = FALSE
    )
  RETURNING id, assumption_set_id
)
INSERT INTO assumption_pack_bindings (pack_id, assumption_set_id)
SELECT ip.id, ip.assumption_set_id
FROM inserted_packs ip
WHERE NOT EXISTS (
  SELECT 1
  FROM assumption_pack_bindings existing
  WHERE existing.pack_id = ip.id
    AND existing.assumption_set_id = ip.assumption_set_id
);

WITH scenario_bindings AS (
  SELECT *
  FROM (
    VALUES
      ('cccccccc-0001-4000-8000-000000000001'::uuid, 'market'::assumption_family, '{"gross_demand":5000,"reach_rate":0.80,"conversion_rate":0.60,"retention_rate":0.70,"average_order_value":55.0,"discount_rate":0.08,"refund_rate":0.02,"channel_fee_rate":0.30}'::jsonb, 'market_research'::text, 'bootstrap scenario market baseline'::text),
      ('cccccccc-0001-4000-8000-000000000001'::uuid, 'product'::assumption_family, '{"cogs_per_unit":14.0}'::jsonb, 'historical_data'::text, 'bootstrap product cost baseline'::text),
      ('cccccccc-0001-4000-8000-000000000001'::uuid, 'capacity'::assumption_family, '{"capacity_factor":1.0,"practical_capacity":6500,"utilization_threshold":0.82}'::jsonb, 'operator_input'::text, 'bootstrap capacity plan'::text),
      ('cccccccc-0001-4000-8000-000000000001'::uuid, 'operations'::assumption_family, '{"variable_marketing_promo":5500,"variable_labor_fulfillment":22000,"site_controllable_opex":15000,"fixed_site_costs":8000,"shared_operating_allocations":5000,"depreciation":3000,"amortization":500,"receivables_days":28,"payables_days":19,"inventory_days":14,"capex_launch":0,"capex_maintenance":0,"capex_scaleup":0}'::jsonb, 'operator_input'::text, 'bootstrap operating plan'::text),
      ('cccccccc-0001-4000-8000-000000000001'::uuid, 'funding'::assumption_family, '{"minimum_cash_buffer":75000,"tax_rate":0.09,"interest_rate":0.0105,"debt_outstanding":280000,"equity_inflows":0,"debt_drawdowns":0,"debt_repayments":0,"hurdle_rate":0.12}'::jsonb, 'industry_benchmark'::text, 'bootstrap funding policy'::text),

      ('cccccccc-0002-4000-8000-000000000001'::uuid, 'market'::assumption_family, '{"gross_demand":8000,"reach_rate":0.85,"conversion_rate":0.65,"retention_rate":0.78,"average_order_value":58.0,"discount_rate":0.06,"refund_rate":0.015,"channel_fee_rate":0.28}'::jsonb, 'market_research'::text, 'bootstrap scenario market baseline'::text),
      ('cccccccc-0002-4000-8000-000000000001'::uuid, 'product'::assumption_family, '{"cogs_per_unit":13.5}'::jsonb, 'historical_data'::text, 'bootstrap product cost baseline'::text),
      ('cccccccc-0002-4000-8000-000000000001'::uuid, 'capacity'::assumption_family, '{"capacity_factor":1.0,"practical_capacity":9000,"utilization_threshold":0.84}'::jsonb, 'operator_input'::text, 'bootstrap capacity plan'::text),
      ('cccccccc-0002-4000-8000-000000000001'::uuid, 'operations'::assumption_family, '{"variable_marketing_promo":4000,"variable_labor_fulfillment":28000,"site_controllable_opex":16000,"fixed_site_costs":8000,"shared_operating_allocations":5000,"depreciation":3200,"amortization":500,"receivables_days":24,"payables_days":18,"inventory_days":12,"capex_launch":0,"capex_maintenance":0,"capex_scaleup":0}'::jsonb, 'operator_input'::text, 'bootstrap operating plan'::text),
      ('cccccccc-0002-4000-8000-000000000001'::uuid, 'funding'::assumption_family, '{"minimum_cash_buffer":90000,"tax_rate":0.09,"interest_rate":0.0105,"debt_outstanding":260000,"equity_inflows":0,"debt_drawdowns":0,"debt_repayments":0,"hurdle_rate":0.12}'::jsonb, 'industry_benchmark'::text, 'bootstrap funding policy'::text),

      ('cccccccc-0003-4000-8000-000000000001'::uuid, 'market'::assumption_family, '{"gross_demand":4200,"reach_rate":0.76,"conversion_rate":0.52,"retention_rate":0.65,"average_order_value":53.0,"discount_rate":0.09,"refund_rate":0.025,"channel_fee_rate":0.30}'::jsonb, 'market_research'::text, 'bootstrap scenario market baseline'::text),
      ('cccccccc-0003-4000-8000-000000000001'::uuid, 'product'::assumption_family, '{"cogs_per_unit":15.8}'::jsonb, 'historical_data'::text, 'bootstrap product cost baseline'::text),
      ('cccccccc-0003-4000-8000-000000000001'::uuid, 'capacity'::assumption_family, '{"capacity_factor":0.96,"practical_capacity":6000,"utilization_threshold":0.80}'::jsonb, 'operator_input'::text, 'bootstrap capacity plan'::text),
      ('cccccccc-0003-4000-8000-000000000001'::uuid, 'operations'::assumption_family, '{"variable_marketing_promo":6000,"variable_labor_fulfillment":24000,"site_controllable_opex":15500,"fixed_site_costs":8500,"shared_operating_allocations":5500,"depreciation":3000,"amortization":500,"receivables_days":32,"payables_days":17,"inventory_days":16,"capex_launch":0,"capex_maintenance":0,"capex_scaleup":0}'::jsonb, 'operator_input'::text, 'bootstrap operating plan'::text),
      ('cccccccc-0003-4000-8000-000000000001'::uuid, 'funding'::assumption_family, '{"minimum_cash_buffer":100000,"tax_rate":0.09,"interest_rate":0.0105,"debt_outstanding":360000,"equity_inflows":0,"debt_drawdowns":0,"debt_repayments":0,"hurdle_rate":0.12}'::jsonb, 'industry_benchmark'::text, 'bootstrap funding policy'::text),

      ('cccccccc-0004-4000-8000-000000000001'::uuid, 'market'::assumption_family, '{"gross_demand":3600,"reach_rate":0.72,"conversion_rate":0.48,"retention_rate":0.60,"average_order_value":51.0,"discount_rate":0.10,"refund_rate":0.03,"channel_fee_rate":0.33}'::jsonb, 'market_research'::text, 'bootstrap scenario market baseline'::text),
      ('cccccccc-0004-4000-8000-000000000001'::uuid, 'product'::assumption_family, '{"cogs_per_unit":16.5}'::jsonb, 'historical_data'::text, 'bootstrap product cost baseline'::text),
      ('cccccccc-0004-4000-8000-000000000001'::uuid, 'capacity'::assumption_family, '{"capacity_factor":0.92,"practical_capacity":5500,"utilization_threshold":0.78}'::jsonb, 'operator_input'::text, 'bootstrap capacity plan'::text),
      ('cccccccc-0004-4000-8000-000000000001'::uuid, 'operations'::assumption_family, '{"variable_marketing_promo":7000,"variable_labor_fulfillment":25000,"site_controllable_opex":17000,"fixed_site_costs":9000,"shared_operating_allocations":6000,"depreciation":3000,"amortization":500,"receivables_days":35,"payables_days":15,"inventory_days":18,"capex_launch":0,"capex_maintenance":0,"capex_scaleup":0}'::jsonb, 'operator_input'::text, 'bootstrap operating plan'::text),
      ('cccccccc-0004-4000-8000-000000000001'::uuid, 'funding'::assumption_family, '{"minimum_cash_buffer":120000,"tax_rate":0.09,"interest_rate":0.0105,"debt_outstanding":420000,"equity_inflows":0,"debt_drawdowns":0,"debt_repayments":0,"hurdle_rate":0.12}'::jsonb, 'industry_benchmark'::text, 'bootstrap funding policy'::text)
  ) AS sb(scenario_id, pack_family, payload, evidence_type, evidence_ref)
)
INSERT INTO assumption_field_bindings (
  pack_id,
  variable_name,
  grain_signature,
  value,
  unit,
  evidence_ref,
  is_override,
  evidence_type
)
SELECT
  ap.id,
  kv.key,
  '{}'::jsonb,
  kv.value::numeric,
  NULL,
  sb.evidence_ref,
  TRUE,
  sb.evidence_type
FROM scenario_bindings sb
JOIN assumption_sets aset
  ON aset.scenario_id = sb.scenario_id
JOIN assumption_packs ap
  ON ap.assumption_set_id = aset.id
 AND COALESCE(ap.assumption_family, ap.family) = sb.pack_family
CROSS JOIN LATERAL jsonb_each_text(sb.payload) kv
ON CONFLICT (pack_id, variable_name, grain_signature) DO UPDATE
  SET value = EXCLUDED.value,
      evidence_ref = EXCLUDED.evidence_ref,
      is_override = EXCLUDED.is_override,
      evidence_type = EXCLUDED.evidence_type,
      updated_at = NOW();

COMMIT;
