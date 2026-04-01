/* ══════════════════════════════════════════════════════════════════════════
   SHARED KPI DATA MODULE — Single source of truth for all financial metrics
   Consumed by: S01 (Home), S02 (Executive), S04 (Cash), S05 (Capital),
   S11 (P&L), S14 (Unit Economics), S20 (Simulation)
   ══════════════════════════════════════════════════════════════════════ */

/** Core operating KPIs — shared across S01 / S02 header cards */
export const PORTFOLIO_KPIS = {
  // Revenue
  grossRevenue:         4_350,   // AED '000 FY
  netRevenue:           3_132,   // AED '000 FY
  revenueGrowth:        31.2,    // % YoY

  // Profitability
  grossProfit:          1_285,   // AED '000 FY
  grossMargin:          41.0,    // %
  ebitda:               395,     // AED '000 FY
  ebitdaMargin:         9.1,     // %

  // Cash
  cashBalance:          2_400,   // AED '000
  cashRunway:           14.5,    // months
  monthlyBurn:          165,     // AED '000/mo
  freeCashFlow:         1_200,   // AED '000 FY

  // Capital
  portfolioIrr:         28.0,    // %
  npv:                  1_845,   // AED '000
  paybackPeriod:        18,      // months
  roic:                 24.8,    // %

  // Operations
  totalKitchens:        2,       // live
  kitchensInPipeline:   3,
  dailyOrders:          145,     // per kitchen avg
  avgOrderValue:        62,      // AED
  platformCommission:   28,      // % Talabat

  // Unit economics
  ebitdaPerOrder:       12.8,    // AED
  cm2PerOrder:          24.5,    // AED
  cacCost:              35,      // AED per acquisition
  customerRetention30d: 68,      // %
  ownChannelMix:        12,      // % of revenue
} as const;

/** Quarter-level P&L snapshot — used on S01 P&L Snapshot table */
export const QUARTERLY_PNL = [
  { quarter: 'Q1 2025', revenue: 680,  ebitda: 52,  ebitdaMargin: 7.6,  fcf: -180 },
  { quarter: 'Q2 2025', revenue: 762,  ebitda: 84,  ebitdaMargin: 11.0, fcf: 73   },
  { quarter: 'Q3 2025', revenue: 820,  ebitda: 118, ebitdaMargin: 14.4, fcf: 285  },
  { quarter: 'Q4 2025', revenue: 870,  ebitda: 141, ebitdaMargin: 16.2, fcf: 381  },
  { quarter: 'FY 2025', revenue: 3132, ebitda: 395, ebitdaMargin: 12.6, fcf: 559  },
] as const;

/** Monthly revenue data — used for sparklines and trend charts */
export const MONTHLY_REVENUE = [
  { month: 'Jan', revenue: 215, ebitda: 12 },
  { month: 'Feb', revenue: 228, ebitda: 18 },
  { month: 'Mar', revenue: 237, ebitda: 22 },
  { month: 'Apr', revenue: 245, ebitda: 26 },
  { month: 'May', revenue: 254, ebitda: 28 },
  { month: 'Jun', revenue: 263, ebitda: 30 },
  { month: 'Jul', revenue: 272, ebitda: 35 },
  { month: 'Aug', revenue: 280, ebitda: 38 },
  { month: 'Sep', revenue: 268, ebitda: 45 },
  { month: 'Oct', revenue: 285, ebitda: 52 },
  { month: 'Nov', revenue: 292, ebitda: 60 },
  { month: 'Dec', revenue: 293, ebitda:   29 },
] as const;

/** Market portfolio summary — used across S01, S16, S18 */
export const MARKET_PORTFOLIO = [
  { name: 'JLT North',      city: 'Dubai',     status: 'Live',      launchQ: 'Q1 2024', monthlyOrders: 4350, monthlyRevenue: 270, ebitdaMargin: 42, decision: 'GO'          },
  { name: 'Marina',         city: 'Dubai',     status: 'Live',      launchQ: 'Q2 2024', monthlyOrders: 3800, monthlyRevenue: 232, ebitdaMargin: 39, decision: 'GO'          },
  { name: 'Downtown',       city: 'Dubai',     status: 'Launching', launchQ: 'Q1 2025', monthlyOrders: 0,    monthlyRevenue: 180, ebitdaMargin: 35, decision: 'GO'          },
  { name: 'JBR',            city: 'Dubai',     status: 'Launching', launchQ: 'Q2 2025', monthlyOrders: 0,    monthlyRevenue: 155, ebitdaMargin: 33, decision: 'CONDITIONAL' },
  { name: 'Business Bay',   city: 'Dubai',     status: 'Planned',   launchQ: 'Q4 2025', monthlyOrders: 0,    monthlyRevenue: 140, ebitdaMargin: 30, decision: 'CONDITIONAL' },
  { name: 'Al Reem Island', city: 'Abu Dhabi', status: 'Planned',   launchQ: 'Q1 2026', monthlyOrders: 0,    monthlyRevenue: 120, ebitdaMargin: 28, decision: 'HOLD'        },
  { name: 'Al Nahda',       city: 'Sharjah',   status: 'Pipeline',  launchQ: 'Q3 2026', monthlyOrders: 0,    monthlyRevenue: 0,   ebitdaMargin: 0,  decision: 'NO-GO'       },
  { name: 'Al Ain Central', city: 'Al Ain',    status: 'Pipeline',  launchQ: 'Q1 2027', monthlyOrders: 0,    monthlyRevenue: 0,   ebitdaMargin: 0,  decision: 'NO-GO'       },
] as const;

/** Active system alerts — used on S02 alerts panel */
export const ACTIVE_ALERTS = [
  { level: 'critical', message: 'Downtown kitchen launch delayed +8 days vs plan', screen: 'S16', action: 'Review Gantt timeline' },
  { level: 'warning',  message: 'Al Ain confidence score 42% — below 50% threshold', screen: 'S10', action: 'Review assumptions' },
  { level: 'info',     message: 'Series A term sheet under CFO review — due 31 Mar', screen: 'S24', action: 'Check governance queue' },
] as const;

/** Type helpers */
export type PortfolioMarket = typeof MARKET_PORTFOLIO[number];
export type QuarterlyPnl    = typeof QUARTERLY_PNL[number];
export type ActiveAlert     = typeof ACTIVE_ALERTS[number];
