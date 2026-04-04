import {
  getAssumptionsCost,
  getAssumptionsDemand,
  getAssumptionsFunding,
  getAssumptionsWorkingCapital,
  upsertAssumptionsCostBulk,
  upsertAssumptionsDemandBulk,
  upsertAssumptionsFundingBulk,
  upsertAssumptionsWorkingCapitalBulk,
} from '@/lib/api-client';
import type { AssumptionFamilyKey } from '@/lib/assumptions-surfaces';

export type AssumptionVariableOption = {
  variableName: string;
  label: string;
  unit: string;
};

export const ASSUMPTION_FAMILY_VARIABLES: Record<AssumptionFamilyKey, AssumptionVariableOption[]> = {
  demand: [
    { variableName: 'gross_demand', label: 'Gross Demand', unit: 'count' },
    { variableName: 'reach_rate', label: 'Reach Rate', unit: 'percentage' },
    { variableName: 'conversion_rate', label: 'Conversion Rate', unit: 'percentage' },
    { variableName: 'retention_rate', label: 'Retention Rate', unit: 'percentage' },
    { variableName: 'average_order_value', label: 'Average Order Value', unit: 'currency' },
    { variableName: 'discount_rate', label: 'Discount Rate', unit: 'percentage' },
    { variableName: 'refund_rate', label: 'Refund Rate', unit: 'percentage' },
    { variableName: 'channel_fee_rate', label: 'Channel Fee Rate', unit: 'percentage' },
  ],
  cost: [
    { variableName: 'cogs_per_unit', label: 'COGS per Unit', unit: 'currency' },
    { variableName: 'variable_marketing_promo', label: 'Variable Marketing Promo', unit: 'currency' },
    { variableName: 'variable_labor_fulfillment', label: 'Variable Labor Fulfillment', unit: 'currency' },
    { variableName: 'site_controllable_opex', label: 'Site Controllable Opex', unit: 'currency' },
    { variableName: 'fixed_site_costs', label: 'Fixed Site Costs', unit: 'currency' },
    { variableName: 'shared_operating_allocations', label: 'Shared Operating Allocations', unit: 'currency' },
    { variableName: 'capex_launch', label: 'Capex Launch', unit: 'currency' },
    { variableName: 'capex_maintenance', label: 'Capex Maintenance', unit: 'currency' },
    { variableName: 'capex_scaleup', label: 'Capex Scale-Up', unit: 'currency' },
    { variableName: 'depreciation', label: 'Depreciation', unit: 'currency' },
    { variableName: 'amortization', label: 'Amortization', unit: 'currency' },
  ],
  funding: [
    { variableName: 'minimum_cash_buffer', label: 'Minimum Cash Buffer', unit: 'currency' },
    { variableName: 'tax_rate', label: 'Tax Rate', unit: 'percentage' },
    { variableName: 'interest_rate', label: 'Interest Rate', unit: 'percentage' },
    { variableName: 'equity_inflows', label: 'Equity Inflows', unit: 'currency' },
    { variableName: 'debt_drawdowns', label: 'Debt Drawdowns', unit: 'currency' },
    { variableName: 'debt_repayments', label: 'Debt Repayments', unit: 'currency' },
    { variableName: 'debt_outstanding', label: 'Debt Outstanding', unit: 'currency' },
    { variableName: 'hurdle_rate', label: 'Hurdle Rate', unit: 'percentage' },
  ],
  'working-capital': [
    { variableName: 'receivables_days', label: 'Receivables Days', unit: 'days' },
    { variableName: 'payables_days', label: 'Payables Days', unit: 'days' },
    { variableName: 'inventory_days', label: 'Inventory Days', unit: 'days' },
  ],
};

export const ASSUMPTION_FAMILY_HANDLERS = {
  demand: {
    load: getAssumptionsDemand,
    save: upsertAssumptionsDemandBulk,
  },
  cost: {
    load: getAssumptionsCost,
    save: upsertAssumptionsCostBulk,
  },
  funding: {
    load: getAssumptionsFunding,
    save: upsertAssumptionsFundingBulk,
  },
  'working-capital': {
    load: getAssumptionsWorkingCapital,
    save: upsertAssumptionsWorkingCapitalBulk,
  },
} as const;
