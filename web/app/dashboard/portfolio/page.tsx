"use client";

/* S18: PORTFOLIO OPTIMIZATION — Market Go/No-Go Matrix */

import { Briefcase, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const portfolioMarkets = [
  { market: 'JLT North', attractiveness: 8.5, ebitda: 'AED 14.5/order', payback: '14 mo', capex: 'AED 350K', risk: 'Low', decision: 'GO', confidence: 92 },
  { market: 'Marina', attractiveness: 7.8, ebitda: 'AED 12.8/order', payback: '16 mo', capex: 'AED 340K', risk: 'Low', decision: 'GO', confidence: 88 },
  { market: 'Downtown', attractiveness: 7.6, ebitda: 'AED 11.2/order (F)', payback: '20 mo', capex: 'AED 380K', risk: 'Medium', decision: 'GO', confidence: 72 },
  { market: 'JBR', attractiveness: 7.1, ebitda: 'AED 9.8/order (F)', payback: '22 mo', capex: 'AED 320K', risk: 'Medium', decision: 'CONDITIONAL', confidence: 65 },
  { market: 'Business Bay', attractiveness: 6.8, ebitda: 'AED 8.5/order (F)', payback: '24 mo', capex: 'AED 360K', risk: 'Medium', decision: 'CONDITIONAL', confidence: 58 },
  { market: 'Al Reem Island', attractiveness: 5.8, ebitda: 'AED 7.2/order (F)', payback: '28 mo', capex: 'AED 310K', risk: 'High', decision: 'HOLD', confidence: 45 },
  { market: 'Al Nahda', attractiveness: 4.6, ebitda: 'TBD', payback: 'TBD', capex: 'AED 280K (est)', risk: 'High', decision: 'NO-GO', confidence: 30 },
  { market: 'Al Ain', attractiveness: 3.8, ebitda: 'TBD', payback: 'TBD', capex: 'AED 250K (est)', risk: 'Very High', decision: 'NO-GO', confidence: 22 },
];

const decisionIcon = (d: string) => {
  if (d === 'GO') return <CheckCircle2 className="w-4 h-4 text-[#1A7A4A]" />;
  if (d === 'CONDITIONAL') return <MinusCircle className="w-4 h-4 text-[#C47A1E]" />;
  if (d === 'HOLD') return <MinusCircle className="w-4 h-4 text-gray-400" />;
  return <XCircle className="w-4 h-4 text-[#C0392B]" />;
};
const decisionColor = (d: string) => {
  if (d === 'GO') return 'bg-green-100 text-green-700 border-green-200';
  if (d === 'CONDITIONAL') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (d === 'HOLD') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

export default function PortfolioOptimization() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#1E5B9C]" /> Portfolio Optimization
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Go/No-Go Decision Matrix — {ctx.scenarioLabel}</p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'GO', count: 3, color: 'border-l-[#1A7A4A] bg-green-50' },
            { label: 'CONDITIONAL', count: 2, color: 'border-l-[#C47A1E] bg-amber-50' },
            { label: 'HOLD', count: 1, color: 'border-l-gray-400 bg-gray-50' },
            { label: 'NO-GO', count: 2, color: 'border-l-[#C0392B] bg-red-50' },
          ].map(s => (
            <div key={s.label} className={`border-l-4 ${s.color} rounded-lg p-3 border border-gray-200`}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{s.count}</p>
            </div>
          ))}
        </div>

        {/* Decision Matrix Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Market Portfolio — Go/No-Go Decision Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  {['Market', 'Attractiveness', 'EBITDA/Order', 'Payback', 'CAPEX Required', 'Risk Level', 'Decision', 'Confidence'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {portfolioMarkets.map((m, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-3 font-bold text-gray-800">{m.market}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${m.attractiveness >= 7 ? 'bg-[#1A7A4A] text-white' : m.attractiveness >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {m.attractiveness.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-700">{m.ebitda}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{m.payback}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{m.capex}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m.risk === 'Low' ? 'bg-green-100 text-green-700' : m.risk === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {m.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border ${decisionColor(m.decision)}`}>
                        {decisionIcon(m.decision)} {m.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.confidence >= 70 ? 'bg-[#1A7A4A]' : m.confidence >= 50 ? 'bg-[#C47A1E]' : 'bg-[#C0392B]'}`}
                            style={{ width: `${m.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{m.confidence}%</span>
                      </div>
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
