"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, PlayCircle, RefreshCw, Square, Workflow } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import {
  cancelComputeRuns,
  createComputeRuns,
  createComputeValidations,
  getComputeDependencies,
  getComputeFreshness,
  getComputeRuns,
  getComputeRunsById,
  getComputeRunsResults,
  getComputeRunsSteps,
  getComputeValidationsById,
  getComputeValidationsIssues,
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
  warnings: ComputeWarning[];
};

type ComputeWarning = {
  title: string;
  detail: string;
  meta: string[];
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

type ValidationIssue = {
  code: string;
  severity: string;
  stage: string;
  surface: string;
  message: string;
  entityRefs: string[];
};

type ValidationSummary = {
  validationId: string;
  status: string;
  issueCounts: Record<string, number>;
  createdAt: string;
  completedAt: string;
  issues: ValidationIssue[];
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

function normalizeIssueCounts(raw: unknown): Record<string, number> {
  return Object.entries(asRecord(raw)).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = toNumber(value);
    return acc;
  }, {});
}

function normalizeWarning(raw: unknown): ComputeWarning {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const text = toText(raw, 'Warning');
    return { title: text, detail: text, meta: [] };
  }

  const row = asRecord(raw);
  const title = toText(row.code, toText(row.variable, toText(row.alert_type, toText(row.stage, toText(row.title, 'Warning')))));
  const detail = toText(row.message, toText(row.detail, toText(row.summary, toText(row.description, title))));
  const meta = [
    toText(row.severity, ''),
    toText(row.stage, ''),
    toText(row.surface, ''),
    toText(row.period, ''),
    toText(row.variable, ''),
  ].filter((value) => value && value !== '—');

  return {
    title,
    detail,
    meta: Array.from(new Set(meta)),
  };
}

function normalizeResults(raw: unknown): ComputeResult {
  const row = asRecord(raw);
  const outputSummary = Object.entries(asRecord(row.outputSummary)).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = toNumber(value);
    return acc;
  }, {});

  return {
    outputSummary,
    warnings: asArray(row.warnings)
      .map((value) => normalizeWarning(value))
      .filter((value) => Boolean(value.title || value.detail)),
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

function normalizeValidationIssue(raw: unknown): ValidationIssue {
  const row = asRecord(raw);
  return {
    code: toText(row.code, 'issue'),
    severity: toText(row.severity, 'info'),
    stage: toText(row.stage, 'stage'),
    surface: toText(row.surface, 'surface'),
    message: toText(row.message, 'Validation issue'),
    entityRefs: describeEntityRefs(row.entityRefs),
  };
}

function normalizeValidationIssues(raw: unknown): ValidationIssue[] {
  return asArray(raw)
    .map((value) => normalizeValidationIssue(value))
    .filter((issue) => Boolean(issue.code || issue.message));
}

function describeEntityRefs(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return asArray(raw).map((value) => toText(value, '')).filter(Boolean);
  }

  const row = asRecord(raw);
  return Object.entries(row)
    .flatMap(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return [];
      }

      if (typeof value === 'object') {
        const nested = Object.entries(asRecord(value))
          .map(([nestedKey, nestedValue]) => `${titleCase(nestedKey)}=${toText(nestedValue, '')}`)
          .filter((part) => !part.endsWith('='));

        return nested.length > 0 ? [`${titleCase(key)}: ${nested.join(', ')}`] : [titleCase(key)];
      }

      return [`${titleCase(key)}=${toText(value, '')}`];
    })
    .filter(Boolean);
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

function formatCountLabel(value: number): string {
  if (value >= 1_000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(value);
}

function statusTone(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'fresh') return 'bg-green-100 text-green-700 border-green-200';
  if (normalized === 'queued' || normalized === 'running' || normalized === 'processing') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (normalized === 'cancelled') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (normalized === 'failed' || normalized === 'error') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function durationLabel(startedAt: string, completedAt: string) {
  if (!startedAt || !completedAt) {
    return 'Pending';
  }

  const started = new Date(startedAt);
  const completed = new Date(completedAt);
  if (Number.isNaN(started.getTime()) || Number.isNaN(completed.getTime())) {
    return 'Pending';
  }

  const diffMs = Math.max(completed.getTime() - started.getTime(), 0);
  if (diffMs >= 60_000) {
    return `${Math.round(diffMs / 60_000)} min`;
  }

  return `${Math.round(diffMs / 1_000)} sec`;
}

export default function ComputeCenterPage() {
  const ctx = usePlanningContext();
  const activeScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);
  const versionId = activeScenario?.latestVersionId || '';
  const selectedRunIdRef = useRef('');

  const [runs, setRuns] = useState<ComputeRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runDetail, setRunDetail] = useState<ComputeRunDetail | null>(null);
  const [steps, setSteps] = useState<ComputeRunStep[]>([]);
  const [results, setResults] = useState<ComputeResult>({ outputSummary: {}, warnings: [] });
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
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

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  const loadRunDetails = useCallback(async (runId: string) => {
    const [detailResult, stepsResult, resultsResult] = await Promise.all([
      getComputeRunsById(runId),
      getComputeRunsSteps(runId, { limit: 30 }),
      getComputeRunsResults(runId),
    ]);

    const firstError = detailResult.error || stepsResult.error || resultsResult.error || null;
    if (firstError) {
      setError(firstError);
    }

    setRunDetail(detailResult.data ? normalizeRunDetail(detailResult.data) : null);
    setSteps(stepsResult.data ? normalizeSteps(stepsResult.data) : []);
    setResults(resultsResult.data ? normalizeResults(resultsResult.data) : { outputSummary: {}, warnings: [] });
  }, []);

  const loadValidationDiagnostics = useCallback(async () => {
    if (!ctx.companyId || !ctx.scenarioId || !versionId) {
      setValidationError('Select a company, scenario, and version before running validation.');
      return;
    }

    setValidationLoading(true);
    setValidationError(null);

    try {
      const validationResult = await createComputeValidations({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        versionId,
      });

      if (validationResult.error || !validationResult.data?.validationId) {
        throw new Error(validationResult.error || 'Validation did not return an ID.');
      }

      const validationId = validationResult.data.validationId;
      const [detailResult, issuesResult] = await Promise.all([
        getComputeValidationsById(validationId),
        getComputeValidationsIssues(validationId, { limit: 200 }),
      ]);

      const firstError = detailResult.error || issuesResult.error || null;
      if (firstError) {
        throw new Error(firstError);
      }

      setValidationSummary({
        validationId,
        status: toText(detailResult.data?.status, toText(validationResult.data.status, 'completed')),
        issueCounts: normalizeIssueCounts(detailResult.data?.issueCounts ?? validationResult.data.issueCounts),
        createdAt: toText(detailResult.data?.createdAt, ''),
        completedAt: toText(detailResult.data?.completedAt, ''),
        issues: normalizeValidationIssues(issuesResult.data),
      });
    } catch (validationLoadError) {
      setValidationSummary(null);
      setValidationError(validationLoadError instanceof Error ? validationLoadError.message : 'Validation failed to load.');
    } finally {
      setValidationLoading(false);
    }
  }, [ctx.companyId, ctx.scenarioId, versionId]);

  const loadComputeCenter = useCallback(async () => {
    if (!ctx.companyId || !ctx.scenarioId) {
      setRuns([]);
      setSelectedRunId('');
      setRunDetail(null);
      setSteps([]);
      setResults({ outputSummary: {}, warnings: [] });
      setFreshness({ freshness: 'stale', lastRunId: '', lastRunAt: '', staleSurfaces: [] });
      setDependencies({ nodes: [], edges: [], criticalPath: [] });
      setLastFetched(null);
      setValidationSummary(null);
      setValidationError(null);
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
      const preservedRunId = selectedRunIdRef.current;
      const nextSelectedRunId = (preservedRunId && nextRuns.some((run) => run.computeRunId === preservedRunId))
        ? preservedRunId
        : nextRuns.find((run) => ['failed', 'error'].includes(run.status.trim().toLowerCase()))?.computeRunId
          || nextRuns[0]?.computeRunId
          || '';

      const loadErrors = [runsResult.error, freshnessResult.error, dependenciesResult.error].filter(Boolean);
      if (loadErrors.length > 0) {
        setError(loadErrors[0] || null);
      }

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
  }, [ctx.companyId, ctx.scenarioId, versionId, loadRunDetails]);

  useEffect(() => {
    void loadComputeCenter();
  }, [loadComputeCenter]);

  const outputRows = useMemo(
    () => Object.entries(results.outputSummary).sort((left, right) => right[1] - left[1]),
    [results.outputSummary],
  );

  const selectedRun = runs.find((run) => run.computeRunId === selectedRunId) || null;
  const selectedRunStatus = selectedRun?.status.trim().toLowerCase() || 'idle';
  const selectedRunWarnings = results.warnings;
  const progressPct = runDetail && runDetail.stepsTotal > 0
    ? Math.round((runDetail.stepsCompleted / runDetail.stepsTotal) * 100)
    : 0;
  const queueStats = useMemo(() => {
    const stats = { queued: 0, inFlight: 0, failed: 0, completed: 0 };

    for (const run of runs) {
      const normalized = run.status.trim().toLowerCase();
      if (normalized === 'queued') {
        stats.queued += 1;
      } else if (normalized === 'running' || normalized === 'processing') {
        stats.inFlight += 1;
      } else if (normalized === 'failed' || normalized === 'error') {
        stats.failed += 1;
      } else if (normalized === 'completed') {
        stats.completed += 1;
      }
    }

    return stats;
  }, [runs]);
  const hasActiveQueueWork = queueStats.queued > 0 || queueStats.inFlight > 0;
  const selectedOutputTotal = useMemo(
    () => Object.values(results.outputSummary).reduce((sum, count) => sum + count, 0),
    [results.outputSummary],
  );
  const failedSteps = useMemo(
    () => steps.filter((step) => ['failed', 'error'].includes(step.status.trim().toLowerCase())),
    [steps],
  );
  const completedSteps = useMemo(
    () => steps.filter((step) => step.status.trim().toLowerCase() === 'completed'),
    [steps],
  );
  const missingOutputs = useMemo(
    () => outputRows.filter(([, count]) => count === 0).map(([name]) => name),
    [outputRows],
  );
  const validationIssueCounts = validationSummary?.issueCounts || {};
  const validationBlockingCount = Object.entries(validationIssueCounts).reduce((sum, [severity, count]) => (
    severity.trim().toLowerCase() === 'blocking' ? sum + count : sum
  ), 0);
  const validationWarningCount = Object.entries(validationIssueCounts).reduce((sum, [severity, count]) => (
    severity.trim().toLowerCase() === 'warning' ? sum + count : sum
  ), 0);
  const latestCompletedRun = useMemo(
    () => runs.filter((run) => run.completedAt).sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] || null,
    [runs],
  );

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId || !hasActiveQueueWork) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadComputeCenter();
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [ctx.companyId, ctx.scenarioId, hasActiveQueueWork, loadComputeCenter]);

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

                if (result.error) {
                  setError(result.error);
                  if (result.error.toLowerCase().includes('validation failed')) {
                    await loadValidationDiagnostics();
                  }
                  return;
                }

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
                const result = await cancelComputeRuns(selectedRun.computeRunId, { reason: 'Cancelled from Compute Center' });
                if (result.error) {
                  setError(result.error);
                  return;
                }
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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Queue Observability</h2>
            <p className="mt-2 text-sm text-gray-500">
              Queue depth, failure pressure, and selected run output totals derived from the live compute endpoints.
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(hasActiveQueueWork ? 'running' : 'completed')}`}>
            {hasActiveQueueWork ? 'Auto-Refresh 5s' : 'Manual Refresh'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Queued Backlog</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{queueStats.queued}</p>
            <p className="mt-2 text-xs text-gray-500">Runs waiting to execute.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">In Flight</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{queueStats.inFlight}</p>
            <p className="mt-2 text-xs text-gray-500">Runs currently processing.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Failed Runs</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{queueStats.failed}</p>
            <p className="mt-2 text-xs text-gray-500">Runs requiring operator review.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Last Completed Duration</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {latestCompletedRun ? durationLabel(latestCompletedRun.createdAt, latestCompletedRun.completedAt) : 'Pending'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {latestCompletedRun?.completedAt ? `Completed ${formatDateTime(latestCompletedRun.completedAt)}` : 'No completed run recorded.'}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Selected Output Rows</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{selectedOutputTotal}</p>
            <p className="mt-2 text-xs text-gray-500">
              {selectedRun ? `${titleCase(selectedRun.status)} run artifact total.` : 'Select a run to inspect outputs.'}
            </p>
          </div>
        </div>
      </section>

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
                    setError(null);
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

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Run Snapshot</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Created</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{runDetail ? formatDateTime(runDetail.createdAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Completed</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{runDetail?.completedAt ? formatDateTime(runDetail.completedAt) : 'In progress'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Duration</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {runDetail ? durationLabel(runDetail.createdAt, runDetail.completedAt) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Artifacts</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatCountLabel(selectedOutputTotal)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">Step Progress</p>
                <p className="text-sm font-bold text-gray-900">{runDetail ? `${runDetail.stepsCompleted}/${runDetail.stepsTotal}` : '0/0'}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-[#1E5B9C]" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <p className="font-bold uppercase tracking-[0.16em] text-gray-400">Completed</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{completedSteps.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <p className="font-bold uppercase tracking-[0.16em] text-gray-400">Failed</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{failedSteps.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <p className="font-bold uppercase tracking-[0.16em] text-gray-400">Empty Outputs</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{missingOutputs.length}</p>
                </div>
              </div>
            </div>
          </div>

          {(selectedRunStatus === 'failed' || selectedRunStatus === 'error' || failedSteps.length > 0) && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900">Failed-run diagnostics</p>
                  <p className="mt-1 text-sm text-red-700">
                    The compute APIs do not expose `compute_runs.error_message` or `compute_run_steps.error_message`, so this panel uses the failed-step trail, output gaps, and optional validation results.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadValidationDiagnostics()}
                  disabled={validationLoading || !ctx.companyId || !ctx.scenarioId || !versionId}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:border-red-300 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validationLoading ? 'Running validation…' : 'Run context validation'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-red-100 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">Failed Steps</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{failedSteps.length}</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">Empty Outputs</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{missingOutputs.length}</p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">Validation Issues</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{validationSummary ? validationBlockingCount + validationWarningCount : '—'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-red-800">
                {failedSteps.length > 0
                  ? `First failed step: ${failedSteps[0].name}. Use validation to inspect the current planning context if the run failed before producing artifacts.`
                  : 'No step-level failure is exposed yet; use validation to inspect the current planning context.'}
              </div>

              {validationError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-800">
                  {validationError}
                </div>
              )}

              {validationSummary && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Context validation</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {validationSummary.validationId} • Completed {validationSummary.completedAt ? formatDateTime(validationSummary.completedAt) : 'just now'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(validationSummary.status)}`}>
                        {titleCase(validationSummary.status)}
                      </span>
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">
                        Blocking {validationBlockingCount}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                        Warnings {validationWarningCount}
                      </span>
                    </div>
                  </div>

                  {validationSummary.issues.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {validationSummary.issues.map((issue) => (
                        <div key={`${issue.code}-${issue.stage}-${issue.surface}-${issue.message}`} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{issue.message}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {issue.code} • {titleCase(issue.stage)} • {titleCase(issue.surface)}
                              </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(issue.severity)}`}>
                              {titleCase(issue.severity)}
                            </span>
                          </div>
                          {issue.entityRefs.length > 0 && (
                            <p className="mt-2 text-xs text-gray-500">
                              References: {issue.entityRefs.join(' • ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">The validation job completed without returning individual issues.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Execution Steps</h3>
            <div className="mt-4 space-y-3">
              {steps.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  Step detail will appear once a run is selected.
                </div>
              )}

              {steps.map((step, index) => {
                const stepStatus = step.status.trim().toLowerCase();
                const isFailedStep = ['failed', 'error'].includes(stepStatus);

                return (
                  <div
                    key={step.stepId}
                    className={`rounded-2xl border px-4 py-4 ${
                      isFailedStep ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Step {index + 1}</span>
                          {step.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{step.startedAt ? `Started ${formatDateTime(step.startedAt)}` : 'Pending start'}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(step.status)}`}>
                        {titleCase(step.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Duration {step.durationMs > 0 ? `${Math.round(step.durationMs)} ms` : 'Pending'}
                      {step.completedAt ? ` • Completed ${formatDateTime(step.completedAt)}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[#1E5B9C]" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Dependency Graph</h3>
            </div>
            {dependencies.criticalPath.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {dependencies.criticalPath.map((nodeId, index) => {
                  const node = dependencies.nodes.find((item) => item.id === nodeId);
                  return (
                    <span
                      key={`${nodeId}-${index}`}
                      className="rounded-full border border-[#1E5B9C]/20 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E5B9C]"
                    >
                      {node?.label || titleCase(nodeId)}
                    </span>
                  );
                })}
              </div>
            )}
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
              {outputRows.map(([name, count]) => {
                const isMissing = count === 0;
                return (
                  <div key={name} className={`rounded-2xl border px-4 py-3 ${isMissing ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{titleCase(name)}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
                  </div>
                );
              })}
            </div>

            {selectedRunWarnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-800">Warnings</p>
                <div className="mt-3 space-y-2">
                  {selectedRunWarnings.map((warning) => (
                    <div key={`${warning.title}-${warning.detail}`} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-900">{warning.title}</p>
                        {warning.meta.length > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
                            {warning.meta.join(' • ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-amber-700">{warning.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
