"use client";

/* S21: TRIGGER & ALERT DASHBOARD — Active Triggers + Expansion Readiness */

import { Bell, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const triggers = [
  { id: 'T01', name: 'Cash Runway < 6 Months', type: 'Financial', condition: 'Cash Balance ÷ Monthly Burn < 6', currentValue: '14.5 mo', threshold: '< 6 mo', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T02', name: 'EBITDA Margin < 25%', type: 'Financial', condition: 'Monthly EBITDA ÷ Revenue < 25%', currentValue: '41.4%', threshold: '< 25%', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T03', name: 'Kitchen Launch > 4 Weeks Late', type: 'Execution', condition: 'Actual Launch Date − Planned > 28d', currentValue: '+8 days', threshold: '> 28 days', status: 'Warning', statusColor: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'T04', name: 'Customer Retention < 60%', type: 'Commercial', condition: '30-Day Retention Rate < 60%', currentValue: '68%', threshold: '< 60%', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T05', name: 'CAC > AED 50', type: 'Marketing', condition: 'Cost per Acquisition > AED 50', currentValue: 'AED 35', threshold: '> AED 50', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T06', name: 'COGS Inflation > 8%', type: 'Cost', condition: 'YoY Food Cost Increase > 8%', currentValue: '4.1%', threshold: '> 8%', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T07', name: 'Staff Turnover > 50%', type: 'HR', condition: 'Annual Turnover Rate > 50%', currentValue: '35%', threshold: '> 50%', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'T08', name: 'Order Volume Drop > 15%', type: 'Demand', condition: 'WoW Order Decline > 15%', currentValue: '-2.3%', threshold: '> 15% drop', status: 'Safe', statusColor: 'bg-green-100 text-green-700 border-green-200' },
];

const expansionChecklist = [
  { criteria: 'Existing kitchens profitable (EBITDA+)', met: true, detail: '2/2 kitchens positive' },
  { criteria: 'Cash runway > 9 months post-launch', met: true, detail: '14.5 months current' },
  { criteria: 'Kitchen utilization > 70%', met: true, detail: 'JLT: 78%, Marina: 72%' },
  { criteria: 'Payback < 18 months proven', met: true, detail: 'JLT: 14 mo, Marina: 16 mo' },
  { criteria: 'Supply chain ready for new location', met: false, detail: 'Downtown vendor contracts pending' },
  { criteria: 'Staffing pipeline > 8 qualified candidates', met: false, detail: '5 candidates in pipeline' },
  { criteria: 'Platform partnerships confirmed', met: true, detail: 'Talabat & Deliveroo active' },
  { criteria: 'Regulatory approvals filed', met: true, detail: 'DM license filed 15 Mar' },
];

export default function TriggerDashboard() {
  const passCount = expansionChecklist.filter(c => c.met).length;
  const totalCount = expansionChecklist.length;
  const readinessScore = Math.round((passCount / totalCount) * 100);

  const ctx = usePlanningContext();

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1E5B9C]" /> Trigger & Alert Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Automated monitoring triggers and expansion readiness</p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {/* Active Triggers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Active Monitoring Triggers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['ID', 'Trigger Name', 'Type', 'Condition', 'Current Value', 'Threshold', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {triggers.map((t, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-500">{t.id}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{t.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{t.type}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600 text-[10px]">{t.condition}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[#1B2A4A]">{t.currentValue}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{t.threshold}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${t.statusColor}`}>
                        {t.status === 'Safe' ? '✓ ' : '⚠ '}{t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expansion Readiness */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Expansion Readiness Checklist — Next Kitchen</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {expansionChecklist.map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition">
                  {c.met
                    ? <CheckCircle2 className="w-5 h-5 text-[#1A7A4A] shrink-0" />
                    : <XCircle className="w-5 h-5 text-[#C0392B] shrink-0" />
                  }
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-800">{c.criteria}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{c.detail}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.met ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Expansion Readiness Score</p>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={readinessScore >= 80 ? '#1A7A4A' : readinessScore >= 60 ? '#C47A1E' : '#C0392B'} strokeWidth="8"
                  strokeDasharray={`${(readinessScore / 100) * 264} 264`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-extrabold ${readinessScore >= 80 ? 'text-[#1A7A4A]' : 'text-[#C47A1E]'}`}>{readinessScore}%</span>
                <span className="text-[9px] text-gray-400 font-bold uppercase">{passCount}/{totalCount} criteria</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">{readinessScore >= 80 ? '✓ Ready to proceed' : '⚠ Blockers remain'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
