/* STUB — temporary until Wave 2/4 API wiring. See WAVE_STATUS.md. */
export type PnLRow = { label: string; values: number[]; isHeader?: boolean; isBold?: boolean };
export type MonthlyRevenueEbitda = { month: string; revenue: number; ebitda: number };
export const PNL_DATA: PnLRow[] = [];
export const PNL_MONTHS: string[] = [];
export const EBITDA_BRIDGE: any[] = [];
export const EXECUTIVE_MONTHLY_REVENUE_EBITDA: MonthlyRevenueEbitda[] = [];
export const SCENARIO_SNAPSHOT: any = {};
export const PLATFORM_MIX: any[] = [];
export const CF_WATERFALL_BARS: any[] = [];
