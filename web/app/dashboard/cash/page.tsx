"use client";

import { Banknote, TrendingDown, TrendingUp, Clock, DollarSign, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { PORTFOLIO_KPIS } from '@/lib/data/kpis';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════ S04: Cash & Funding Console ══════════════════════ */

const kpis = [
  { label: 'Cash Balance', value: `AED ${(PORTFOLIO_KPIS.cashBalance / 1000).toFixed(1)}M`, delta: '▲ 5% vs Plan', positive: true },
  { label: 'Monthly Burn', value: `AED ${PORTFOLIO_KPIS.monthlyBurn}K`, delta: '▼ 8% (Better)', positive: true },
  { label: 'Runway', value: `${PORTFOLIO_KPIS.cashRunway} Months`, delta: '▼ 0.5 Mo vs Plan', positive: false },
  { label: 'Next Funding', value: 'Series A', delta: 'Target: Q2 2025', positive: true },
  { label: 'Debt Outstanding', value: 'AED 450K', delta: '2 Facilities Active', positive: true },
];

const cashFlowMonthly = [
  { month: 'Jan', opening: 2800, opCF: 62, capex: -30, funding: 0, closing: 2832 },
  { month: 'Feb', opening: 2832, opCF: 68, capex: -35, funding: 0, closing: 2865 },
  { month: 'Mar', opening: 2865, opCF: 75, capex: -40, funding: 0, closing: 2900 },
  { month: 'Apr', opening: 2900, opCF: 82, capex: -120, funding: 0, closing: 2862 },
  { month: 'May', opening: 2862, opCF: 78, capex: -45, funding: 0, closing: 2895 },
  { month: 'Jun', opening: 2895, opCF: 85, capex: -35, funding: 0, closing: 2945 },
  { month: 'Jul', opening: 2945, opCF: 92, capex: -30, funding: 0, closing: 3007 },
  { month: 'Aug', opening: 3007, opCF: 98, capex: -25, funding: 0, closing: 3080 },
  { month: 'Sep', opening: 3080, opCF: 90, capex: -35, funding: 500, closing: 3635 },
  { month: 'Oct', opening: 3635, opCF: 102, capex: -30, funding: 0, closing: 3707 },
  { month: 'Nov', opening: 3707, opCF: 110, capex: -25, funding: 0, closing: 3792 },
  { month: 'Dec', opening: 3792, opCF: 118, capex: -30, funding: 0, closing: 3880 },
];

const fundingEvents = [
  { event: 'Seed Round', date: 'May 2024', amount: 'AED 2.5M', type: 'Equity', status: 'Completed', statusColor: 'bg-green-100 text-green-700' },
  { event: 'Working Capital Facility', date: 'Jan 2025', amount: 'AED 300K', type: 'Debt', status: 'Active', statusColor: 'bg-blue-100 text-blue-700' },
  { event: 'Equipment Financing', date: 'Mar 2025', amount: 'AED 150K', type: 'Lease', status: 'Active', statusColor: 'bg-blue-100 text-blue-700' },
  { event: 'Series A', date: 'Q3 2025 (Target)', amount: 'AED 8.0M', type: 'Equity', status: 'Pipeline', statusColor: 'bg-amber-100 text-amber-700' },
];

/* Burn Rate Trend data */
const burnRateMonthly = [185, 176, 172, 195, 180, 175, 168, 162, 170, 158, 150, 145];
const maxBurn = Math.max(...burnRateMonthly);

export default function CashFundingConsole() {
  const ctx = usePlanningContext();

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1E5B9C]" /> Cash & Funding Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — {ctx.timePeriodLabel} — {ctx.scenarioLabel}
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const rows=['opening','opCF','capex','funding','closing'].map(f=>([{opening:'Opening',opCF:'Op CF',capex:'CAPEX',funding:'Funding',closing:'Closing'}[f],...cashFlowMonthly.map(m=>(m as any)[f])])); exportCSV('CashFlow_Monthly',h,rows); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const rows=['opening','opCF','capex','funding','closing'].map(f=>([{opening:'Opening',opCF:'Op CF',capex:'CAPEX',funding:'Funding',closing:'Closing'}[f],...cashFlowMonthly.map(m=>(m as any)[f])])); exportPDF('Cash Flow Monthly',h,rows); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
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

        {/* ── Monthly Cash Flow Waterfall Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Monthly Cash Flow Waterfall (AED K)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider w-32">Line</th>
                  {cashFlowMonthly.map(m => (
                    <th key={m.month} className="px-2 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{m.month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['opening', 'opCF', 'capex', 'funding', 'closing'].map((field, ri) => {
                  const labels: Record<string, string> = { opening: 'Opening Balance', opCF: 'Operating CF', capex: 'CAPEX', funding: 'Funding Events', closing: 'Closing Balance' };
                  const isBold = field === 'closing';
                  return (
                    <tr key={field} className={`${ri % 2 === 1 ? 'bg-[#F4F5F7]' : ''} ${isBold ? 'border-t-2 border-[#1B2A4A]' : 'border-b border-gray-50'}`}>
                      <td className={`px-4 py-2 ${isBold ? 'font-bold text-[#1B2A4A]' : 'font-semibold text-gray-700'}`}>{labels[field]}</td>
                      {cashFlowMonthly.map(m => {
                        const val = (m as any)[field];
                        return (
                          <td key={`${m.month}-${field}`} className={`px-2 py-2 text-right font-mono ${val < 0 ? 'text-[#C0392B]' : val === 0 ? 'text-gray-300' : isBold ? 'font-bold text-[#1B2A4A]' : 'text-gray-700'}`}>
                            {val === 0 ? '—' : val.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Funding Events Timeline ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Funding Events Timeline</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    {['Event', 'Date', 'Amount', 'Type', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fundingEvents.map((f, i) => (
                    <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                      <td className="px-4 py-2.5 font-bold text-gray-800">{f.event}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{f.date}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{f.amount}</td>
                      <td className="px-4 py-2.5 text-gray-600">{f.type}</td>
                      <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.statusColor}`}>{f.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Burn Rate Trend (12-month bar chart) ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Burn Rate Trend (AED K/month)</h3>
            <div className="flex items-end justify-between gap-2 h-36">
              {burnRateMonthly.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[8px] font-bold text-gray-500 mb-1">{v}</span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${(v / maxBurn) * 100}%`,
                      minHeight: '4px',
                      backgroundColor: v > 180 ? '#C0392B' : v > 160 ? '#C47A1E' : '#1A7A4A',
                    }}
                  />
                  <span className="text-[7px] text-gray-400 mt-1 font-medium">
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3 flex items-center justify-center gap-2">
              <TrendingDown className="w-3 h-3 text-[#1A7A4A]" />
              Burn trending down — Target: AED 140K/mo by Dec
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
