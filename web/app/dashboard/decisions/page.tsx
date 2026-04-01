"use client";

/* S22: DECISION MEMORY BROWSER — Decision Log Timeline */

import { BookOpen, CheckCircle2, ArrowRight, Calendar } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const decisions = [
  { id: 'D-2025-014', date: '28 Mar 2026', title: 'Downtown Kitchen — GO Decision', category: 'Expansion', decidedBy: 'Board', rationale: 'Attractiveness score 7.6, payback 20 mo, capacity gap identified in Downtown corridor. All Go criteria met except staffing pipeline (waived with mitigation plan).', outcome: 'Approved', impactedScreens: ['S16', 'S18', 'S14'], linkedAssumptions: ['AS-2025-03 / Demand Tab'], confidence: 72 },
  { id: 'D-2025-013', date: '22 Mar 2026', title: 'Series A Timeline Acceleration', category: 'Funding', decidedBy: 'CFO + Board', rationale: 'Cash runway at 14.5 months. Pre-empt Q4 fundraising window. Target: AED 8M at AED 12M pre-money. TechStars network activated.', outcome: 'Approved', impactedScreens: ['S04', 'S05'], linkedAssumptions: ['AS-2025-03 / Funding Tab'], confidence: 60 },
  { id: 'D-2025-012', date: '15 Mar 2026', title: 'Talabat Commission Renegotiation', category: 'Commercial', decidedBy: 'Commercial Team', rationale: 'Successful negotiation from 30% to 28% commission. Volume commitment: 4,500 orders/month minimum. 6-month lock-in.', outcome: 'Completed', impactedScreens: ['S11', 'S14'], linkedAssumptions: ['AS-2025-03 / Pricing Tab'], confidence: 85 },
  { id: 'D-2025-011', date: '08 Mar 2026', title: 'Staff Retention Bonus Program', category: 'HR', decidedBy: 'HR + CFO', rationale: 'Turnover rate at 35% (down from 40% but still above 25% target). 3-month retention bonus: AED 1,500/chef. Budget impact: AED 27K/quarter across 2 kitchens.', outcome: 'Approved', impactedScreens: ['S19', 'S15'], linkedAssumptions: ['AS-2025-03 / Labor Tab'], confidence: 65 },
  { id: 'D-2025-010', date: '01 Mar 2026', title: 'JBR Kitchen — CONDITIONAL GO', category: 'Expansion', decidedBy: 'Board', rationale: 'Attractiveness 7.1, requires: (1) Downtown kitchen achieving 70%+ utilization by Q2, (2) staffing pipeline ≥ 8 candidates. Review gate: 30 Jun 2026.', outcome: 'Conditional', impactedScreens: ['S16', 'S18', 'S21'], linkedAssumptions: ['AS-2025-03 / Demand Tab'], confidence: 55 },
  { id: 'D-2025-009', date: '22 Feb 2026', title: 'Marketing CAC Target Reduction', category: 'Marketing', decidedBy: 'Marketing + CFO', rationale: 'Current CAC AED 42 → Target AED 35. Strategy: shift 15% budget from paid acquisition to CRM reactivation. 6-month test period.', outcome: 'In Progress', impactedScreens: ['S11', 'S15'], linkedAssumptions: ['AS-2025-03 / Marketing Tab'], confidence: 72 },
  { id: 'D-2025-008', date: '15 Feb 2026', title: 'Al Nahda + Al Ain — NO-GO', category: 'Expansion', decidedBy: 'Board', rationale: 'Attractiveness scores below 5.0 threshold. Market size insufficient for cloud kitchen unit economics. Revisit in 12 months if UAE F&B market grows >15%.', outcome: 'Rejected', impactedScreens: ['S17', 'S18'], linkedAssumptions: ['N/A'], confidence: 85 },
  { id: 'D-2025-007', date: '08 Feb 2026', title: 'Own-Channel Revenue Strategy', category: 'Digital', decidedBy: 'CEO + CTO', rationale: 'Target 12% revenue from own app/website by Dec 2025 (up from 8%). Commission savings: AED 120K/year. Budget: AED 80K for app enhancement.', outcome: 'In Progress', impactedScreens: ['S11', 'S14'], linkedAssumptions: ['AS-2025-03 / Pricing Tab'], confidence: 60 },
];

const outcomeColor = (o: string) => {
  if (o === 'Approved' || o === 'Completed') return 'bg-green-100 text-green-700 border-green-200';
  if (o === 'Conditional') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (o === 'In Progress') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

export default function DecisionMemory() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#1E5B9C]" /> Decision Memory Browser
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Institutional knowledge with full traceability</p>
      </div>
      <div className="px-6 pb-8 space-y-4">
        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
          {decisions.map((d, i) => (
            <div key={i} className="relative pl-12 pb-5">
              <div className="absolute left-3.5 top-1 w-3 h-3 rounded-full bg-[#1B2A4A] border-2 border-white shadow-sm z-10" />
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1B2A4A]/20 transition">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold text-gray-400">{d.id}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{d.date}</span>
                      <span className="text-[10px] font-bold text-[#1E5B9C] bg-blue-50 px-1.5 py-0.5 rounded">{d.category}</span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{d.title}</h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${outcomeColor(d.outcome)}`}>
                    {d.outcome}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{d.rationale}</p>
                <div className="flex items-center gap-4 flex-wrap text-[10px]">
                  <span className="text-gray-400"><strong className="text-gray-500">Decided by:</strong> {d.decidedBy}</span>
                  <span className="text-gray-400"><strong className="text-gray-500">Screens:</strong> {d.impactedScreens.join(', ')}</span>
                  <span className="text-gray-400"><strong className="text-gray-500">Linked:</strong> {d.linkedAssumptions.join(', ')}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded ${d.confidence >= 70 ? 'bg-green-50 text-green-700' : d.confidence >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                    Conf: {d.confidence}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
