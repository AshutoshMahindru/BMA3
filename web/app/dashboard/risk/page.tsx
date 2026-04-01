"use client";

/* S19: RISK MANAGEMENT DASHBOARD — 5×5 Heatmap + Top-10 Register */

import { Shield, AlertTriangle, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { exportCSV, exportPDF } from '@/lib/export';

const impactLabels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
const probLabels = ['Remote', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];

const riskCells: Record<string, { count: number; ids: string[] }> = {
  '4-4': { count: 2, ids: ['R01','R02'] }, '4-3': { count: 1, ids: ['R03'] },
  '3-4': { count: 1, ids: ['R04'] }, '3-3': { count: 2, ids: ['R05','R06'] },
  '2-4': { count: 1, ids: ['R07'] }, '2-3': { count: 1, ids: ['R08'] },
  '1-2': { count: 1, ids: ['R09'] }, '0-1': { count: 1, ids: ['R10'] },
};

const heatColor = (p: number, i: number) => {
  const score = (p + 1) * (i + 1);
  if (score >= 16) return 'bg-red-600 text-white';
  if (score >= 10) return 'bg-orange-500 text-white';
  if (score >= 5) return 'bg-amber-400 text-gray-900';
  return 'bg-green-400 text-gray-900';
};

const riskRegister = [
  { id: 'R01', name: 'Cash runway < 6 months', category: 'Financial', probability: 'Likely', impact: 'Catastrophic', score: 20, owner: 'CFO', mitigation: 'Accelerate Series A timeline', status: 'Active' },
  { id: 'R02', name: 'Key kitchen staff turnover spike', category: 'Operational', probability: 'Likely', impact: 'Major', score: 16, owner: 'HR', mitigation: 'Retention bonus program', status: 'Active' },
  { id: 'R03', name: 'Platform commission increase', category: 'Commercial', probability: 'Likely', impact: 'Moderate', score: 12, owner: 'Partnerships', mitigation: 'Diversify to own-channel', status: 'Monitoring' },
  { id: 'R04', name: 'Food inflation > 10%', category: 'Cost', probability: 'Possible', impact: 'Major', score: 12, owner: 'Procurement', mitigation: 'Supplier hedging contracts', status: 'Active' },
  { id: 'R05', name: 'Downtown launch delay > 4 weeks', category: 'Execution', probability: 'Possible', impact: 'Moderate', score: 9, owner: 'Projects', mitigation: 'Parallel workstream acceleration', status: 'Monitoring' },
  { id: 'R06', name: 'Competitor price war', category: 'Market', probability: 'Possible', impact: 'Moderate', score: 9, owner: 'Strategy', mitigation: 'Value proposition differentiation', status: 'Watching' },
  { id: 'R07', name: 'Regulatory license delay', category: 'Compliance', probability: 'Unlikely', impact: 'Major', score: 8, owner: 'Legal', mitigation: 'Pre-file applications', status: 'Monitoring' },
  { id: 'R08', name: 'Technology platform outage', category: 'Technology', probability: 'Unlikely', impact: 'Moderate', score: 6, owner: 'CTO', mitigation: 'DR/BCP procedures', status: 'Watching' },
  { id: 'R09', name: 'Customer data breach', category: 'Cybersecurity', probability: 'Remote', impact: 'Catastrophic', score: 5, owner: 'CTO', mitigation: 'SOC2 certification in progress', status: 'Watching' },
  { id: 'R10', name: 'VAT policy change', category: 'Regulatory', probability: 'Remote', impact: 'Minor', score: 2, owner: 'Finance', mitigation: 'Monitor UAE tax framework', status: 'Watching' },
];

export default function RiskDashboard() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1E5B9C]" /> Risk Management Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Enterprise Risk Assessment — {ctx.scenarioLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['ID','Risk','Category','Probability','Impact','Score','Owner','Mitigation','Status']; const r=riskRegister.map(k=>[k.id,k.name,k.category,k.probability,k.impact,k.score,k.owner,k.mitigation,k.status]); exportCSV('Risk_Register',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['ID','Risk','Category','Probability','Impact','Score','Owner','Mitigation','Status']; const r=riskRegister.map(k=>[k.id,k.name,k.category,k.probability,k.impact,k.score,k.owner,k.mitigation,k.status]); exportPDF('Risk Register',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>
      <div className="px-6 pb-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 5×5 Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#1E5B9C]" /> 5×5 Risk Heatmap
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-24 text-[9px] font-bold text-gray-400 uppercase pb-2">Prob / Impact →</th>
                    {impactLabels.map(l => <th key={l} className="text-center text-[8px] font-bold text-gray-400 uppercase pb-2 px-1">{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...probLabels].reverse().map((prob, pIdx) => {
                    const actualP = 4 - pIdx;
                    return (
                      <tr key={prob}>
                        <td className="text-[9px] font-bold text-gray-500 pr-2 py-1 text-right">{prob}</td>
                        {impactLabels.map((_, iIdx) => {
                          const key = `${actualP}-${iIdx}`;
                          const cell = riskCells[key];
                          return (
                            <td key={iIdx} className="p-0.5">
                              <div className={`w-full h-12 rounded flex items-center justify-center text-[10px] font-bold ${heatColor(actualP, iIdx)}`}>
                                {cell ? <span>{cell.count} risk{cell.count > 1 ? 's' : ''}</span> : ''}
                              </div>
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

          {/* Summary Cards */}
          <div className="space-y-4">
            {[
              { label: 'Critical Risks (Score ≥16)', count: 2, color: 'border-l-red-600 bg-red-50' },
              { label: 'High Risks (Score 10-15)', count: 2, color: 'border-l-orange-500 bg-orange-50' },
              { label: 'Medium Risks (Score 5-9)', count: 4, color: 'border-l-amber-400 bg-amber-50' },
              { label: 'Low Risks (Score <5)', count: 2, color: 'border-l-green-500 bg-green-50' },
            ].map(b => (
              <div key={b.label} className={`border-l-4 ${b.color} rounded-lg p-4 border border-gray-200`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">{b.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900">{b.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Register */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Top-10 Risk Register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['ID', 'Risk Description', 'Category', 'Probability', 'Impact', 'Score', 'Owner', 'Mitigation', 'Status'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riskRegister.map((r, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-3 py-2.5 font-mono font-bold text-gray-500">{r.id}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 max-w-[200px]">{r.name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.category}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.probability}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.impact}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.score >= 16 ? 'bg-red-600 text-white' : r.score >= 10 ? 'bg-orange-500 text-white' : r.score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{r.score}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{r.owner}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[180px]">{r.mitigation}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Active' ? 'bg-red-100 text-red-700' : r.status === 'Monitoring' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
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
