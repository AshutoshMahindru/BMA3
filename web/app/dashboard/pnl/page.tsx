"use client";

import { useState, useEffect } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { getFinancialsPnl } from '@/lib/api-client';

/* ══════════════════════════════════════════════════════════════════════════
   S11: P&L PROJECTION CONSOLE — Full Spec Build
   Wireframe v4.0: Monthly P&L table (13 line items × 13 months + FY total),
   EBITDA Bridge waterfall (6 drivers)
   ══════════════════════════════════════════════════════════════════════ */

import { DollarSign, TrendingUp, TrendingDown, BarChart3, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

// ── Types for P&L data returned by the API ────────────────────────────────

interface PnLRow {
  label: string;
  values: number[];
  fy: number;
  highlight?: 'ebitda' | 'subtotal' | string;
  pctRow?: boolean;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
}

interface EbitdaBridgeItem {
  label: string;
  value: number;
  positive: boolean;
}

interface PnlApiResponse {
  periods: string[];
  lineItems: PnLRow[];
  ebitdaBridge?: EbitdaBridgeItem[];
}

export default function PnlConsole() {
  const ctx = usePlanningContext();

  const [pnlData, setPnlData] = useState<PnLRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [ebitdaBridge, setEbitdaBridge] = useState<EbitdaBridgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    getFinancialsPnl({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
    })
      .then((result) => {
        if (result.data) {
          const data = result.data as unknown as PnlApiResponse;
          if (data.lineItems) setPnlData(data.lineItems);
          if (data.periods) setMonths(data.periods);
          if (data.ebitdaBridge) setEbitdaBridge(data.ebitdaBridge);
        }
        setLastFetched(new Date().toISOString());
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load P&L data');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const fmt = (val: number) =>
    new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val);

  const fmtPct = (val: number) => val.toFixed(1) + '%';

  const maxBridge = ebitdaBridge.length > 0
    ? Math.max(...ebitdaBridge.map(b => Math.abs(b.value)))
    : 1;

  // Summary KPIs — index 2 = Net Revenue row, index 11 = EBITDA margin row
  const annualizedRevenue = pnlData[2]?.fy ?? 0;
  const ebitdaMarginLast = pnlData[11]?.values?.[pnlData[11].values.length - 1] ?? 0;

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
              {ctx.companyName} — {ctx.scenarioName} — {ctx.periodLabel}
              <DataFreshness source={loading ? 'loading' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = ['Line Item', ...months, 'FY Total'];
                const rows = pnlData.map(r => [r.label, ...r.values.map(String), String(r.fy)]);
                exportCSV(`PnL_${ctx.scenarioName.replace(/ /g,'_')}`, headers, rows);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => {
                const headers = ['Line Item', ...months, 'FY Total'];
                const rows = pnlData.map(r => [r.label, ...r.values.map(String), String(r.fy)]);
                exportPDF(`P&L Projection — ${ctx.scenarioName}`, headers, rows);
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

        {/* ═══════ LOADING STATE ═══════ */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1E5B9C] rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading P&L data…</p>
            </div>
          </div>
        )}

        {/* ═══════ ERROR STATE ═══════ */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Failed to load P&L data</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* ═══════ EMPTY STATE ═══════ */}
        {!loading && !error && !ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex items-center justify-center">
            <p className="text-sm text-gray-400">Select a company and scenario to view P&L data.</p>
          </div>
        )}

        {/* ═══════ MONTHLY P&L TABLE ═══════ */}
        {!loading && !error && pnlData.length > 0 && (
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
        )}

        {/* ═══════ EBITDA BRIDGE WATERFALL ═══════ */}
        {!loading && !error && ebitdaBridge.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
