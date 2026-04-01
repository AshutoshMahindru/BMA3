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

/* ── KPI Data ─────────────────────────────────────────────────────────── */
const kpis = [
  { label: 'Operating Cash Flow', value: 'AED 1.8M', delta: '▲ 22% vs Plan', positive: true, sub: 'FY 2025 Forecast' },
  { label: 'Free Cash Flow', value: 'AED 1.2M', delta: '▲ 18% vs Plan', positive: true, sub: 'After CAPEX' },
  { label: 'Cash Balance', value: 'AED 2.4M', delta: '▲ AED 350K', positive: true, sub: 'End Dec 2025F' },
  { label: 'Cash Burn Rate', value: 'AED 165K/mo', delta: '▼ 8% (Better)', positive: true, sub: 'Current Run Rate' },
  { label: 'Runway', value: '14.5 Months', delta: '▼ 0.5 Mo', positive: false, sub: 'At Current Burn' },
];

/* ── Quarterly Cash Flow Table Data ──────────────────────────────────── */
type CFRow = { label: string; q1: number; q2: number; q3: number; q4: number; fy: number; indent?: boolean; bold?: boolean; section?: string; highlight?: boolean };

const cfData: CFRow[] = [
  { label: 'Operating Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'operating', bold: true },
  { label: 'Net Income', q1: 180, q2: 245, q3: 310, q4: 385, fy: 1120, indent: true },
  { label: 'Depreciation & Amortization', q1: 24, q2: 24, q3: 28, q4: 28, fy: 104, indent: true },
  { label: 'Changes in Working Capital', q1: -35, q2: -18, q3: 12, q4: 25, fy: -16, indent: true },
  { label: 'Other Operating Adjustments', q1: 8, q2: 12, q3: 15, q4: 18, fy: 53, indent: true },
  { label: 'Net Cash from Operations', q1: 177, q2: 263, q3: 365, q4: 456, fy: 1261, bold: true, highlight: true },
  { label: 'Investing Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'investing', bold: true },
  { label: 'Kitchen Build-Out (CAPEX)', q1: -350, q2: -120, q3: -350, q4: 0, fy: -820, indent: true },
  { label: 'Equipment Purchases', q1: -80, q2: -30, q3: -85, q4: -15, fy: -210, indent: true },
  { label: 'Technology Investment', q1: -25, q2: -15, q3: -20, q4: -10, fy: -70, indent: true },
  { label: 'Net Cash from Investing', q1: -455, q2: -165, q3: -455, q4: -25, fy: -1100, bold: true, highlight: true },
  { label: 'Financing Activities', q1: 0, q2: 0, q3: 0, q4: 0, fy: 0, section: 'financing', bold: true },
  { label: 'Equity Injection (Seed)', q1: 2500, q2: 0, q3: 0, q4: 0, fy: 2500, indent: true },
  { label: 'Debt Drawdown', q1: 0, q2: 0, q3: 400, q4: 0, fy: 400, indent: true },
  { label: 'Debt Repayment', q1: 0, q2: -25, q3: -25, q4: -50, fy: -100, indent: true },
  { label: 'Net Cash from Financing', q1: 2500, q2: -25, q3: 375, q4: -50, fy: 2800, bold: true, highlight: true },
  { label: 'Net Change in Cash', q1: 2222, q2: 73, q3: 285, q4: 381, fy: 2961, bold: true, highlight: true },
  { label: 'Opening Cash Balance', q1: 200, q2: 2422, q3: 2495, q4: 2780, fy: 200, indent: true },
  { label: 'Closing Cash Balance', q1: 2422, q2: 2495, q3: 2780, q4: 3161, fy: 3161, bold: true, highlight: true },
];

/* ── FCF Rolling 12-Month ────────────────────────────────────────────── */
const fcfMonthly = [
  { month: 'Jan', fcf: -180 }, { month: 'Feb', fcf: -150 }, { month: 'Mar', fcf: -120 },
  { month: 'Apr', fcf: -80 }, { month: 'May', fcf: -40 }, { month: 'Jun', fcf: 20 },
  { month: 'Jul', fcf: 55 }, { month: 'Aug', fcf: 85 }, { month: 'Sep', fcf: 120 },
  { month: 'Oct', fcf: 145 }, { month: 'Nov', fcf: 170 }, { month: 'Dec', fcf: 200 },
];
const maxFCF = Math.max(...fcfMonthly.map(m => Math.abs(m.fcf)));

export default function CashflowConsole() {
  const ctx = usePlanningContext();
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
            {ctx.scopeLabel} — {ctx.scenarioLabel} — {ctx.timePeriodLabel}
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line Item','Q1','Q2','Q3','Q4','FY']; const r=cfData.filter(x=>!x.section).map(x=>[x.label,x.q1,x.q2,x.q3,x.q4,x.fy]); exportCSV('CashFlow',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line Item','Q1','Q2','Q3','Q4','FY']; const r=cfData.filter(x=>!x.section).map(x=>[x.label,x.q1,x.q2,x.q3,x.q4,x.fy]); exportPDF('Cash Flow Statement',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map(kpi => (
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
                          row.bold ? 'font-bold text-[#1B2A4A]' : val < 0 ? 'text-[#C0392B]' : 'text-gray-700'
                        } ${vIdx === 4 ? 'bg-gray-50/50 font-bold' : ''}`}>
                          {fmt(val)}
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
