"use client";

import { useEffect, useMemo, useState } from 'react';
import { Activity, PlayCircle, RefreshCw, Square, Workflow } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import {
  cancelComputeRuns,
  createComputeRuns,
  getComputeDependencies,
  getComputeFreshness,
  getComputeRuns,
  getComputeRunsById,
  getComputeRunsResults,
  getComputeRunsSteps,
} from '@/lib/api-client';
import { asArray, asRecord, formatDateTime, titleCase, toNumber, toText } from '@/lib/phase5-utils';

type ComputeRun = {
  computeRunId: string;
  status: string;
  triggerType: string;
  createdAt: string;
  completedAt: string;
};

type ComputeRunDetail = {
  computeRunId: string;
  status: string;
  triggerType: string;
  stepsTotal: number;
  stepsCompleted: number;
  createdAt: string;
  completedAt: string;
};

type ComputeRunStep = {
  stepId: string;
  name: string;
  status: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

type ComputeResult = {
  outputSummary: Record<string, number>;
  warnings: string[];
};

type FreshnessState = {
  freshness: string;
  lastRunId: string;
  lastRunAt: string;
  staleSurfaces: string[];
};

type DependencyGraph = {
  nodes: Array<{ id: string; label: string; stage: string }>;
  edges: Array<{ from: string; to: string }>;
  criticalPath: string[];
};

function normalizeRuns(raw: unknown): ComputeRun[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      computeRunId: toText(row.computeRunId, ''),
      status: toText(row.status, 'draft'),
      triggerType: toText(row.triggerType, 'manual'),
      createdAt: toText(row.createdAt, ''),
      completedAt: toText(row.completedAt, ''),
    };
  }).filter((row) => row.computeRunId);
}

function normalizeRunDetail(raw: unknown): ComputeRunDetail | null {
  const row = asRecord(raw);
  const computeRunId = toText(row.computeRunId, '');
  if (!computeRunId) {
    return null;
  }

  return {
    computeRunId,
    status: toText(row.status, 'draft'),
    triggerType: toText(row.triggerType, 'manual'),
    stepsTotal: toNumber(row.stepsTotal),
    stepsCompleted: toNumber(row.stepsCompleted),
    createdAt: toText(row.createdAt, ''),
    completedAt: toText(row.completedAt, ''),
  };
}

function normalizeSteps(raw: unknown): ComputeRunStep[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      stepId: toText(row.stepId, ''),
      name: toText(row.name, 'Step'),
      status: toText(row.status, 'pending'),
      startedAt: toText(row.startedAt, ''),
      completedAt: toText(row.completedAt, ''),
      durationMs: toNumber(row.durationMs),
    };
  }).filter((row) => row.stepId);
}

function normalizeResults(raw: unknown): ComputeResult {
  const row = asRecord(raw);
  const outputSummary = Object.entries(asRecord(row.outputSummary)).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = toNumber(value);
    return acc;
  }, {});

  return {
    outputSummary,
    warnings: asArray(row.warnings).map((value) => toText(value, '')).filter(Boolean),
  };
}

function normalizeFreshness(raw: unknown): FreshnessState {
  const row = asRecord(raw);
  return {
    freshness: toText(row.freshness, 'stale'),
    lastRunId: toText(row.lastRunId, ''),
    lastRunAt: toText(row.lastRunAt, ''),
    staleSurfaces: asArray(row.staleSurfaces).map((value) => toText(value, '')).filter(Boolean),
  };
}

function normalizeDependencies(raw: unknown): DependencyGraph {
  const row = asRecord(raw);
  return {
    nodes: asArray(row.nodes).map((item) => {
      const node = asRecord(item);
      return {
        id: toText(node.id, ''),
        label: toText(node.label, 'Node'),
        stage: toText(node.stage, 'stage'),
      };
    }).filter((node) => node.id),
    edges: asArray(row.edges).map((item) => {
      const edge = asRecord(item);
      return {
        from: toText(edge.from, ''),
        to: toText(edge.to, ''),
      };
    }).filter((edge) => edge.from && edge.to),
    criticalPath: asArray(row.criticalPath).map((item) => toText(item, '')).filter(Boolean),
  };
}

function statusTone(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'fresh') return 'bg-green-100 text-green-700 border-green-200';
  if (normalized === 'queued' || normalized === 'running' || normalized === 'processing') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (normalized === 'cancelled') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'failed' || normalized === 'error') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

export default function ComputeCenterPage() {
  const ctx = usePlanningContext();
  const activeScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);
  const versionId = activeScenario?.latestVersionId || '';

  const [runs, setRuns] = useState<ComputeRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runDetail, setRunDetail] = useState<ComputeRunDetail | null>(null);
  const [steps, setSteps] = useState<ComputeRunStep[]>([]);
  const [results, setResults] = useState<ComputeResult>({ outputSummary: {}, warnings: [] });
  const [freshness, setFreshness] = useState<FreshnessState>({
    freshness: 'stale',
    lastRunId: '',
    lastRunAt: '',
    staleSurfaces: [],
  });
  const [dependencies, setDependencies] = useState<DependencyGraph>({
    nodes: [],
    edges: [],
    criticalPath: [],
  });
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function loadRunDetails(runId: string) {
    const [detailResult, stepsResult, resultsResult] = await Promise.all([
      getComputeRunsById(runId),
      getComputeRunsSteps(runId, { limit: 30 }),
      getComputeRunsResults(runId),
    ]);

    setRunDetail(normalizeRunDetail(detailResult.data));
    setSteps(normalizeSteps(stepsResult.data));
    setResults(normalizeResults(resultsResult.data));
  }

  async function loadComputeCenter() {
    if (!ctx.companyId || !ctx.scenarioId) {
      setRuns([]);
      setSelectedRunId('');
      setRunDetail(null);
      setSteps([]);
      setResults({ outputSummary: {}, warnings: [] });
      setFreshness({ freshness: 'stale', lastRunId: '', lastRunAt: '', staleSurfaces: [] });
      setDependencies({ nodes: [], edges: [], criticalPath: [] });
      setLastFetched(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [runsResult, freshnessResult, dependenciesResult] = await Promise.all([
        getComputeRuns({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId,
          versionId: versionId || undefined,
          limit: 20,
        }),
        getComputeFreshness({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId,
          versionId: versionId || undefined,
        }),
        getComputeDependencies({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId,
          versionId: versionId || undefined,
        }),
      ]);

      const nextRuns = normalizeRuns(runsResult.data);
      const nextSelectedRunId = nextRuns[0]?.computeRunId || '';

      setRuns(nextRuns);
      setSelectedRunId(nextSelectedRunId);
      setFreshness(normalizeFreshness(freshnessResult.data));
      setDependencies(normalizeDependencies(dependenciesResult.data));

      if (nextSelectedRunId) {
        await loadRunDetails(nextSelectedRunId);
      } else {
        setRunDetail(null);
        setSteps([]);
        setResults({ outputSummary: {}, warnings: [] });
      }

      setLastFetched(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load compute center.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadComputeCenter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.companyId, ctx.scenarioId, versionId]);

  const outputRows = useMemo(
    () => Object.entries(results.outputSummary).sort((left, right) => right[1] - left[1]),
    [results.outputSummary],
  );

  const selectedRun = runs.find((run) => run.computeRunId === selectedRunId) || null;
  const progressPct = runDetail && runDetail.stepsTotal > 0
    ? Math.round((runDetail.stepsCompleted / runDetail.stepsTotal) * 100)
    : 0;

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Compute Center</h1>
          <p className="mt-2 text-sm text-gray-500">
            Monitor run history, pipeline freshness, and execution progress for the live compute orchestration flow.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DataFreshness source={loading ? 'loading' : ctx.companyId ? 'api' : undefined} lastFetched={lastFetched} />
          <button
            type="button"
            onClick={() => void loadComputeCenter()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!ctx.companyId || !ctx.scenarioId || !versionId) {
                setError('A company, scenario, and version must be active before starting compute.');
                return;
              }

              setMutating(true);
              setError(null);
              try {
                const result = await createComputeRuns({
                  companyId: ctx.companyId,
                  scenarioId: ctx.scenarioId,
                  versionId,
                  triggerType: 'manual',
                });

                const createdRunId = result.data?.computeRunId || '';
                await loadComputeCenter();
                if (createdRunId) {
                  setSelectedRunId(createdRunId);
                }
              } catch (runError) {
                setError(runError instanceof Error ? runError.message : 'Failed to start compute run.');
              } finally {
                setMutating(false);
              }
            }}
            disabled={!ctx.companyId || !ctx.scenarioId || !versionId || mutating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10233F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16335B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Run Compute
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!selectedRun || !['queued', 'running'].includes(selectedRun.status.toLowerCase())) {
                return;
              }

              setMutating(true);
              setError(null);
              try {
                await cancelComputeRuns(selectedRun.computeRunId, { reason: 'Cancelled from Compute Center' });
                await loadComputeCenter();
              } catch (cancelError) {
                setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel compute run.');
              } finally {
                setMutating(false);
              }
            }}
            disabled={!selectedRun || !['queued', 'running'].includes(selectedRun.status.toLowerCase()) || mutating}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            Cancel Run
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Pipeline Freshness</p>
          <div className="mt-3">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(freshness.freshness)}`}>
              {titleCase(freshness.freshness)}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-500">{freshness.lastRunAt ? `Last run ${formatDateTime(freshness.lastRunAt)}` : 'No completed run recorded yet.'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Run History</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{runs.length}</p>
          <p className="mt-2 text-xs text-gray-500">Live compute runs available for the active scenario.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Active Status</p>
          <div className="mt-3">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(selectedRun?.status || 'idle')}`}>
              {titleCase(selectedRun?.status || 'idle')}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-500">{selectedRun ? `${titleCase(selectedRun.triggerType)} trigger` : 'Select or create a run to inspect execution.'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Critical Path</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{dependencies.criticalPath.length}</p>
          <p className="mt-2 text-xs text-gray-500">Pipeline stages on the canonical execution path.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Run History</h2>
          <p className="mt-2 text-sm text-gray-500">Select a run to inspect step execution and output artifacts.</p>

          <div className="mt-5 space-y-3">
            {runs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No compute runs exist for the current planning context yet.
              </div>
            )}

            {runs.map((run) => {
              const selected = run.computeRunId === selectedRunId;
              return (
                <button
                  key={run.computeRunId}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(run.computeRunId);
                    void loadRunDetails(run.computeRunId);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? 'border-[#1E5B9C]/40 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#1E5B9C]/25 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{run.computeRunId}</p>
                      <p className="mt-1 text-xs text-gray-500">{titleCase(run.triggerType)} trigger • Created {formatDateTime(run.createdAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(run.status)}`}>
                      {titleCase(run.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Execution Detail</h2>
              <p className="mt-2 text-sm text-gray-500">
                {runDetail ? `${runDetail.computeRunId} is currently ${runDetail.status}.` : 'Select a compute run to inspect details.'}
              </p>
            </div>
            {runDetail && (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(runDetail.status)}`}>
                {titleCase(runDetail.status)}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">Step Progress</p>
              <p className="text-sm font-bold text-gray-900">{runDetail ? `${runDetail.stepsCompleted}/${runDetail.stepsTotal}` : '0/0'}</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-[#1E5B9C]" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Execution Steps</h3>
            <div className="mt-4 space-y-3">
              {steps.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  Step detail will appear once a run is selected.
                </div>
              )}

              {steps.map((step) => (
                <div key={step.stepId} className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{step.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{step.startedAt ? `Started ${formatDateTime(step.startedAt)}` : 'Pending start'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(step.status)}`}>
                      {titleCase(step.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">Duration {Math.round(step.durationMs)} ms</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[#1E5B9C]" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Dependency Graph</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dependencies.nodes.map((node) => (
                <div key={node.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{node.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{titleCase(node.stage)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#1E5B9C]" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Output Summary</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outputRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  No output rows have been recorded yet.
                </div>
              )}
              {outputRows.map(([name, count]) => (
                <div key={name} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{titleCase(name)}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>

            {results.warnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-800">Warnings</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {results.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
