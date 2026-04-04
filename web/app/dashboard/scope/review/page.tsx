"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import { getScopeBundles, getScopeReviewSummary, validateScopeReview } from '@/lib/api-client';
import { asArray, asRecord, titleCase, toNumber, toText } from '@/lib/phase5-utils';

type ScopeBundle = {
  scopeBundleId: string;
  name: string;
  status: string;
  dimensionCount: number;
};

type ScopeIssue = {
  code: string;
  message: string;
  severity: string;
};

type ScopeSummary = {
  totalNodes: number;
  includedNodes: number;
  excludedNodes: number;
  dimensionBreakdown: Record<string, number>;
  warnings: string[];
};

function normalizeBundles(raw: unknown): ScopeBundle[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      scopeBundleId: toText(row.scopeBundleId, ''),
      name: toText(row.name, 'Untitled bundle'),
      status: toText(row.status, 'draft'),
      dimensionCount: toNumber(row.dimensionCount),
    };
  }).filter((bundle) => bundle.scopeBundleId);
}

function normalizeSummary(raw: unknown): ScopeSummary {
  const row = asRecord(raw);
  const rawBreakdown = asRecord(row.dimensionBreakdown);
  const dimensionBreakdown = Object.entries(rawBreakdown).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = toNumber(value);
    return acc;
  }, {});

  return {
    totalNodes: toNumber(row.totalNodes),
    includedNodes: toNumber(row.includedNodes),
    excludedNodes: toNumber(row.excludedNodes),
    dimensionBreakdown,
    warnings: asArray(row.warnings).map((warning) => toText(warning, '')).filter(Boolean),
  };
}

function normalizeIssues(raw: unknown): ScopeIssue[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      code: toText(row.code, 'ISSUE'),
      message: toText(row.message, 'Issue detected'),
      severity: toText(row.severity, 'warning'),
    };
  });
}

function severityTone(severity: string): string {
  const normalized = severity.trim().toLowerCase();
  if (normalized === 'error' || normalized === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (normalized === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export default function ScopeReviewSurface() {
  const ctx = usePlanningContext();
  const [bundles, setBundles] = useState<ScopeBundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [summary, setSummary] = useState<ScopeSummary>({
    totalNodes: 0,
    includedNodes: 0,
    excludedNodes: 0,
    dimensionBreakdown: {},
    warnings: [],
  });
  const [valid, setValid] = useState<boolean | null>(null);
  const [issues, setIssues] = useState<ScopeIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function runValidation(bundleId: string) {
    if (!ctx.companyId || !bundleId) {
      setValid(null);
      setIssues([]);
      return;
    }

    setValidating(true);
    try {
      const validationResult = await validateScopeReview({
        scopeBundleId: bundleId,
      });

      setValid(Boolean(validationResult.data?.valid));
      setIssues(normalizeIssues(validationResult.data?.issues));
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Scope validation failed.');
    } finally {
      setValidating(false);
    }
  }

  useEffect(() => {
    if (!ctx.companyId) {
      setBundles([]);
      setSelectedBundleId('');
      setSummary({
        totalNodes: 0,
        includedNodes: 0,
        excludedNodes: 0,
        dimensionBreakdown: {},
        warnings: [],
      });
      setValid(null);
      setIssues([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getScopeBundles({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        limit: 20,
      }),
      getScopeReviewSummary({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
      }),
    ])
      .then(async ([bundlesResult, summaryResult]) => {
        if (cancelled) return;
        const nextBundles = normalizeBundles(bundlesResult.data);
        const nextSummary = normalizeSummary(summaryResult.data);
        const nextBundleId = nextBundles[0]?.scopeBundleId || '';

        setBundles(nextBundles);
        setSelectedBundleId((current) => {
          if (current && nextBundles.some((bundle) => bundle.scopeBundleId === current)) {
            return current;
          }
          return nextBundleId;
        });
        setSummary(nextSummary);
        setLastFetched(new Date());

        const bundleToValidate = nextBundles.some((bundle) => bundle.scopeBundleId === selectedBundleId)
          ? selectedBundleId
          : nextBundleId;

        if (bundleToValidate) {
          await runValidation(bundleToValidate);
        } else {
          setValid(null);
          setIssues([]);
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load scope review.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.companyId, ctx.scenarioId]);

  const selectedBundle = bundles.find((bundle) => bundle.scopeBundleId === selectedBundleId) || null;
  const breakdownRows = useMemo(
    () => Object.entries(summary.dimensionBreakdown).sort((left, right) => right[1] - left[1]),
    [summary.dimensionBreakdown],
  );

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scope Review Surface</h1>
          <p className="mt-2 text-sm text-gray-500">
            Validate the active scope bundle and confirm live dimension coverage before running the compute pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataFreshness source={loading ? 'loading' : ctx.companyId ? 'api' : undefined} lastFetched={lastFetched} />
          <button
            type="button"
            onClick={() => {
              if (selectedBundleId) {
                void runValidation(selectedBundleId);
              }
            }}
            disabled={!selectedBundleId || validating}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${validating ? 'animate-spin' : ''}`} />
            Run Validation
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
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Included Nodes</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{summary.includedNodes}</p>
          <p className="mt-2 text-xs text-gray-500">Live scope members available for compute.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Bundles</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{bundles.length}</p>
          <p className="mt-2 text-xs text-gray-500">Scoped bundles available to the current planning context.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Dimensions</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{breakdownRows.length}</p>
          <p className="mt-2 text-xs text-gray-500">Families represented in the selected scope configuration.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Validation Status</p>
          <div className="mt-3 flex items-center gap-2">
            {valid === null ? (
              <ShieldAlert className="h-6 w-6 text-gray-300" />
            ) : valid ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            <p className="text-lg font-bold text-gray-900">
              {valid === null ? 'Pending' : valid ? 'Ready' : 'Review Needed'}
            </p>
          </div>
          <p className="mt-2 text-xs text-gray-500">Bundle validation runs against the live scope APIs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Active Bundles</h2>
              <p className="mt-2 text-sm text-gray-500">Select a bundle to validate its live dimension coverage.</p>
            </div>
            <Link
              href="/dashboard/scope"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]"
            >
              Open Editors
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {bundles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No scope bundles were found for the current company and scenario.
              </div>
            )}

            {bundles.map((bundle) => {
              const selected = bundle.scopeBundleId === selectedBundleId;
              return (
                <button
                  key={bundle.scopeBundleId}
                  type="button"
                  onClick={() => {
                    setSelectedBundleId(bundle.scopeBundleId);
                    void runValidation(bundle.scopeBundleId);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? 'border-[#1E5B9C]/40 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#1E5B9C]/25 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{bundle.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{bundle.dimensionCount} live dimension items</p>
                    </div>
                    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">
                      {titleCase(bundle.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Validation Summary</h2>
          <p className="mt-2 text-sm text-gray-500">
            {selectedBundle ? `${selectedBundle.name} is the active review target.` : 'Select a bundle to inspect validation results.'}
          </p>

          <div className="mt-5 space-y-3">
            {issues.length === 0 && valid !== false && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                <p className="text-sm font-semibold text-green-800">No blocking issues detected</p>
                <p className="mt-1 text-xs text-green-700">The selected bundle is ready for compute and governance review.</p>
              </div>
            )}

            {issues.map((issue) => (
              <div key={`${issue.code}-${issue.message}`} className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{issue.code}</p>
                    <p className="mt-1 text-sm text-gray-600">{issue.message}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${severityTone(issue.severity)}`}>
                    {issue.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Coverage Summary</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {breakdownRows.map(([family, count]) => (
                <div key={family} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{titleCase(family)}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>

            {summary.warnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-800">Warnings</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {summary.warnings.map((warning) => (
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
