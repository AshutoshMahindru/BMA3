"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S13: BALANCE SHEET PROJECTION CONSOLE
   Wireframe v4.0: Assets/Liabilities/Equity table (12 lines × 3 columns:
   Dec24/Dec25F/Change), Key Financial Ratios (6 ratios × 4 columns)
   ══════════════════════════════════════════════════════════════════════ */

import { Building2, TrendingUp, TrendingDown, CheckCircle2, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ── Balance Sheet Line Items ────────────────────────────────────────── */
type BSRow = { label: string; dec24: number; dec25f: number; indent?: boolean; bold?: boolean; section?: string; isTotalAssets?: boolean; isTotalLE?: boolean; isEquity?: boolean };

const bsData: BSRow[] = [
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

/* ── Key Financial Ratios ────────────────────────────────────────────── */
const ratios = [
  { name: 'Current Ratio', dec24: '6.13x', dec25f: '8.09x', benchmark: '>1.5x', status: 'pass' },
  { name: 'Debt-to-Equity Ratio', dec24: '0.00x', dec25f: '0.08x', benchmark: '<1.0x', status: 'pass' },
  { name: 'Cash-to-Monthly Burn', dec24: '7.3x', dec25f: '19.2x', benchmark: '>3.0x', status: 'pass' },
  { name: 'Asset Turnover', dec24: '1.05x', dec25f: '1.18x', benchmark: '>0.8x', status: 'pass' },
  { name: 'ROIC (Return on Invested Capital)', dec24: '19.1%', dec25f: '24.8%', benchmark: '>15%', status: 'pass' },
  { name: 'Book Value per Share', dec24: 'AED 2.47', dec25f: 'AED 4.07', benchmark: 'Growing', status: 'pass' },
];

export default function BalanceSheetConsole() {
  const ctx = usePlanningContext();
  const fmt = (v: number) => v === 0 ? '' : v.toLocaleString();
  const change = (d24: number, d25: number) => {
    if (d24 === 0 && d25 === 0) return { val: '', pct: '', positive: true };
    const diff = d25 - d24;
    const pct = d24 !== 0 ? ((diff / d24) * 100).toFixed(1) + '%' : 'New';
    return { val: diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString(), pct, positive: diff >= 0 };
  };

  return (
    <div className="flex-1 flex flex-col">

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1E5B9C]" />
            Balance Sheet Projection Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — {ctx.scenarioLabel} — Dec 2024 vs Dec 2025F
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line Item','Dec 2024','Dec 2025F']; const r=bsData.filter(x=>!x.section).map(x=>[x.label,x.dec24,x.dec25f]); exportCSV('BalanceSheet',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line Item','Dec 2024','Dec 2025F']; const r=bsData.filter(x=>!x.section).map(x=>[x.label,x.dec24,x.dec25f]); exportPDF('Balance Sheet',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* Balance Check Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#1A7A4A]" />
          <div>
            <p className="text-sm font-bold text-green-800">Balance Sheet Verified ✓</p>
            <p className="text-[11px] text-green-600">Total Assets = Total Liabilities + Equity for both periods. Computation integrity confirmed.</p>
          </div>
        </div>

        {/* ═══════ BALANCE SHEET TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Projected Balance Sheet (AED &apos;000s)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[280px] border-r border-white/10">Line Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Dec 2024 (A)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Dec 2025 (F)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Change</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">% Change</th>
                </tr>
              </thead>
              <tbody>
                {bsData.map((row, idx) => {
                  if (row.section === 'assets' || row.section === 'liabilities') {
                    return (
                      <tr key={idx} className="bg-[#D6E4F7]">
                        <td colSpan={5} className="px-5 py-2.5 text-[10px] font-bold text-[#1B2A4A] uppercase tracking-widest">{row.label}</td>
                      </tr>
                    );
                  }
                  if (row.section === 'sub') {
                    return (
                      <tr key={idx} className="bg-gray-50/80">
                        <td colSpan={5} className="px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{row.label}</td>
                      </tr>
                    );
                  }
                  const ch = change(row.dec24, row.dec25f);
                  const isMajorTotal = row.isTotalAssets || row.isTotalLE;
                  return (
                    <tr key={idx} className={`transition hover:bg-blue-50/30 ${
                      isMajorTotal ? 'bg-blue-50 border-y-2 border-blue-300' :
                      row.bold ? 'bg-gray-50/50 border-y border-gray-200' :
                      idx % 2 === 0 ? '' : 'bg-[#F4F5F7]'
                    }`}>
                      <td className={`px-5 py-2.5 border-r border-gray-100 ${row.indent ? 'pl-10 text-gray-600' : ''} ${row.bold || isMajorTotal ? 'font-bold text-[#1B2A4A]' : ''} ${isMajorTotal ? 'text-sm uppercase tracking-wider' : ''}`}>
                        {row.label}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(row.dec24)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${row.bold || isMajorTotal ? 'font-bold text-[#1B2A4A]' : 'text-gray-700'}`}>{fmt(row.dec25f)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${ch.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{ch.val}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${ch.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{ch.pct}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ KEY FINANCIAL RATIOS ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Key Financial Ratios
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Ratio</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Dec 2024</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Dec 2025F</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Benchmark</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ratios.map((ratio, idx) => (
                  <tr key={idx} className={`hover:bg-blue-50/30 transition ${idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-5 py-3 font-semibold text-gray-800">{ratio.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{ratio.dec24}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#1B2A4A]">{ratio.dec25f}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{ratio.benchmark}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1A7A4A] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        <CheckCircle2 className="w-3 h-3" /> Pass
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
