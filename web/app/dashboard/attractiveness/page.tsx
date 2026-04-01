"use client";

/* S17: MARKET ATTRACTIVENESS SCORING — Weighted Scoring Matrix */

import { Target, Star } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const dimensions = ['Market Size', 'Growth Rate', 'Competition', 'Infra Readiness', 'Demand Density', 'Platform Coverage', 'Regulatory Ease'];
const weights = [20, 15, 15, 10, 15, 15, 10];
const marketsData = [
  { name: 'JLT North', scores: [9, 8, 7, 9, 9, 9, 8], total: 0 },
  { name: 'Marina', scores: [8, 7, 7, 8, 8, 9, 8], total: 0 },
  { name: 'Downtown', scores: [9, 9, 5, 7, 8, 8, 7], total: 0 },
  { name: 'JBR', scores: [7, 7, 6, 8, 7, 8, 8], total: 0 },
  { name: 'Business Bay', scores: [7, 8, 5, 7, 7, 7, 7], total: 0 },
  { name: 'Al Reem (AD)', scores: [6, 7, 4, 6, 6, 6, 6], total: 0 },
  { name: 'Al Nahda (SHJ)', scores: [5, 5, 3, 5, 5, 5, 7], total: 0 },
  { name: 'Al Ain', scores: [4, 4, 3, 4, 4, 4, 6], total: 0 },
];
marketsData.forEach(m => { m.total = m.scores.reduce((s, v, i) => s + v * weights[i], 0) / 100; });
marketsData.sort((a, b) => b.total - a.total);

const scoreColor = (v: number) => v >= 8 ? 'bg-[#1A7A4A] text-white' : v >= 6 ? 'bg-[#C47A1E]/20 text-[#C47A1E]' : v >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

export default function MarketAttractiveness() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Target className="w-5 h-5 text-[#1E5B9C]" /> Market Attractiveness Scoring
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Weighted scoring matrix — 7 dimensions × 8 markets</p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Weighted Scoring Matrix (1-10 scale)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[140px] border-r border-white/10">Market</th>
                  {dimensions.map((d, i) => (
                    <th key={d} className="px-3 py-3 text-center text-[9px] font-bold uppercase tracking-wider border-r border-white/10">
                      <div>{d}</div>
                      <div className="text-[8px] text-blue-200 font-medium mt-0.5">w={weights[i]}%</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider bg-white/10">Weighted Score</th>
                </tr>
              </thead>
              <tbody>
                {marketsData.map((m, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-bold text-gray-800 border-r border-gray-100 flex items-center gap-1.5">
                      {i < 3 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      {m.name}
                    </td>
                    {m.scores.map((s, j) => (
                      <td key={j} className="px-1 py-1.5 text-center">
                        <span className={`inline-block w-8 py-1 rounded font-bold text-[11px] ${scoreColor(s)}`}>{s}</span>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${m.total >= 7.5 ? 'bg-[#1A7A4A] text-white' : m.total >= 6 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.total.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 3 Decomposition */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {marketsData.slice(0, 3).map((m, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <h4 className="text-sm font-bold text-gray-800">#{i + 1} {m.name}</h4>
                <span className="text-xs font-bold text-[#1A7A4A] bg-green-50 px-2 py-0.5 rounded ml-auto">{m.total.toFixed(1)}</span>
              </div>
              <div className="space-y-1.5">
                {dimensions.map((d, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-24 truncate">{d}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#1E5B9C]" style={{ width: `${m.scores[j] * 10}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 w-5 text-right">{m.scores[j]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
