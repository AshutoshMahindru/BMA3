/* ══════════════════════════════════════════════════════════════════════════
   SHARED CASH FLOW DATA MODULE — Single source of truth
   Consumed by: S04 (Cash Console), S12 (Cash Flow Console)
   ══════════════════════════════════════════════════════════════════════ */

/* ── S12: Quarterly Cash Flow Statement KPIs ────────────────────────── */
export const CASHFLOW_KPIS = [
  { label: 'Operating Cash Flow', value: 'AED 1.8M', delta: '▲ 22% vs Plan', positive: true, sub: 'FY 2025 Forecast' },
  { label: 'Free Cash Flow', value: 'AED 1.2M', delta: '▲ 18% vs Plan', positive: true, sub: 'After CAPEX' },
  { label: 'Cash Balance', value: 'AED 2.4M', delta: '▲ AED 350K', positive: true, sub: 'End Dec 2025F' },
  { label: 'Cash Burn Rate', value: 'AED 165K/mo', delta: '▼ 8% (Better)', positive: true, sub: 'Current Run Rate' },
  { label: 'Runway', value: '14.5 Months', delta: '▼ 0.5 Mo', positive: false, sub: 'At Current Burn' },
] as const;

/* ── S12: Quarterly Cash Flow Table ──────────────────────────────────── */
export type CFRow = {
  label: string;
  q1: number; q2: number; q3: number; q4: number; fy: number;
  indent?: boolean; bold?: boolean; section?: string; highlight?: boolean;
};

export const CF_QUARTERLY_DATA: CFRow[] = [
  { label: 'Operating Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'operating', bold: true },
  { label: 'Net Income', q1: 180, q2: 245, q3: 310, q4: 385, fy: 1120, indent: true },
  { label: 'Depreciation & Amortization', q1: 24, q2: 24, q3: 28, q4: 28, fy: 104, indent: true },
  { label: 'Changes in Working Capital', q1: -35, q2: -18, q3: 12, q4: 25, fy: -16, indent: true },
  { label: 'Other Operating Adjustments', q1: 8, q2: 12, q3: 15, q4: 18, fy: 53, indent: true },
  { label: 'Net Cash from Operations', q1: 177, q2: 263, q3: 365, q4: 456, fy: 1261, bold: true, highlight: true },
  { label: 'Investing Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'investing', bold: true },
  { label: 'Kitchen Build-Out (CAPEX)', q1: -350, q2: -120, q3: -350, q4: 0, fy: -820, indent: true },
  { label: 'Equipment Purchases', q1: -80, q2: -30, q3: -85, q4: -15, fy: -210, indent: true },
  { label: 'Technology Investment', q1: -25, q2: -15, q3: -20, q4: -10, fy: -70, indent: true },
  { label: 'Net Cash from Investing', q1: -455, q2: -165, q3: -455, q4: -25, fy: -1100, bold: true, highlight: true },
  { label: 'Financing Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'financing', bold: true },
  { label: 'Equity Injection (Seed)', q1: 2500, q2: 0, q3: 0, q4: 0, fy: 2500, indent: true },
  { label: 'Debt Drawdown', q1: 0, q2: 0, q3: 400, q4: 0, fy: 400, indent: true },
  { label: 'Debt Repayment', q1: 0, q2: -25, q3: -25, q4: -50, fy: -100, indent: true },
  { label: 'Net Cash from Financing', q1: 2500, q2: -25, q3: 375, q4: -50, fy: 2800, bold: true, highlight: true },
  { label: 'Net Change in Cash', q1: 2222, q2: 73, q3: 285, q4: 381, fy: 2961, bold: true, highlight: true },
  { label: 'Opening Cash Balance', q1: 200, q2: 2422, q3: 2495, q4: 2780, fy: 200, indent: true },
  { label: 'Closing Cash Balance', q1: 2422, q2: 2495, q3: 2780, q4: 3161, fy: 3161, bold: true, highlight: true },
];

/* ── S12: FCF Rolling 12-Month ──────────────────────────────────────── */
export const FCF_MONTHLY = [
  { month: 'Jan', fcf: -180 }, { month: 'Feb', fcf: -150 }, { month: 'Mar', fcf: -120 },
  { month: 'Apr', fcf: -80 },  { month: 'May', fcf: -40 },  { month: 'Jun', fcf: 20 },
  { month: 'Jul', fcf: 55 },   { month: 'Aug', fcf: 85 },   { month: 'Sep', fcf: 120 },
  { month: 'Oct', fcf: 145 },  { month: 'Nov', fcf: 170 },  { month: 'Dec', fcf: 200 },
] as const;

/* ── S04: Monthly Cash Flow Waterfall (12 months) ───────────────────── */
export const CASH_FLOW_MONTHLY = [
  { month: 'Jan', opening: 2800, opCF: 62, capex: -30, funding: 0, closing: 2832 },
  { month: 'Feb', opening: 2832, opCF: 68, capex: -35, funding: 0, closing: 2865 },
  { month: 'Mar', opening: 2865, opCF: 75, capex: -40, funding: 0, closing: 2900 },
  { month: 'Apr', opening: 2900, opCF: 82, capex: -120, funding: 0, closing: 2862 },
  { month: 'May', opening: 2862, opCF: 78, capex: -45, funding: 0, closing: 2895 },
  { month: 'Jun', opening: 2895, opCF: 85, capex: -35, funding: 0, closing: 2945 },
  { month: 'Jul', opening: 2945, opCF: 92, capex: -30, funding: 0, closing: 3007 },
  { month: 'Aug', opening: 3007, opCF: 98, capex: -25, funding: 0, closing: 3080 },
  { month: 'Sep', opening: 3080, opCF: 90, capex: -35, funding: 500, closing: 3635 },
  { month: 'Oct', opening: 3635, opCF: 102, capex: -30, funding: 0, closing: 3707 },
  { month: 'Nov', opening: 3707, opCF: 110, capex: -25, funding: 0, closing: 3792 },
  { month: 'Dec', opening: 3792, opCF: 118, capex: -30, funding: 0, closing: 3880 },
] as const;

/* ── S04: Funding Events Timeline ───────────────────────────────────── */
export const FUNDING_EVENTS = [
  { event: 'Seed Round', date: 'May 2024', amount: 'AED 2.5M', type: 'Equity', status: 'Completed', statusColor: 'bg-green-100 text-green-700' },
  { event: 'Working Capital Facility', date: 'Jan 2025', amount: 'AED 300K', type: 'Debt', status: 'Active', statusColor: 'bg-blue-100 text-blue-700' },
  { event: 'Equipment Financing', date: 'Mar 2025', amount: 'AED 150K', type: 'Lease', status: 'Active', statusColor: 'bg-blue-100 text-blue-700' },
  { event: 'Series A', date: 'Q3 2025 (Target)', amount: 'AED 8.0M', type: 'Equity', status: 'Pipeline', statusColor: 'bg-amber-100 text-amber-700' },
] as const;

/* ── S04: Burn Rate Trend (12 months) ───────────────────────────────── */
export const BURN_RATE_MONTHLY = [185, 176, 172, 195, 180, 175, 168, 162, 170, 158, 150, 145] as const;

/* ── Type helpers ── */
export type CashFlowKpi = typeof CASHFLOW_KPIS[number];
export type FcfMonthly = typeof FCF_MONTHLY[number];
export type FundingEvent = typeof FUNDING_EVENTS[number];
