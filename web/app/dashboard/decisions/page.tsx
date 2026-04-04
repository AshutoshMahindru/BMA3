"use client";

import { useEffect, useState } from 'react';
import { BookOpen, Calendar, User } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getGovernanceDecisionMemory, getGovernanceDecisionMemoryById } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { asArray, asRecord, formatDate, governanceTone, titleCase, toText } from '@/lib/phase5-utils';

interface DecisionSummary {
  decisionRecordId: string;
  title: string;
  family: string;
  owner: string;
  decisionDate: string;
  linkedVersionId: string;
  outcome: string;
}

interface DecisionDetail extends DecisionSummary {
  rationale: string;
  lessons: string;
}

function normalizeDecisionList(raw: unknown): DecisionSummary[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      decisionRecordId: toText(row.decisionRecordId, ''),
      title: toText(row.title, 'Untitled decision'),
      family: toText(row.family, 'general'),
      owner: toText(row.owner, 'system'),
      decisionDate: toText(row.decisionDate, ''),
      linkedVersionId: toText(row.linkedVersionId, ''),
      outcome: toText(row.outcome, 'Pending outcome capture'),
    };
  }).filter((item) => item.decisionRecordId);
}

function normalizeDecisionDetail(summary: DecisionSummary, raw: unknown): DecisionDetail {
  const row = asRecord(raw);
  return {
    ...summary,
    rationale: toText(row.rationale, 'Rationale not captured yet.'),
    lessons: toText(row.lessons, 'No lessons recorded yet.'),
  };
}

export default function DecisionMemory() {
  const ctx = usePlanningContext();
  const [decisions, setDecisions] = useState<DecisionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setDecisions([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getGovernanceDecisionMemory({ companyId: ctx.companyId, limit: 8 })
      .then(async (result) => {
        if (cancelled) return;

        const summaries = normalizeDecisionList(result.data);
        const details = await Promise.all(
          summaries.map(async (summary) => {
            try {
              const detail = await getGovernanceDecisionMemoryById(summary.decisionRecordId);
              return normalizeDecisionDetail(summary, detail.data);
            } catch {
              return normalizeDecisionDetail(summary, {});
            }
          }),
        );

        if (cancelled) return;
        setDecisions(details);
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load decision memory');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#1E5B9C]" />
          Decision Memory Browser
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — institutional memory and rationale capture
          <DataFreshness source={loading ? 'loading' : decisions.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>
      <div className="px-6 pb-8 space-y-4">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load decision memory.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Decision memory could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && decisions.length > 0 && (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
            {decisions.map((decision) => (
              <div key={decision.decisionRecordId} className="relative pl-12 pb-5">
                <div className="absolute left-3.5 top-1 w-3 h-3 rounded-full bg-[#1B2A4A] border-2 border-white shadow-sm z-10" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1B2A4A]/20 transition">
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-gray-400">{decision.decisionRecordId.slice(0, 8)}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(decision.decisionDate)}
                        </span>
                        <span className="text-[10px] font-bold text-[#1E5B9C] bg-blue-50 px-1.5 py-0.5 rounded">
                          {titleCase(decision.family)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">{decision.title}</h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${governanceTone(decision.outcome)}`}>
                      {titleCase(decision.outcome)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{decision.rationale}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
                    <span className="text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {decision.owner}
                    </span>
                    <span className="text-gray-400">Linked version: {decision.linkedVersionId || '—'}</span>
                    <span className="text-gray-400">Lessons: {decision.lessons}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
