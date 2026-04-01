/* ══════════════════════════════════════════════════════════════════════════
   SHARED BALANCE SHEET DATA MODULE — Single source of truth
   Consumed by: S13 (Balance Sheet Console)
   ══════════════════════════════════════════════════════════════════════ */

export type BSRow = {
  label: string;
  dec24: number;
  dec25f: number;
  indent?: boolean;
  bold?: boolean;
  section?: string;
  isTotalAssets?: boolean;
  isTotalLE?: boolean;
  isEquity?: boolean;
};

/** Balance Sheet line items (AED '000s) — Dec 2024 Actual vs Dec 2025 Forecast */
export const BS_DATA: BSRow[] = [
  { label: 'ASSETS', dec24: 0, dec25f: 0, section: 'assets' },
  { label: 'Current Assets', dec24: 0, dec25f: 0, bold: true, section: 'sub' },
  { label: 'Cash & Cash Equivalents', dec24: 1200, dec25f: 3161, indent: true },
  { label: 'Accounts Receivable', dec24: 280, dec25f: 380, indent: true },
  { label: 'Inventory', dec24: 85, dec25f: 110, indent: true },
  { label: 'Prepaid Expenses', dec24: 120, dec25f: 150, indent: true },
  { label: 'Total Current Assets', dec24: 1685, dec25f: 3801, bold: true },
  { label: 'Non-Current Assets', dec24: 0, dec25f: 0, bold: true, section: 'sub' },
  { label: 'Property & Equipment (Net)', dec24: 850, dec25f: 1540, indent: true },
  { label: 'Intangible Assets', dec24: 120, dec25f: 180, indent: true },
  { label: 'Security Deposits', dec24: 90, dec25f: 135, indent: true },
  { label: 'Total Non-Current Assets', dec24: 1060, dec25f: 1855, bold: true },
  { label: 'TOTAL ASSETS', dec24: 2745, dec25f: 5656, bold: true, isTotalAssets: true },
  { label: 'LIABILITIES & EQUITY', dec24: 0, dec25f: 0, section: 'liabilities' },
  { label: 'Current Liabilities', dec24: 0, dec25f: 0, bold: true, section: 'sub' },
  { label: 'Accounts Payable', dec24: 180, dec25f: 240, indent: true },
  { label: 'Accrued Expenses', dec24: 95, dec25f: 130, indent: true },
  { label: 'Current Portion of Debt', dec24: 0, dec25f: 100, indent: true },
  { label: 'Total Current Liabilities', dec24: 275, dec25f: 470, bold: true },
  { label: 'Non-Current Liabilities', dec24: 0, dec25f: 0, bold: true, section: 'sub' },
  { label: 'Long-Term Debt', dec24: 0, dec25f: 300, indent: true },
  { label: 'Total Non-Current Liabilities', dec24: 0, dec25f: 300, bold: true },
  { label: 'Total Liabilities', dec24: 275, dec25f: 770, bold: true },
  { label: "Shareholders' Equity", dec24: 0, dec25f: 0, bold: true, section: 'sub', isEquity: true },
  { label: 'Paid-In Capital', dec24: 2000, dec25f: 4500, indent: true },
  { label: 'Retained Earnings', dec24: 470, dec25f: 386, indent: true },
  { label: "Total Shareholders' Equity", dec24: 2470, dec25f: 4886, bold: true },
  { label: 'TOTAL LIABILITIES & EQUITY', dec24: 2745, dec25f: 5656, bold: true, isTotalLE: true },
];

/** Key Financial Ratios */
export const FINANCIAL_RATIOS = [
  { name: 'Current Ratio', dec24: '6.13x', dec25f: '8.09x', benchmark: '>1.5x', status: 'pass' },
  { name: 'Debt-to-Equity Ratio', dec24: '0.00x', dec25f: '0.08x', benchmark: '<1.0x', status: 'pass' },
  { name: 'Cash-to-Monthly Burn', dec24: '7.3x', dec25f: '19.2x', benchmark: '>3.0x', status: 'pass' },
  { name: 'Asset Turnover', dec24: '1.05x', dec25f: '1.18x', benchmark: '>0.8x', status: 'pass' },
  { name: 'ROIC (Return on Invested Capital)', dec24: '19.1%', dec25f: '24.8%', benchmark: '>15%', status: 'pass' },
  { name: 'Book Value per Share', dec24: 'AED 2.47', dec25f: 'AED 4.07', benchmark: 'Growing', status: 'pass' },
] as const;

export type FinancialRatio = typeof FINANCIAL_RATIOS[number];
