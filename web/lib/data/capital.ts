/* ══════════════════════════════════════════════════════════════════════════
   SHARED CAPITAL DATA MODULE — Single source of truth
   Consumed by: S05 (Capital Strategy Console)
   ══════════════════════════════════════════════════════════════════════ */

/** Kitchen investment ladder (IRR-ranked) */
export const INVESTMENT_LADDER = [
  { kitchen: 'JLT North', capex: 350, irr: '35%', payback: '14 mo', npv: '1,420', status: 'Live', statusColor: 'bg-green-100 text-green-700' },
  { kitchen: 'Marina', capex: 340, irr: '28%', payback: '16 mo', npv: '1,180', status: 'Live', statusColor: 'bg-green-100 text-green-700' },
  { kitchen: 'Downtown', capex: 380, irr: '22%', payback: '20 mo', npv: '890', status: 'Planned', statusColor: 'bg-amber-100 text-amber-700' },
  { kitchen: 'JBR', capex: 320, irr: '18%', payback: '22 mo', npv: '520', status: 'Pipeline', statusColor: 'bg-blue-100 text-blue-700' },
  { kitchen: 'Business Bay', capex: 360, irr: '15%', payback: '24 mo', npv: '340', status: 'Pipeline', statusColor: 'bg-blue-100 text-blue-700' },
] as const;

/** 5×5 Return Sensitivity Matrix axes */
export const ORDERS_RANGE = [100, 120, 145, 170, 200] as const;
export const ASP_RANGE = [48, 55, 62, 70, 78] as const;

/** IRR estimates (%) for volume × price interaction */
export const SENSITIVITY_MATRIX = [
  [  5,  10,  15,  18,  22],
  [ 10,  16,  22,  26,  30],
  [ 15,  22,  28,  34,  40],
  [ 20,  28,  35,  42,  48],
  [ 25,  34,  42,  50,  58],
] as const;

/** Cap Table — Pre/Post Series A */
export const CAP_TABLE = [
  { round: 'Founders', shares: '5,000,000', pct: '62.5%', value: 'AED 7.5M' },
  { round: 'Seed Investors', shares: '2,000,000', pct: '25.0%', value: 'AED 3.0M' },
  { round: 'ESOP Pool', shares: '1,000,000', pct: '12.5%', value: 'AED 1.5M' },
  { round: 'Series A (Proj.)', shares: '2,400,000', pct: '23.1% (diluted)', value: 'AED 8.0M' },
] as const;

/* ── Type helpers ── */
export type InvestmentLadderRow = typeof INVESTMENT_LADDER[number];
export type CapTableRow = typeof CAP_TABLE[number];
