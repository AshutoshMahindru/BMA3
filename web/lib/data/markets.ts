/* STUB — temporary until Wave 4 API wiring. See WAVE_STATUS.md. */
export type GanttRow = { kitchen: string; start: number; duration: number; color: string; [key: string]: unknown };
export type MarketRow = { name: string; city: string; status: string; statusColor: string; launchQ: string; orders: string | number; revenue: string | number; margin: string | number; [key: string]: unknown };
export type RolloutPlanData = { quarter?: string; markets: MarketRow[]; gantt: GanttRow[] };
export const ROLLOUT_FALLBACK: RolloutPlanData = { markets: [], gantt: [] };
export const QUARTERS: string[] = [];
