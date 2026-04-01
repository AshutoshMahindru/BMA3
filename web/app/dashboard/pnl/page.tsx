"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S11: P&L PROJECTION CONSOLE — Full Spec Build
   Wireframe v4.0: Monthly P&L table (13 line items × 13 months + FY total),
   EBITDA Bridge waterfall (6 drivers)
   ══════════════════════════════════════════════════════════════════════ */

import { DollarSign, TrendingUp, TrendingDown, BarChart3, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ── Monthly P&L Data (12 months) ───────────────────────────────────── */
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type PnLRow = { label: string; values: number[]; fy: number; indent?: boolean; bold?: boolean; highlight?: 'ebitda' | 'subtotal'; pctRow?: boolean; negative?: boolean; separator?: boolean };

const pnlData: PnLRow[] = [
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

/* ── EBITDA Bridge Waterfall ─────────────────────────────────────────── */
const ebitdaBridge = [
  { label: 'Revenue Growth', value: 420, positive: true },
  { label: 'Gross Margin Improvement', value: 85, positive: true },
  { label: 'Cost Optimization', value: 35, positive: true },
  { label: 'Labor Cost Increase', value: -65, positive: false },
  { label: 'Rent Expansion', value: -42, positive: false },
  { label: 'Marketing Increase', value: -38, positive: false },
];
const maxBridge = Math.max(...ebitdaBridge.map(b => Math.abs(b.value)));

export default function PnlConsole() {
  const fmt = (val: number) =>
    new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val);

  const fmtPct = (val: number) => val.toFixed(1) + '%';

  // Summary KPIs
  const annualizedRevenue = pnlData[2].fy; // Net Revenue FY
  const ebitdaMarginLast = pnlData[11].values[11]; // Dec EBITDA margin
  const ctx = usePlanningContext();

  return (
    <div className="flex-1 flex flex-col">

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#1E5B9C]" />
              P&L Projection Console
            </h1>
             <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              {ctx.scopeLabel} — {ctx.scenarioLabel} — {ctx.timePeriodLabel}
              <DataFreshness />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = ['Line Item', ...months, 'FY Total'];
                const rows = pnlData.map(r => [r.label, ...r.values.map(String), String(r.fy)]);
                exportCSV(`PnL_${ctx.scenarioLabel.replace(/ /g,'_')}`, headers, rows);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => {
                const headers = ['Line Item', ...months, 'FY Total'];
                const rows = pnlData.map(r => [r.label, ...r.values.map(String), String(r.fy)]);
                exportPDF(`P&L Projection — ${ctx.scenarioLabel}`, headers, rows);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Export PDF
            </button>
            <div className="bg-white border border-gray-200 px-5 py-3 rounded-xl shadow-sm text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">FY Net Revenue</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">AED {fmt(annualizedRevenue)}K</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-5 py-3 rounded-xl shadow-sm text-center">
              <p className="text-[10px] text-[#1E5B9C] font-bold uppercase tracking-widest">Dec EBITDA Margin</p>
              <p className="text-lg font-bold text-[#1B2A4A] mt-0.5">{fmtPct(ebitdaMarginLast)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* ═══════ MONTHLY P&L TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Monthly P&L Statement (AED '000s)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-wider w-[200px] border-r border-white/10 sticky left-0 bg-[#1B2A4A] z-10">Line Item</th>
                  {months.map(m => (
                    <th key={m} className="px-2.5 py-3 text-right text-[9px] font-bold uppercase tracking-wider min-w-[65px]">{m}</th>
                  ))}
                  <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-wider bg-white/10 min-w-[75px]">FY 2025</th>
                </tr>
              </thead>
              <tbody>
                {pnlData.map((row, idx) => (
                  <tr key={idx} className={`transition ${
                    row.highlight === 'ebitda' ? 'bg-blue-50 border-y-2 border-blue-300' :
                    row.highlight === 'subtotal' ? 'bg-gray-50/80 border-y border-gray-200' :
                    row.pctRow ? 'bg-blue-50/30' :
                    idx % 2 === 0 ? '' : 'bg-[#F4F5F7]'
                  } hover:bg-blue-50/30`}>
                    <td className={`px-4 py-2 border-r border-gray-100 sticky left-0 z-10 whitespace-nowrap ${
                      row.highlight === 'ebitda' ? 'bg-blue-50 font-bold text-[#1B2A4A] text-xs uppercase tracking-wider' :
                      row.highlight === 'subtotal' ? 'bg-gray-50/80 font-bold text-gray-900' :
                      row.pctRow ? 'bg-blue-50/30 text-[#1E5B9C] italic font-medium pl-8' :
                      row.indent ? 'pl-8 text-gray-500 bg-white' :
                      'font-semibold text-gray-800 bg-white'
                    }`}>
                      {row.label}
                    </td>
                    {row.values.map((val, vIdx) => (
                      <td key={vIdx} className={`px-2.5 py-2 text-right font-mono ${
                        row.highlight === 'ebitda' ? 'font-bold text-[#1B2A4A]' :
                        row.bold ? 'font-bold text-gray-900' :
                        row.pctRow ? 'text-[#1E5B9C] italic' :
                        row.negative ? 'text-gray-500' :
                        'text-gray-700'
                      }`}>
                        {row.pctRow ? fmtPct(val)
                          : row.negative ? `(${fmt(val)})` : fmt(val)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right font-mono bg-gray-50/50 ${
                      row.highlight === 'ebitda' ? 'font-bold text-[#1B2A4A] text-xs' :
                      row.bold ? 'font-bold text-gray-900' :
                      row.pctRow ? 'text-[#1E5B9C] italic font-bold' :
                      row.negative ? 'text-gray-500' :
                      'text-gray-700 font-bold'
                    }`}>
                      {row.pctRow ? fmtPct(row.fy)
                        : row.negative ? `(${fmt(row.fy)})` : fmt(row.fy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ EBITDA BRIDGE WATERFALL ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#1E5B9C]" />
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              EBITDA Bridge — Year-over-Year Drivers (AED '000s)
            </h3>
          </div>
          <div className="space-y-2.5">
            {ebitdaBridge.map((driver, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-48 text-right text-xs font-semibold text-gray-700 shrink-0 truncate">{driver.label}</div>
                <div className="flex-1 flex items-center h-7">
                  {!driver.positive && (
                    <div className="flex-1 flex justify-end">
                      <div
                        className="h-5 bg-[#C0392B] rounded-l-md flex items-center justify-start px-1.5"
                        style={{ width: `${(Math.abs(driver.value) / maxBridge) * 50}%` }}
                      >
                        <span className="text-[9px] font-bold text-white whitespace-nowrap">{driver.value}</span>
                      </div>
                    </div>
                  )}
                  {!driver.positive && <div className="w-px h-7 bg-gray-300 shrink-0" />}
                  {driver.positive && <div className="w-px h-7 bg-gray-300 shrink-0" />}
                  {driver.positive && (
                    <div className="flex-1">
                      <div
                        className="h-5 bg-[#1A7A4A] rounded-r-md flex items-center justify-end px-1.5"
                        style={{ width: `${(Math.abs(driver.value) / maxBridge) * 50}%` }}
                      >
                        <span className="text-[9px] font-bold text-white whitespace-nowrap">+{driver.value}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
