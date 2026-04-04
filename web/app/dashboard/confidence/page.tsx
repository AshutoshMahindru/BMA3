"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Clock, Microscope, Shield, Sparkles } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getConfidenceDqi,
  getConfidenceEvidence,
  getConfidenceResearchTasks,
  getConfidenceRollups,
  getConfidenceSummary,
} from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import {
  asArray,
  asRecord,
  confidenceTone,
  formatDate,
  titleCase,
  toNumber,
  toText,
} from '@/lib/phase5-utils';

interface ConfidenceSummaryState {
  overallConfidence: string;
  evidenceCount: number;
  lowConfidenceItems: Array<{
    assessmentId: string;
    entityType: string;
    entityId: string;
    confidenceLevel: string;
    evidenceCount: number;
    updatedAt: string;
  }>;
  byStage: Array<{
    stage: string;
    confidenceLevel: string;
    averageScore: number;
    count: number;
  }>;
}

interface EvidenceItem {
  evidenceId: string;
  title: string;
  type: string;
  quality: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

interface ResearchTask {
  taskId: string;
  title: string;
  assignee: string;
  dueDate: string;
  status: string;
  entityType: string;
  entityId: string;
}

interface DqiFactor {
  name: string;
  score: number;
}

interface ConfidenceRollup {
  entityType: string;
  entityId: string;
  aggregateConfidence: string;
  weakestLinkScore: number;
  evidenceCount: number;
}

function normalizeSummary(raw: unknown): ConfidenceSummaryState {
  const value = asRecord(raw);
  const byStageRecord = asRecord(value.byStage);

  return {
    overallConfidence: toText(value.overallConfidence, 'unknown'),
    evidenceCount: toNumber(value.evidenceCount),
    lowConfidenceItems: asArray(value.lowConfidenceItems).map((item) => {
      const row = asRecord(item);
      return {
        assessmentId: toText(row.assessmentId, ''),
        entityType: toText(row.entityType, 'unknown'),
        entityId: toText(row.entityId, ''),
        confidenceLevel: toText(row.confidenceLevel, 'unknown'),
        evidenceCount: toNumber(row.evidenceCount),
        updatedAt: toText(row.updatedAt, ''),
      };
    }).filter((item) => item.assessmentId),
    byStage: Object.entries(byStageRecord).map(([stage, detail]) => {
      const row = asRecord(detail);
      return {
        stage,
        confidenceLevel: toText(row.confidenceLevel, 'unknown'),
        averageScore: toNumber(row.averageScore),
        count: toNumber(row.count),
      };
    }),
  };
}

function normalizeEvidence(raw: unknown): EvidenceItem[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    const attachedTo = asRecord(row.attachedTo);
    return {
      evidenceId: toText(row.evidenceId, ''),
      title: toText(row.title, 'Untitled evidence'),
      type: toText(row.type, 'manual'),
      quality: toText(row.quality, 'unknown'),
      entityType: toText(attachedTo.entityType, 'unknown'),
      entityId: toText(attachedTo.entityId, ''),
      createdAt: toText(row.createdAt, ''),
    };
  }).filter((item) => item.evidenceId);
}

function normalizeResearchTasks(raw: unknown): ResearchTask[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    const linkedEntity = asRecord(row.linkedEntity);
    return {
      taskId: toText(row.taskId, ''),
      title: toText(row.title, 'Untitled task'),
      assignee: toText(row.assignee, 'Unassigned'),
      dueDate: toText(row.dueDate, ''),
      status: toText(row.status, 'open'),
      entityType: toText(linkedEntity.entityType, 'unknown'),
      entityId: toText(linkedEntity.entityId, ''),
    };
  }).filter((item) => item.taskId);
}

function normalizeDqi(raw: unknown): { overallDqi: number; factors: DqiFactor[] } {
  const value = asRecord(raw);

  return {
    overallDqi: toNumber(value.overallDqi),
    factors: asArray(value.factors).map((item) => {
      const row = asRecord(item);
      return {
        name: toText(row.name, 'factor'),
        score: toNumber(row.score),
      };
    }),
  };
}

function normalizeRollups(raw: unknown): ConfidenceRollup[] {
  const value = asRecord(raw);

  return asArray(value.rollups).map((item) => {
    const row = asRecord(item);
    const weakestLink = asRecord(row.weakestLink);
    return {
      entityType: toText(row.entityType, 'unknown'),
      entityId: toText(row.entityId, ''),
      aggregateConfidence: toText(row.aggregateConfidence, 'unknown'),
      weakestLinkScore: toNumber(weakestLink.score),
      evidenceCount: toNumber(row.evidenceCount),
    };
  }).filter((item) => item.entityId);
}

export default function ConfidenceTracker() {
  const ctx = usePlanningContext();
  const [summary, setSummary] = useState<ConfidenceSummaryState | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [researchTasks, setResearchTasks] = useState<ResearchTask[]>([]);
  const [dqi, setDqi] = useState<{ overallDqi: number; factors: DqiFactor[] }>({ overallDqi: 0, factors: [] });
  const [rollups, setRollups] = useState<ConfidenceRollup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setSummary(null);
      setEvidence([]);
      setResearchTasks([]);
      setDqi({ overallDqi: 0, factors: [] });
      setRollups([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getConfidenceSummary({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
      getConfidenceEvidence({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined, limit: 8 }),
      getConfidenceResearchTasks({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined, limit: 6 }),
      getConfidenceDqi({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
      getConfidenceRollups({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
    ])
      .then(([summaryResult, evidenceResult, tasksResult, dqiResult, rollupsResult]) => {
        if (cancelled) return;

        setSummary(normalizeSummary(summaryResult.data));
        setEvidence(normalizeEvidence(evidenceResult.data));
        setResearchTasks(normalizeResearchTasks(tasksResult.data));
        setDqi(normalizeDqi(dqiResult.data));
        setRollups(normalizeRollups(rollupsResult.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load confidence tracker');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId]);

  const lowConfidenceCount = summary?.lowConfidenceItems.length || 0;
  const openTasks = researchTasks.filter((task) => task.status.toLowerCase() !== 'done').length;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1E5B9C]" />
          Assumption Confidence Tracker
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — {ctx.scenarioName}
          <DataFreshness source={loading ? 'loading' : summary ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load confidence, evidence, and DQI coverage.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Confidence data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Overall Confidence',
                  value: titleCase(summary.overallConfidence),
                  sub: `${summary.byStage.length} tracked stages`,
                  tone: confidenceTone(summary.overallConfidence),
                },
                {
                  label: 'Evidence Items',
                  value: String(summary.evidenceCount),
                  sub: 'Linked to model entities',
                  tone: 'bg-blue-50 text-blue-700 border-blue-200',
                },
                {
                  label: 'Low Confidence Items',
                  value: String(lowConfidenceCount),
                  sub: 'Require evidence or review',
                  tone: lowConfidenceCount > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                },
                {
                  label: 'Data Quality Index',
                  value: `${Math.round(dqi.overallDqi)}`,
                  sub: 'Latest DQI composite',
                  tone: confidenceTone(dqi.overallDqi),
                },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.tone}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                  <p className="text-2xl font-extrabold mt-1">{card.value}</p>
                  <p className="text-[11px] mt-1 opacity-80">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-[#1E5B9C]" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Confidence By Stage</h3>
                </div>
                <div className="space-y-3">
                  {summary.byStage.length === 0 && (
                    <p className="text-sm text-gray-400">No staged confidence summaries are available yet.</p>
                  )}
                  {summary.byStage.map((stage) => (
                    <div key={stage.stage} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{titleCase(stage.stage)}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{stage.count} tracked entities</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${confidenceTone(stage.averageScore)}`}>
                          {titleCase(stage.confidenceLevel)} · {Math.round(stage.averageScore)}
                        </span>
                      </div>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1E5B9C] rounded-full" style={{ width: `${Math.min(Math.max(stage.averageScore, 0), 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[#1E5B9C]" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">DQI Factor Breakdown</h3>
                </div>
                <div className="space-y-3">
                  {dqi.factors.length === 0 && (
                    <p className="text-sm text-gray-400">No DQI factor scores have been recorded for this planning scope.</p>
                  )}
                  {dqi.factors.map((factor) => (
                    <div key={factor.name}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-gray-700">{titleCase(factor.name)}</span>
                        <span className="font-bold text-gray-500">{Math.round(factor.score)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1A7A4A] rounded-full" style={{ width: `${Math.min(Math.max(factor.score, 0), 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#1E5B9C]" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Low Confidence Watchlist</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Entity', 'Confidence', 'Evidence', 'Last Updated', 'Entity ID'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.lowConfidenceItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                          No low-confidence items are currently open for this company.
                        </td>
                      </tr>
                    )}
                    {summary.lowConfidenceItems.map((item, index) => (
                      <tr key={item.assessmentId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{titleCase(item.entityType)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceTone(item.confidenceLevel)}`}>
                            {titleCase(item.confidenceLevel)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{item.evidenceCount}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(item.updatedAt)}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item.entityId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-[#1E5B9C]" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Evidence Log</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {evidence.length === 0 && (
                    <div className="px-5 py-8 text-sm text-gray-400">No evidence items have been linked into this planning scope yet.</div>
                  )}
                  {evidence.map((item) => (
                    <div key={item.evidenceId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {titleCase(item.entityType)} · {titleCase(item.type)} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceTone(item.quality)}`}>
                          {titleCase(item.quality)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mt-2">{item.entityId}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1E5B9C]" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Research Tasks</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {researchTasks.length === 0 && (
                    <div className="px-5 py-8 text-sm text-gray-400">No open research backlog exists for this company yet.</div>
                  )}
                  {researchTasks.map((task) => (
                    <div key={task.taskId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {task.assignee} · {task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceTone(task.status)}`}>
                          {titleCase(task.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">
                        Linked to {titleCase(task.entityType)} · {task.entityId}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500">
                  {openTasks} active tasks across this planning scope.
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Confidence Rollups</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      {['Scope', 'Aggregate Confidence', 'Weakest Link', 'Evidence Count', 'Entity ID'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rollups.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                          No confidence rollups are available yet.
                        </td>
                      </tr>
                    )}
                    {rollups.map((item, index) => (
                      <tr key={`${item.entityType}-${item.entityId}`} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{titleCase(item.entityType)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceTone(item.aggregateConfidence)}`}>
                            {titleCase(item.aggregateConfidence)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{Math.round(item.weakestLinkScore)}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{item.evidenceCount}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item.entityId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
