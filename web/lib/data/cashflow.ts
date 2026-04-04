/* STUB — temporary until Wave 4 API wiring. See WAVE_STATUS.md. */
export type CFRow = {
  label: string;
  values?: number[];
  section?: string;
  bold?: boolean;
  indent?: boolean;
  isHeader?: boolean;
  isBold?: boolean;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  fy?: number;
  highlight?: boolean;
};
export const CASHFLOW_KPIS: { label: string; value: string; delta: string; positive: boolean; sub: string }[] = [];
export const CF_QUARTERLY_DATA: CFRow[] = [];
export const FCF_MONTHLY: any[] = [];
export const CASH_FLOW_MONTHLY: any[] = [];
export const FUNDING_EVENTS: any[] = [];
export const BURN_RATE_MONTHLY: any[] = [];
