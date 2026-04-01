"use client";

import { useState } from 'react';
import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S11: P&L PROJECTION CONSOLE — Full Spec Build
   Wireframe v4.0: Monthly P&L table (13 line items × 13 months + FY total),
   EBITDA Bridge waterfall (6 drivers)
   ══════════════════════════════════════════════════════════════════════ */

import { DollarSign, TrendingUp, TrendingDown, BarChart3, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';
import { PNL_DATA, PNL_MONTHS, EBITDA_BRIDGE, type PnLRow } from '@/lib/data/pnl';
import { fetchPnl } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

/* ── Static fallback data ── */
const months = PNL_MONTHS;
const ebitdaBridge = EBITDA_BRIDGE;
const maxBridge = Math.max(...ebitdaBridge.map(b => Math.abs(b.value)));

export default function PnlConsole() {
  /* ── API wiring: try live API, fall back to static data ── */
  const { data: pnlData, source, lastFetched } = useApiData<PnLRow[]>(
    () => fetchPnl(),
    PNL_DATA
  );

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
              <DataFreshness source={source} lastFetched={lastFetched} />
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
              Monthly P&L Statement (AED &apos;000s)
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
              EBITDA Bridge — Year-over-Year Drivers (AED &apos;000s)
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
