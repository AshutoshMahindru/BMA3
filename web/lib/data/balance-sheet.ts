/* STUB — temporary until Wave 4 API wiring. See WAVE_STATUS.md. */
export type BSRow = {
  label: string;
  values?: number[];
  section?: string;
  dec24?: number;
  dec25f?: number;
  bold?: boolean;
  indent?: boolean;
  isHeader?: boolean;
  isBold?: boolean;
};
export const BS_DATA: BSRow[] = [];
export const FINANCIAL_RATIOS: { label: string; dec24: string; dec25f: string; unit: string }[] = [];
