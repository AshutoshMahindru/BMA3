export type AssumptionFamilyKey = 'demand' | 'cost' | 'funding' | 'working-capital';

type AssumptionFamilyConfig = {
  key: AssumptionFamilyKey;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  accentClass: string;
};

export const ASSUMPTION_FAMILY_ORDER: AssumptionFamilyKey[] = [
  'demand',
  'cost',
  'funding',
  'working-capital',
];

export const ASSUMPTION_FAMILY_CONFIG: Record<AssumptionFamilyKey, AssumptionFamilyConfig> = {
  demand: {
    key: 'demand',
    label: 'Demand Assumptions',
    shortLabel: 'Demand',
    description: 'Commercial demand drivers, pricing power, and order conversion assumptions.',
    href: '/dashboard/assumptions/demand',
    accentClass: 'from-cyan-500 to-blue-600',
  },
  cost: {
    key: 'cost',
    label: 'Cost Assumptions',
    shortLabel: 'Cost',
    description: 'COGS, controllable opex, and capex-linked operating assumptions.',
    href: '/dashboard/assumptions/cost',
    accentClass: 'from-amber-500 to-orange-600',
  },
  funding: {
    key: 'funding',
    label: 'Funding Assumptions',
    shortLabel: 'Funding',
    description: 'Capital structure, cash buffer, debt, and return hurdle assumptions.',
    href: '/dashboard/assumptions/funding',
    accentClass: 'from-emerald-500 to-teal-600',
  },
  'working-capital': {
    key: 'working-capital',
    label: 'Working Capital Assumptions',
    shortLabel: 'Working Capital',
    description: 'Receivables, payables, inventory timing, and cash conversion assumptions.',
    href: '/dashboard/assumptions/working-capital',
    accentClass: 'from-violet-500 to-fuchsia-600',
  },
};

export function isAssumptionFamilyKey(value: string): value is AssumptionFamilyKey {
  return ASSUMPTION_FAMILY_ORDER.includes(value as AssumptionFamilyKey);
}
