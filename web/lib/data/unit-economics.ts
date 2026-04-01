/* ══════════════════════════════════════════════════════════════════════════
   SHARED UNIT ECONOMICS DATA MODULE — Single source of truth
   Consumed by: S14 (Unit Economics Console)
   ══════════════════════════════════════════════════════════════════════ */

import { PORTFOLIO_KPIS } from './kpis';

/* ── Per-Order Economics Waterfall ────────────────────────────────────── */
export type WaterfallRow = {
  label: string;
  value: number;
  cumulative: number;
  type: 'revenue' | 'cost' | 'margin';
  marginLabel?: string;
};

export const UNIT_WATERFALL: WaterfallRow[] = [
  { label: 'Gross Order Value (GOV)', value: PORTFOLIO_KPIS.avgOrderValue, cumulative: PORTFOLIO_KPIS.avgOrderValue, type: 'revenue' },
  { label: 'Less: Discounts & Promos', value: -5.3, cumulative: 56.7, type: 'cost' },
  { label: 'Net Order Value (NOV)', value: 56.7, cumulative: 56.7, type: 'margin', marginLabel: 'CM0' },
  { label: 'Less: Platform Commission', value: -15.9, cumulative: 40.8, type: 'cost' },
  { label: 'Net Revenue (NR)', value: 40.8, cumulative: 40.8, type: 'margin', marginLabel: 'CM1' },
  { label: 'Less: Food COGS', value: -14.2, cumulative: 26.6, type: 'cost' },
  { label: 'Less: Packaging', value: -2.1, cumulative: 24.5, type: 'cost' },
  { label: 'Gross Profit', value: 24.5, cumulative: 24.5, type: 'margin', marginLabel: 'CM2' },
  { label: 'Less: Marketing / CAC', value: -3.2, cumulative: 21.3, type: 'cost' },
  { label: 'CM3 (Post-Marketing)', value: 21.3, cumulative: 21.3, type: 'margin', marginLabel: 'CM3' },
  { label: 'Less: Fixed OPEX Allocation', value: -8.5, cumulative: PORTFOLIO_KPIS.ebitdaPerOrder, type: 'cost' },
  { label: 'EBITDA per Order', value: PORTFOLIO_KPIS.ebitdaPerOrder, cumulative: PORTFOLIO_KPIS.ebitdaPerOrder, type: 'margin', marginLabel: 'CM4' },
];

/* ── Kitchen Ranking Table ───────────────────────────────────────────── */
export const KITCHEN_RANKING = [
  { kitchen: 'JLT North Kitchen', orders: 4350, aov: 'AED 64', cm2: 'AED 26.2', cm2Pct: '42.2%', ebitdaPerOrder: 'AED 14.5', payback: '14 mo', rank: 1 },
  { kitchen: 'Marina Kitchen', orders: 3800, aov: 'AED 61', cm2: 'AED 24.8', cm2Pct: '40.7%', ebitdaPerOrder: 'AED 12.8', payback: '16 mo', rank: 2 },
  { kitchen: 'Downtown Kitchen', orders: 2900, aov: 'AED 68', cm2: 'AED 28.4', cm2Pct: '41.8%', ebitdaPerOrder: 'AED 11.2', payback: '20 mo', rank: 3 },
  { kitchen: 'JBR Kitchen', orders: 2200, aov: 'AED 58', cm2: 'AED 22.1', cm2Pct: '38.1%', ebitdaPerOrder: 'AED 9.8', payback: '22 mo', rank: 4 },
  { kitchen: 'Abu Dhabi Kitchen', orders: 1800, aov: 'AED 55', cm2: 'AED 20.5', cm2Pct: '37.3%', ebitdaPerOrder: 'AED 7.2', payback: '28 mo', rank: 5 },
] as const;

/* ── Payback Curve Data ──────────────────────────────────────────────── */
export const PAYBACK_CURVE = [
  { month: 0, cumCF: -470 }, { month: 3, cumCF: -380 }, { month: 6, cumCF: -260 },
  { month: 9, cumCF: -120 }, { month: 12, cumCF: 30 }, { month: 15, cumCF: 210 },
  { month: 18, cumCF: 420 }, { month: 21, cumCF: 660 }, { month: 24, cumCF: 920 },
] as const;

/* ── Type helpers ── */
export type KitchenRankingRow = typeof KITCHEN_RANKING[number];
export type PaybackPoint = typeof PAYBACK_CURVE[number];
