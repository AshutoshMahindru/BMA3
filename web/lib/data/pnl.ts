/* ══════════════════════════════════════════════════════════════════════════
   SHARED P&L DATA MODULE — Single source of truth for Profit & Loss
   Consumed by: S01 (Home), S02 (Executive), S11 (P&L Console)
   ══════════════════════════════════════════════════════════════════════ */

export const PNL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type PnLRow = {
  label: string;
  values: number[];
  fy: number;
  indent?: boolean;
  bold?: boolean;
  highlight?: 'ebitda' | 'subtotal';
  pctRow?: boolean;
  negative?: boolean;
  separator?: boolean;
};

/** Monthly P&L line items (AED '000s) — 14 rows × 12 months + FY total */
export const PNL_DATA: PnLRow[] = [
  { label: 'Gross Revenue', values: [260, 275, 290, 305, 320, 335, 350, 365, 380, 395, 410, 430], fy: 4115 },
  { label: 'Less: Discounts & Promos', values: [20, 22, 21, 24, 25, 26, 27, 28, 30, 31, 32, 34], fy: 320, indent: true, negative: true },
  { label: 'Net Revenue', values: [240, 253, 269, 281, 295, 309, 323, 337, 350, 364, 378, 396], fy: 3795, bold: true, highlight: 'subtotal' },
  { label: 'Cost of Goods Sold', values: [65, 68, 70, 73, 76, 79, 82, 85, 88, 91, 94, 98], fy: 969, indent: true, negative: true },
  { label: 'Gross Profit', values: [175, 185, 199, 208, 219, 230, 241, 252, 262, 273, 284, 298], fy: 2826, bold: true, highlight: 'subtotal' },
  { label: 'Gross Margin %', values: [72.9, 73.1, 74.0, 74.0, 74.2, 74.4, 74.6, 74.8, 74.9, 75.0, 75.1, 75.3], fy: 74.5, pctRow: true },
  { label: 'Kitchen Labor', values: [45, 45, 46, 47, 48, 48, 49, 49, 50, 50, 51, 52], fy: 580, indent: true, negative: true },
  { label: 'Facility Rent & Utilities', values: [15, 15, 15, 15, 18, 18, 18, 18, 18, 18, 18, 18], fy: 204, indent: true, negative: true },
  { label: 'Marketing & Acquisition', values: [20, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], fy: 295, indent: true, negative: true },
  { label: 'General & Admin', values: [12, 12.5, 13, 13.5, 14, 14.5, 15, 15, 15.5, 16, 16.5, 17], fy: 174.5, indent: true, negative: true },
  { label: 'EBITDA', values: [83, 92.5, 104, 110.5, 116, 125.5, 134, 144, 151.5, 161, 169.5, 181], fy: 1572.5, bold: true, highlight: 'ebitda' },
  { label: 'EBITDA Margin %', values: [34.6, 36.6, 38.7, 39.3, 39.3, 40.6, 41.5, 42.7, 43.3, 44.2, 44.8, 45.7], fy: 41.4, pctRow: true },
  { label: 'Depreciation & Amortization', values: [8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 10, 10], fy: 112, indent: true, negative: true },
  { label: 'Net Income', values: [68, 77, 88, 94.5, 98, 107.5, 116, 126, 133.5, 143, 151.5, 163], fy: 1365, bold: true, highlight: 'subtotal' },
];

/** EBITDA Bridge — YoY drivers for waterfall chart */
export const EBITDA_BRIDGE = [
  { label: 'Revenue Growth', value: 420, positive: true },
  { label: 'Gross Margin Improvement', value: 85, positive: true },
  { label: 'Cost Optimization', value: 35, positive: true },
  { label: 'Labor Cost Increase', value: -65, positive: false },
  { label: 'Rent Expansion', value: -42, positive: false },
  { label: 'Marketing Increase', value: -38, positive: false },
] as const;

/** Executive cockpit monthly revenue vs EBITDA (AED K) */
export const EXECUTIVE_MONTHLY_REVENUE_EBITDA = [
  { month: 'Jan', revenue: 280, ebitda: 42 },
  { month: 'Feb', revenue: 310, ebitda: 48 },
  { month: 'Mar', revenue: 340, ebitda: 55 },
  { month: 'Apr', revenue: 360, ebitda: 62 },
  { month: 'May', revenue: 355, ebitda: 58 },
  { month: 'Jun', revenue: 370, ebitda: 65 },
  { month: 'Jul', revenue: 385, ebitda: 72 },
  { month: 'Aug', revenue: 400, ebitda: 78 },
  { month: 'Sep', revenue: 390, ebitda: 70 },
  { month: 'Oct', revenue: 410, ebitda: 82 },
  { month: 'Nov', revenue: 430, ebitda: 90 },
  { month: 'Dec', revenue: 450, ebitda: 98 },
] as const;

/** Executive scenario snapshot (used on S02) */
export const SCENARIO_SNAPSHOT = [
  { scenario: 'Base Case', revenue: '12.5M', ebitda: '2.1M', irr: '28%', payback: '18 mo', badge: 'bg-blue-100 text-blue-700' },
  { scenario: 'Bull Case', revenue: '18.2M', ebitda: '4.8M', irr: '42%', payback: '12 mo', badge: 'bg-green-100 text-green-700' },
  { scenario: 'Bear Case', revenue: '8.1M', ebitda: '0.4M', irr: '12%', payback: '28 mo', badge: 'bg-amber-100 text-amber-700' },
  { scenario: 'Stress Test', revenue: '6.5M', ebitda: '-0.3M', irr: '-5%', payback: 'N/A', badge: 'bg-red-100 text-red-700' },
] as const;

/** Platform revenue mix (used on S02) */
export const PLATFORM_MIX = [
  { name: 'Talabat', pct: 45, color: '#f97316' },
  { name: 'Deliveroo', pct: 25, color: '#06b6d4' },
  { name: 'Careem Food', pct: 18, color: '#8b5cf6' },
  { name: 'Direct / Own App', pct: 12, color: '#16a34a' },
] as const;

/** Cash Flow Waterfall bars (used on S02) */
export const CF_WATERFALL_BARS = [
  { label: 'Opening\nCash', value: 2800, y: 30, h: 80, color: '#1B2A4A' },
  { label: 'Operating\nCF', value: 950, y: 30, h: 55, color: '#1A7A4A' },
  { label: 'CAPEX', value: -380, y: 85, h: 25, color: '#C0392B' },
  { label: 'Funding', value: 500, y: 50, h: 35, color: '#2563eb' },
  { label: 'Debt\nRepay', value: -120, y: 95, h: 15, color: '#C0392B' },
  { label: 'Closing\nCash', value: 3750, y: 20, h: 90, color: '#1B2A4A' },
] as const;

/* ── Type helpers ── */
export type EbitdaBridgeDriver = typeof EBITDA_BRIDGE[number];
export type MonthlyRevenueEbitda = typeof EXECUTIVE_MONTHLY_REVENUE_EBITDA[number];
export type ScenarioSnapshotRow = typeof SCENARIO_SNAPSHOT[number];
export type PlatformMixItem = typeof PLATFORM_MIX[number];
