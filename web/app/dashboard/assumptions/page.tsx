"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Layers3, Shield } from 'lucide-react';
import { getAssumptionsSets } from '@/lib/api-client';
import {
  ASSUMPTION_FAMILY_CONFIG,
  ASSUMPTION_FAMILY_ORDER,
  type AssumptionFamilyKey,
} from '@/lib/assumptions-surfaces';
import { ASSUMPTION_FAMILY_HANDLERS } from '@/lib/assumptions-runtime';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import type { DataSource } from '@/lib/data-source';

type FamilyCountState = Record<AssumptionFamilyKey, number>;

const emptyCounts: FamilyCountState = {
  demand: 0,
  cost: 0,
  funding: 0,
  'working-capital': 0,
};

function formatPanelDate(value: string | null | undefined) {
  if (!value) return 'Not loaded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not loaded';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function AssumptionsOverviewPage() {
  const ctx = usePlanningContext();
  const selectedScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);
  const [counts, setCounts] = useState<FamilyCountState>(emptyCounts);
  const [setLabel, setSetLabel] = useState('No active assumption set');
  const [setStatus, setSetStatus] = useState('Draft');
  const [lastModified, setLastModified] = useState('Not loaded');
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBindings = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!ctx.companyId) {
        setCounts(emptyCounts);
        setSetLabel('No active assumption set');
        setSetStatus('Draft');
        setLastModified('Not loaded');
        setDataSource('api');
        setLastFetched(null);
        return;
      }

      setDataSource('loading');
      const params = {
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        versionId: selectedScenario?.latestVersionId || undefined,
      };

      const [setsResult, demandResult, costResult, fundingResult, wcResult] = await Promise.all([
        getAssumptionsSets({ ...params, limit: 1 }),
        ASSUMPTION_FAMILY_HANDLERS.demand.load(params),
        ASSUMPTION_FAMILY_HANDLERS.cost.load(params),
        ASSUMPTION_FAMILY_HANDLERS.funding.load(params),
        ASSUMPTION_FAMILY_HANDLERS['working-capital'].load(params),
      ]);

      if (cancelled) {
        return;
      }

      const activeSet = setsResult.data?.[0];
      setSetLabel(activeSet?.assumptionSetId || 'No active assumption set');
      setSetStatus(activeSet?.status || 'Draft');
      setLastModified(formatPanelDate(activeSet?.createdAt));
      setCounts({
        demand: Array.isArray(demandResult.data) ? demandResult.data.length : 0,
        cost: Array.isArray(costResult.data) ? costResult.data.length : 0,
        funding: Array.isArray(fundingResult.data) ? fundingResult.data.length : 0,
        'working-capital': Array.isArray(wcResult.data) ? wcResult.data.length : 0,
      });
      setDataSource('api');
      setLastFetched(new Date());
      setError(
        setsResult.error
          || demandResult.error
          || costResult.error
          || fundingResult.error
          || wcResult.error
          || null,
      );
    }

    void loadOverview().catch((loadError) => {
      if (!cancelled) {
        setCounts(emptyCounts);
        setDataSource('api');
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assumptions overview.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId, selectedScenario?.latestVersionId]);

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="rounded-[28px] bg-[#10233F] px-8 py-7 text-white shadow-xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">Canonical Assumptions</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Assumptions Overview</h1>
            <p className="mt-3 text-sm text-slate-200">
              The assumptions workspace is now split into routed canonical family surfaces for demand, cost, funding, and working capital.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DataFreshness source={dataSource} lastFetched={lastFetched} />
            <Link
              href={ASSUMPTION_FAMILY_CONFIG.demand.href}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#0F2746] hover:bg-cyan-200"
            >
              Open Demand Surface
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Active Set</p>
          <div className="mt-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-sm font-semibold text-gray-900">{setLabel}</p>
          </div>
          <p className="mt-2 text-xs text-gray-500">{setStatus} • Last touched {lastModified}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Live Bindings</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{totalBindings}</p>
          <p className="mt-2 text-xs text-gray-500">Rows currently available across the four canonical assumption families.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Planning Context</p>
          <div className="mt-3 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-sm font-semibold text-gray-900">{ctx.scenarioName || 'No active scenario'}</p>
          </div>
          <p className="mt-2 text-xs text-gray-500">{ctx.companyName || 'Select a company'} • {selectedScenario?.latestVersionId ? `Version ${selectedScenario.latestVersionId.slice(0, 8)}` : 'No active version'}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {ASSUMPTION_FAMILY_ORDER.map((family) => {
          const config = ASSUMPTION_FAMILY_CONFIG[family];
          return (
            <Link
              key={family}
              href={config.href}
              className="group rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1E5B9C]/30 hover:shadow-md"
            >
              <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white ${config.accentClass}`}>
                {config.shortLabel}
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-900">{config.label}</h2>
              <p className="mt-3 text-sm text-gray-500">{config.description}</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Live rows</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{counts[family]}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E5B9C]">
                  Open surface
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
