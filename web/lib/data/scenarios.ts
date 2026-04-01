/* ══════════════════════════════════════════════════════════════════════════
   SHARED SCENARIO DATA MODULE — Single source of truth
   Consumed by: S03 (Scenario Comparison Console)
   ══════════════════════════════════════════════════════════════════════ */

import { PORTFOLIO_KPIS } from './kpis';

/** Scenario Definitions — parameters for each scenario */
export const SCENARIO_DEFS = [
  { name: 'Base Case', tag: 'bg-blue-100 text-blue-700', growth: '5.0%', aov: `AED ${PORTFOLIO_KPIS.avgOrderValue}`, commission: '28%', newKitchens: 2, startDate: 'Q1 2025', probability: '60%' },
  { name: 'Bull Case', tag: 'bg-green-100 text-green-700', growth: '12.0%', aov: 'AED 68', commission: '25%', newKitchens: 4, startDate: 'Q1 2025', probability: '20%' },
  { name: 'Bear Case', tag: 'bg-amber-100 text-amber-700', growth: '2.0%', aov: 'AED 55', commission: '30%', newKitchens: 1, startDate: 'Q2 2025', probability: '15%' },
  { name: 'Stress Test', tag: 'bg-red-100 text-red-700', growth: '-5.0%', aov: 'AED 48', commission: '32%', newKitchens: 0, startDate: 'Deferred', probability: '5%' },
] as const;

/** 3-Year P&L Comparison (AED '000s) — 8 line items × 4 scenarios × 3 years */
export const PNL_COMPARISON = [
  { item: 'Gross Revenue', base: [4200, 5800, 7600], bull: [5800, 8400, 12200], bear: [3200, 3800, 4200], stress: [2800, 2400, 2100] },
  { item: 'Net Revenue', base: [3700, 5100, 6700], bull: [5200, 7600, 11000], bear: [2700, 3200, 3500], stress: [2300, 1900, 1600] },
  { item: 'Gross Profit', base: [2400, 3400, 4600], bull: [3600, 5200, 7800], bear: [1600, 1900, 2100], stress: [1200, 900, 600] },
  { item: 'EBITDA', base: [800, 1400, 2100], bull: [1800, 3200, 4800], bear: [200, 350, 400], stress: [-200, -500, -300] },
  { item: 'Net Income', base: [600, 1100, 1800], bull: [1500, 2800, 4200], bear: [50, 150, 200], stress: [-400, -700, -500] },
  { item: 'Cash Balance', base: [1200, 1800, 3200], bull: [2200, 4500, 8000], bear: [600, 400, 350], stress: [300, -200, -800] },
  { item: 'EBITDA Margin', base: ['21.6%', '27.5%', '31.3%'], bull: ['34.6%', '42.1%', '43.6%'], bear: ['7.4%', '10.9%', '11.4%'], stress: ['-8.7%', '-26.3%', '-18.8%'] },
  { item: 'Runway (Months)', base: ['18', '24+', '24+'], bull: ['24+', '24+', '24+'], bear: ['12', '10', '8'], stress: ['8', '4', '0'] },
] as const;

export const COMPARISON_YEARS = ['2025', '2026', '2027'] as const;

/** Tornado Chart Sensitivity Drivers — EBITDA impact (AED '000s variance from Base) */
export const TORNADO_DRIVERS = [
  { name: 'Order Volume Growth', upside: 680, downside: -520 },
  { name: 'Average Selling Price', upside: 450, downside: -380 },
  { name: 'Commission Rate', upside: 320, downside: -280 },
  { name: 'Kitchen Expansion', upside: 280, downside: -150 },
  { name: 'Labor Cost Efficiency', upside: 180, downside: -220 },
  { name: 'Marketing ROI', upside: 150, downside: -120 },
] as const;

/* ── Type helpers ── */
export type ScenarioDef = typeof SCENARIO_DEFS[number];
export type PnlComparisonRow = typeof PNL_COMPARISON[number];
export type TornadoDriver = typeof TORNADO_DRIVERS[number];
