"use client";

/* ══════════════════════════════════════════════════════════════════════════
   S10: CONFIDENCE TRACKER — Heatmap Grid + Evidence Log
   Wireframe v4.0: Heatmap (Modules × Markets: 7×8), Evidence Log table
   ══════════════════════════════════════════════════════════════════════ */

import { Shield, Filter, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

/* ── Heatmap Data: Modules × Markets ─────────────────────────────────── */
const modules = ['Demand', 'Pricing', 'Cost', 'Labor', 'Marketing', 'CAPEX', 'Funding'];
const markets = ['JLT North', 'Marina', 'Downtown', 'JBR', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Portfolio'];

// Confidence scores (0-100) per module × market
const heatmapData: Record<string, Record<string, number>> = {
  'Demand':    { 'JLT North': 88, 'Marina': 82, 'Downtown': 65, 'JBR': 72, 'Abu Dhabi': 55, 'Sharjah': 48, 'Al Ain': 42, 'Portfolio': 76 },
  'Pricing':   { 'JLT North': 90, 'Marina': 85, 'Downtown': 78, 'JBR': 80, 'Abu Dhabi': 68, 'Sharjah': 62, 'Al Ain': 58, 'Portfolio': 80 },
  'Cost':      { 'JLT North': 92, 'Marina': 88, 'Downtown': 82, 'JBR': 85, 'Abu Dhabi': 75, 'Sharjah': 70, 'Al Ain': 65, 'Portfolio': 82 },
  'Labor':     { 'JLT North': 85, 'Marina': 80, 'Downtown': 72, 'JBR': 75, 'Abu Dhabi': 60, 'Sharjah': 55, 'Al Ain': 50, 'Portfolio': 72 },
  'Marketing': { 'JLT North': 78, 'Marina': 75, 'Downtown': 62, 'JBR': 68, 'Abu Dhabi': 52, 'Sharjah': 45, 'Al Ain': 40, 'Portfolio': 65 },
  'CAPEX':     { 'JLT North': 95, 'Marina': 90, 'Downtown': 70, 'JBR': 82, 'Abu Dhabi': 62, 'Sharjah': 58, 'Al Ain': 55, 'Portfolio': 78 },
  'Funding':   { 'JLT North': 80, 'Marina': 78, 'Downtown': 65, 'JBR': 70, 'Abu Dhabi': 55, 'Sharjah': 50, 'Al Ain': 45, 'Portfolio': 68 },
};

/* ── Evidence Log & Review Schedule ─────────────────────────────────── */
const evidenceLog = [
  { module: 'Demand', market: 'Downtown', confidence: 65, evidence: 'Competitor density analysis incomplete', reviewer: 'Strategy', reviewDate: '15 Apr 2026', status: 'Under Review', priority: 'High' },
  { module: 'Marketing', market: 'Al Ain', confidence: 40, evidence: 'No historical data — new market', reviewer: 'Marketing', reviewDate: '20 Apr 2026', status: 'Flagged', priority: 'Critical' },
  { module: 'Marketing', market: 'Sharjah', confidence: 45, evidence: 'Limited campaign data — 2 months only', reviewer: 'Marketing', reviewDate: '22 Apr 2026', status: 'Under Review', priority: 'High' },
  { module: 'Labor', market: 'Abu Dhabi', confidence: 60, evidence: 'Pending labor market survey results', reviewer: 'HR', reviewDate: '25 Apr 2026', status: 'Pending', priority: 'Medium' },
  { module: 'Demand', market: 'Abu Dhabi', confidence: 55, evidence: 'Soft launch data — 6 weeks only', reviewer: 'Commercial', reviewDate: '28 Apr 2026', status: 'Under Review', priority: 'High' },
  { module: 'Funding', market: 'Al Ain', confidence: 45, evidence: 'No investor interest confirmed', reviewer: 'CFO', reviewDate: '30 Apr 2026', status: 'Flagged', priority: 'Critical' },
  { module: 'CAPEX', market: 'Downtown', confidence: 70, evidence: 'Landlord fit-out quote pending revision', reviewer: 'Projects', reviewDate: '01 May 2026', status: 'Pending', priority: 'Medium' },
  { module: 'Demand', market: 'Al Ain', confidence: 42, evidence: 'Market size estimate from secondary research only', reviewer: 'Strategy', reviewDate: '05 May 2026', status: 'Flagged', priority: 'Critical' },
];

const getConfidenceColor = (score: number) => {
  if (score >= 85) return 'bg-[#1A7A4A] text-white';
  if (score >= 70) return 'bg-[#22c55e]/80 text-white';
  if (score >= 55) return 'bg-[#C47A1E] text-white';
  if (score >= 40) return 'bg-[#ea580c] text-white';
  return 'bg-[#C0392B] text-white';
};

const getConfidenceBg = (score: number) => {
  if (score >= 85) return '#1A7A4A';
  if (score >= 70) return '#22c55e';
  if (score >= 55) return '#C47A1E';
  if (score >= 40) return '#ea580c';
  return '#C0392B';
};

export default function ConfidenceTracker() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1E5B9C]" />
          Assumption Confidence Tracker
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {ctx.scopeLabel} — {ctx.scenarioLabel} — Confidence Assessment Matrix
        </p>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* Filter Strip */}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center gap-4 flex-wrap shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold uppercase tracking-wider text-[10px]">Filters:</span>
          </div>
          <select className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 font-medium text-gray-700">
            <option>All Modules</option>
            {modules.map(m => <option key={m}>{m}</option>)}
          </select>
          <select className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 font-medium text-gray-700">
            <option>All Confidence</option>
            <option>Critical (&lt;50%)</option>
            <option>Low (50-69%)</option>
            <option>Medium (70-84%)</option>
            <option>High (85%+)</option>
          </select>
          <select className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 font-medium text-gray-700">
            <option>All Statuses</option>
            <option>Flagged</option>
            <option>Under Review</option>
            <option>Pending</option>
            <option>Confirmed</option>
          </select>
        </div>

        {/* ═══════ CONFIDENCE HEATMAP ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Confidence Heatmap — Modules × Markets
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C0392B]" /> &lt;40%</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ea580c]" /> 40-54%</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C47A1E]" /> 55-69%</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#22c55e]" /> 70-84%</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1A7A4A]" /> 85%+</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[120px]">Module</th>
                  {markets.map(m => (
                    <th key={m} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod, mIdx) => (
                  <tr key={mod} className={mIdx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-4 py-2 text-xs font-bold text-gray-700 border-r border-gray-100">{mod}</td>
                    {markets.map(market => {
                      const score = heatmapData[mod][market];
                      return (
                        <td key={market} className="px-1 py-1 text-center">
                          <div className={`mx-auto w-full max-w-[60px] py-2 rounded text-[11px] font-bold ${getConfidenceColor(score)}`}
                            style={{ backgroundColor: getConfidenceBg(score) + '22', color: getConfidenceBg(score), borderLeft: `3px solid ${getConfidenceBg(score)}` }}
                          >
                            {score}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ EVIDENCE LOG & REVIEW SCHEDULE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1E5B9C]" />
              Evidence Log & Review Schedule
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Module', 'Market', 'Confidence', 'Evidence / Gap', 'Reviewer', 'Review Date', 'Status', 'Priority'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evidenceLog.map((entry, idx) => (
                  <tr key={idx} className={`hover:bg-blue-50/30 transition ${idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{entry.module}</td>
                    <td className="px-4 py-2.5 text-gray-600">{entry.market}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                        entry.confidence >= 70 ? 'bg-green-100 text-green-700'
                        : entry.confidence >= 50 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {entry.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[280px]">{entry.evidence}</td>
                    <td className="px-4 py-2.5 text-gray-600">{entry.reviewer}</td>
                    <td className="px-4 py-2.5 text-gray-500">{entry.reviewDate}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        entry.status === 'Flagged' ? 'bg-red-100 text-red-700' :
                        entry.status === 'Under Review' ? 'bg-amber-100 text-amber-700' :
                        entry.status === 'Pending' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {entry.status === 'Flagged' ? <AlertTriangle className="w-3 h-3" /> :
                         entry.status === 'Under Review' ? <Clock className="w-3 h-3" /> :
                         <CheckCircle2 className="w-3 h-3" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        entry.priority === 'Critical' ? 'bg-red-600 text-white' :
                        entry.priority === 'High' ? 'bg-amber-500 text-white' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {entry.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confidence Distribution Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'High Confidence (85%+)', count: Object.values(heatmapData).reduce((acc, row) => acc + Object.values(row).filter(v => v >= 85).length, 0), color: 'border-l-4 border-l-[#1A7A4A]', bg: 'bg-green-50' },
            { label: 'Medium (70-84%)', count: Object.values(heatmapData).reduce((acc, row) => acc + Object.values(row).filter(v => v >= 70 && v < 85).length, 0), color: 'border-l-4 border-l-[#22c55e]', bg: 'bg-emerald-50' },
            { label: 'Low (55-69%)', count: Object.values(heatmapData).reduce((acc, row) => acc + Object.values(row).filter(v => v >= 55 && v < 70).length, 0), color: 'border-l-4 border-l-[#C47A1E]', bg: 'bg-amber-50' },
            { label: 'Critical (<55%)', count: Object.values(heatmapData).reduce((acc, row) => acc + Object.values(row).filter(v => v < 55).length, 0), color: 'border-l-4 border-l-[#C0392B]', bg: 'bg-red-50' },
          ].map(band => (
            <div key={band.label} className={`${band.bg} ${band.color} rounded-lg p-4 border border-gray-200`}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{band.label}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{band.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">assumptions</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
