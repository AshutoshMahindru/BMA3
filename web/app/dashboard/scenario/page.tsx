"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S03: SCENARIO COMPARISON CONSOLE — Full Spec Build
   Wireframe v4.0: Scenario Definitions table (4 scenarios),
   3-Year P&L Comparison (8 line items × 8 columns), Tornado Chart (6 drivers)
   ══════════════════════════════════════════════════════════════════════ */

import { GitCompare, TrendingUp, TrendingDown, AlertCircle, BarChart3, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';
import { SCENARIO_DEFS, PNL_COMPARISON, COMPARISON_YEARS, TORNADO_DRIVERS } from '@/lib/data/scenarios';

/* ── Aliases for backward compatibility ── */
const scenarioDefs = SCENARIO_DEFS;
const pnlComparison = PNL_COMPARISON;
const years = COMPARISON_YEARS;
const tornadoDrivers = TORNADO_DRIVERS;
const maxTornado = Math.max(...tornadoDrivers.map(d => Math.max(Math.abs(d.upside), Math.abs(d.downside))));

export default function ScenarioComparisonConsole() {
  const ctx = usePlanningContext();
  const fmt = (v: number | string) => {
    if (typeof v === 'string') return v;
    const neg = v < 0;
    const abs = Math.abs(v);
    return `${neg ? '-' : ''}AED ${abs >= 1000 ? (abs / 1000).toFixed(1) + 'M' : abs + 'K'}`;
  };

  return (
    <div className="flex-1 flex flex-col">

      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[#1E5B9C]" />
            Scenario Comparison Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — Multi-Scenario Analysis — {ctx.timePeriodLabel}
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line Item','Base 25','Base 26','Base 27','Bull 25','Bull 26','Bull 27','Bear 25','Bear 26','Bear 27']; const r=pnlComparison.map(p=>[p.item,...p.base,...p.bull,...p.bear]); exportCSV('Scenario_PnL_Comparison',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line Item','Base 25','Base 26','Base 27','Bull 25','Bull 26','Bull 27','Bear 25','Bear 26','Bear 27']; const r=pnlComparison.map(p=>[p.item,...p.base,...p.bull,...p.bear]); exportPDF('Scenario P&L Comparison',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* ═══════ SCENARIO DEFINITIONS TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1E5B9C]" />
              Scenario Definitions
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Scenario', 'Growth Rate', 'Avg Order Value', 'Commission', 'New Kitchens', 'Start Date', 'Probability'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scenarioDefs.map((s, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.tag}`}>{s.name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{s.growth}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{s.aov}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{s.commission}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{s.newKitchens}</td>
                    <td className="px-4 py-3 text-gray-600">{s.startDate}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{s.probability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ 3-YEAR P&L COMPARISON TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              3-Year P&L Comparison (AED &apos;000s)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-r border-white/10 w-[160px]">Line Item</th>
                  {['Base Case', 'Bull Case', 'Bear Case', 'Stress Test'].map(scenario => (
                    years.map(yr => (
                      <th key={`${scenario}-${yr}`} className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider border-r border-white/10 last:border-r-0">
                        <div className="text-[9px] text-blue-200 font-medium">{scenario}</div>
                        <div>{yr}</div>
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pnlComparison.map((row, idx) => {
                  const isHighlight = ['EBITDA', 'Net Income'].includes(row.item);
                  return (
                    <tr key={idx} className={`transition ${isHighlight ? 'bg-blue-50/50 font-bold' : idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''} hover:bg-blue-50/30`}>
                      <td className={`px-4 py-2.5 border-r border-gray-100 whitespace-nowrap ${isHighlight ? 'font-bold text-[#1B2A4A]' : 'font-semibold text-gray-700'}`}>
                        {row.item}
                      </td>
                      {[row.base, row.bull, row.bear, row.stress].map((scenarioData, sIdx) =>
                        scenarioData.map((val: any, yIdx: number) => {
                          const isNeg = typeof val === 'number' && val < 0;
                          return (
                            <td key={`${sIdx}-${yIdx}`} className={`px-3 py-2.5 text-right font-mono border-r border-gray-50 last:border-r-0 ${
                              isNeg ? 'text-[#C0392B]' : isHighlight ? 'text-[#1B2A4A]' : 'text-gray-700'
                            }`}>
                              {typeof val === 'string' ? val : fmt(val)}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ TORNADO CHART ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#1E5B9C]" />
            EBITDA Sensitivity — Tornado Chart (AED &apos;000s Variance from Base)
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">Shows EBITDA impact when each driver is stressed ±20% from Base Case assumptions</p>
          <div className="space-y-3">
            {tornadoDrivers.map((driver, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-40 text-right text-xs font-semibold text-gray-700 shrink-0 truncate">{driver.name}</div>
                <div className="flex-1 flex items-center h-7">
                  <div className="flex-1 flex justify-end">
                    <div
                      className="h-6 bg-[#C0392B] rounded-l-md flex items-center justify-start px-1.5"
                      style={{ width: `${(Math.abs(driver.downside) / maxTornado) * 100}%` }}
                    >
                      <span className="text-[9px] font-bold text-white whitespace-nowrap">{driver.downside}</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-gray-400 shrink-0" />
                  <div className="flex-1">
                    <div
                      className="h-6 bg-[#1A7A4A] rounded-r-md flex items-center justify-end px-1.5"
                      style={{ width: `${(Math.abs(driver.upside) / maxTornado) * 100}%` }}
                    >
                      <span className="text-[9px] font-bold text-white whitespace-nowrap">+{driver.upside}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
              <div className="w-40" />
              <div className="flex-1 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>← Downside Risk</span>
                <span>Upside Potential →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>Intelligence Note:</strong> The Bull Case assumes successful renegotiation of Talabat commission to 25% and 4 new kitchen launches on schedule.
            Under the Stress Test, cash runway falls below 4 months by Q2 2027, triggering an automatic funding alert. Bear Case
            becomes viable only if marketing CAC stays below AED 40.
          </p>
        </div>
      </div>
    </div>
  );
}
