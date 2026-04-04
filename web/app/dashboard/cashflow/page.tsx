"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S12: CASH FLOW PROJECTION CONSOLE
   Wireframe v4.0: Quarterly CF table (Operating/Investing/Financing: 10 lines
   × 4 quarters), FCF Rolling 12-Month bar chart
   ══════════════════════════════════════════════════════════════════════ */

import { Banknote, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';
import { CASHFLOW_KPIS, CF_QUARTERLY_DATA, FCF_MONTHLY, type CFRow } from '@/lib/data/cashflow';
import { fetchCashflow } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

/* ── Static fallback ── */
const kpis = CASHFLOW_KPIS;
const fcfMonthly = FCF_MONTHLY;
const maxFCF = Math.max(...fcfMonthly.map(m => Math.abs(m.fcf)));

export default function CashflowConsole() {
  const ctx = usePlanningContext();
  const { data: cfData, source, lastFetched } = useApiData<CFRow[]>(() => fetchCashflow(), CF_QUARTERLY_DATA);
  const fmt = (v: number) => {
    if (v === 0 && cfData.find(r => r.section)) return '';
    const neg = v < 0;
    const abs = Math.abs(v);
    return `${neg ? '(' : ''}${abs.toLocaleString()}${neg ? ')' : ''}`;
  };

  return (
    <div className="flex-1 flex flex-col">

      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1E5B9C]" />
            Cash Flow Projection Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.scenarioName} — {ctx.periodLabel}
            <DataFreshness source={source} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line Item','Q1','Q2','Q3','Q4','FY']; const r=cfData.filter(x=>!x.section).map(x=>[x.label,x.q1??0,x.q2??0,x.q3??0,x.q4??0,x.fy??0]); exportCSV('CashFlow',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line Item','Q1','Q2','Q3','Q4','FY']; const r=cfData.filter(x=>!x.section).map(x=>[x.label,x.q1??0,x.q2??0,x.q3??0,x.q4??0,x.fy??0]); exportPDF('Cash Flow Statement',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map((kpi: any) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1B2A4A]/20 transition">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
              <p className={`text-[10px] font-semibold mt-1 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{kpi.delta}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ═══════ QUARTERLY CASH FLOW TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Quarterly Cash Flow Statement (AED &apos;000s)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[280px] border-r border-white/10">Line Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q1 2025</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q2 2025</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q3 2025</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q4 2025</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider bg-white/10">FY 2025</th>
                </tr>
              </thead>
              <tbody>
                {cfData.map((row, idx) => {
                  if (row.section) {
                    return (
                      <tr key={idx} className="bg-[#D6E4F7]">
                        <td colSpan={6} className="px-5 py-2.5 text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{row.label}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} className={`transition ${row.highlight ? 'bg-blue-50/50 border-y border-blue-200' : idx % 2 === 0 ? '' : 'bg-[#F4F5F7]'} hover:bg-blue-50/30`}>
                      <td className={`px-5 py-2.5 border-r border-gray-100 ${row.indent ? 'pl-10 text-gray-600' : ''} ${row.bold ? 'font-bold text-[#1B2A4A]' : ''}`}>
                        {row.label}
                      </td>
                      {[row.q1, row.q2, row.q3, row.q4, row.fy].map((val, vIdx) => (
                        <td key={vIdx} className={`px-4 py-2.5 text-right font-mono ${
                          row.bold ? 'font-bold text-[#1B2A4A]' : (val ?? 0) < 0 ? 'text-[#C0392B]' : 'text-gray-700'
                        } ${vIdx === 4 ? 'bg-gray-50/50 font-bold' : ''}`}>
                          {fmt(val ?? 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ FCF ROLLING 12-MONTH BAR CHART ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Free Cash Flow — Rolling 12-Month Trend</h3>
            <div className="flex items-center gap-3 text-[10px] font-medium text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1A7A4A]" /> Positive FCF</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C0392B]" /> Negative FCF</span>
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-2 relative">
            {/* Zero line */}
            <div className="absolute left-0 right-0 border-t border-dashed border-gray-300" style={{ bottom: `${(maxFCF / (maxFCF * 2)) * 100}%` }}>
              <span className="text-[9px] text-gray-400 font-bold absolute -left-0 -top-3">0</span>
            </div>
            {fcfMonthly.map(m => {
              const barH = (Math.abs(m.fcf) / maxFCF) * 44;
              const isNeg = m.fcf < 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full relative">
                  <div className="flex-1 flex items-end w-full justify-center" style={{ paddingBottom: isNeg ? '0' : '50%' }}>
                    {!isNeg && (
                      <div className="w-full max-w-[32px] bg-[#1A7A4A] rounded-t-md transition-all hover:opacity-80"
                        style={{ height: `${barH}%` }} />
                    )}
                  </div>
                  {isNeg && (
                    <div className="w-full max-w-[32px] bg-[#C0392B] rounded-b-md transition-all hover:opacity-80"
                      style={{ height: `${barH}%`, position: 'absolute', top: '50%' }} />
                  )}
                  <span className="text-[9px] text-gray-400 font-medium mt-1 absolute bottom-0">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C47A1E]" />
            <p className="text-[11px] text-gray-500">
              FCF turns positive in June 2025 (Month 6). Breakeven achieved ahead of 9-month target.
              Cash generation accelerates H2 with kitchen ramp complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
