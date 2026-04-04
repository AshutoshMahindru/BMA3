"use client";

import { TrendingUp, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { PORTFOLIO_KPIS } from '@/lib/data/kpis';
import { INVESTMENT_LADDER, ORDERS_RANGE, ASP_RANGE, SENSITIVITY_MATRIX, CAP_TABLE } from '@/lib/data/capital';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════ S05: Capital Strategy Console ══════════════════════ */

const kpis = [
  { label: 'Portfolio IRR', value: `${PORTFOLIO_KPIS.portfolioIrr}%`, delta: '▲ 3% vs Target', positive: true },
  { label: 'NPV (8% WACC)', value: 'AED 4.2M', delta: '▲ 12% vs Plan', positive: true },
  { label: 'ROIC', value: `${PORTFOLIO_KPIS.roic}%`, delta: '▲ 5pp vs Prior', positive: true },
  { label: 'Payback Period', value: `${PORTFOLIO_KPIS.paybackPeriod} mo`, delta: '▼ 2 Mo (Better)', positive: true },
  { label: 'Hurdle Rate', value: '15%', delta: 'Cleared ✓', positive: true },
];

const investmentLadder = INVESTMENT_LADDER;
const ordersRange = ORDERS_RANGE;
const aspRange = ASP_RANGE;
const sensitivityMatrix = SENSITIVITY_MATRIX;
const capTable = CAP_TABLE;

const cellColor = (v: number) => {
  if (v >= 35) return 'bg-[#1A7A4A] text-white';
  if (v >= 25) return 'bg-green-200 text-green-900';
  if (v >= 15) return 'bg-amber-100 text-amber-800';
  if (v >= 10) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
};

export default function CapitalStrategy() {
  const ctx = usePlanningContext();

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1E5B9C]" /> Capital Strategy & Raise Planning
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — {ctx.timePeriodLabel} — {ctx.scenarioLabel}
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Kitchen','CAPEX (K)','IRR','Payback','NPV (K)','Status']; const r=investmentLadder.map(k=>[k.kitchen,k.capex,k.irr,k.payback,k.npv,k.status]); exportCSV('CapitalStrategy',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Kitchen','CAPEX (K)','IRR','Payback','NPV (K)','Status']; const r=investmentLadder.map(k=>[k.kitchen,k.capex,k.irr,k.payback,k.npv,k.status]); exportPDF('Capital Strategy',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {/* ── 5 KPI Tiles ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1a2744]/20 transition">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
              <p className={`text-[10px] font-medium mt-1 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{kpi.delta}</p>
            </div>
          ))}
        </div>

        {/* ── Investment Ladder (5 kitchens) ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Investment Ladder — Kitchen Portfolio</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Kitchen', 'CAPEX (K)', 'IRR', 'Payback', 'NPV (K)', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {investmentLadder.map((k, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-bold text-gray-800">{k.kitchen}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">AED {k.capex}K</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[#1A7A4A]">{k.irr}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{k.payback}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">AED {k.npv}K</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${k.statusColor}`}>{k.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── 5×5 Return Sensitivity Matrix ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">5×5 Return Sensitivity Matrix — IRR %</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-[8px] font-bold text-gray-400 uppercase pb-2 text-left">Orders/Day ↓  ASP →</th>
                    {aspRange.map(a => (
                      <th key={a} className="text-center text-[9px] font-bold text-gray-500 pb-2 px-1">AED {a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordersRange.map((orders, ri) => (
                    <tr key={orders}>
                      <td className="text-[9px] font-bold text-gray-500 pr-2 py-1">{orders}</td>
                      {sensitivityMatrix[ri].map((val: any, ci: any) => (
                        <td key={ci} className="p-0.5">
                          <div className={`w-full py-2 rounded text-center text-[11px] font-bold ${cellColor(val)}`}>
                            {val}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-gray-400 text-center mt-3">Highlighted cell = current base case ({PORTFOLIO_KPIS.dailyOrders} orders/day × AED {PORTFOLIO_KPIS.avgOrderValue} ASP)</p>
          </div>

          {/* ── Cap Table / Dilution ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Cap Table — Pre/Post Series A</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    {['Round', 'Shares', 'Ownership', 'Value'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {capTable.map((c, i) => (
                    <tr key={i} className={`hover:bg-blue-50/30 transition ${i === capTable.length - 1 ? 'bg-blue-50/50 border-t-2 border-blue-200' : i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                      <td className="px-4 py-2.5 font-bold text-gray-800">{c.round}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-700">{c.shares}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-[#1B2A4A]">{c.pct}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
