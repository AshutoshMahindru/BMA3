"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Play, Save, Shield } from 'lucide-react';
import { createComputeRuns, getAssumptionsSets } from '@/lib/api-client';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import type { DataSource } from '@/lib/data-source';
import {
  ASSUMPTION_FAMILY_HANDLERS,
  ASSUMPTION_FAMILY_VARIABLES,
} from '@/lib/assumptions-runtime';
import {
  ASSUMPTION_FAMILY_CONFIG,
  ASSUMPTION_FAMILY_ORDER,
  type AssumptionFamilyKey,
} from '@/lib/assumptions-surfaces';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

type AssumptionPanelInfo = {
  setId: string;
  version: string;
  owner: string;
  confidence: number;
  confidenceLabel: string;
  lastModified: string;
  approvalStatus: string;
};

type AssumptionRow = {
  id: string;
  name: string;
  current: string;
  rawValue: number;
  confidence: number;
  source: string;
  unit: string;
  periodId: string;
  grainSignature: Record<string, unknown>;
  variableName: string;
};

const defaultSetInfo: AssumptionPanelInfo = {
  setId: 'No active assumption set',
  version: 'Version unavailable',
  owner: 'Planning context required',
  confidence: 0,
  confidenceLabel: 'Pending',
  lastModified: 'Not loaded',
  approvalStatus: 'Draft',
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

function parseNumericValue(value: unknown): number {
  const numeric = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  switch (String(value || '').toLowerCase()) {
    case 'high':
      return 85;
    case 'medium':
      return 65;
    case 'low':
      return 45;
    default:
      return 60;
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const FAMILY_COLUMNS: Record<AssumptionFamilyKey, ColDef<AssumptionRow>[]> = {
  demand: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 230, editable: false, cellStyle: { fontWeight: 700, color: '#0f172a' } },
    { field: 'current', headerName: 'Value', editable: true, minWidth: 140 },
    { field: 'unit', headerName: 'Unit', editable: true, minWidth: 120 },
    { field: 'periodId', headerName: 'Period', editable: true, minWidth: 150 },
    { field: 'confidence', headerName: 'Confidence', editable: false, minWidth: 120 },
    { field: 'source', headerName: 'Source', editable: false, minWidth: 180 },
  ],
  cost: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 230, editable: false, cellStyle: { fontWeight: 700, color: '#0f172a' } },
    { field: 'current', headerName: 'Value', editable: true, minWidth: 140 },
    { field: 'unit', headerName: 'Unit', editable: true, minWidth: 120 },
    { field: 'periodId', headerName: 'Period', editable: true, minWidth: 150 },
    { field: 'confidence', headerName: 'Confidence', editable: false, minWidth: 120 },
    { field: 'source', headerName: 'Source', editable: false, minWidth: 180 },
  ],
  funding: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 230, editable: false, cellStyle: { fontWeight: 700, color: '#0f172a' } },
    { field: 'current', headerName: 'Value', editable: true, minWidth: 140 },
    { field: 'unit', headerName: 'Unit', editable: true, minWidth: 120 },
    { field: 'periodId', headerName: 'Period', editable: true, minWidth: 150 },
    { field: 'confidence', headerName: 'Confidence', editable: false, minWidth: 120 },
    { field: 'source', headerName: 'Source', editable: false, minWidth: 180 },
  ],
  'working-capital': [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 230, editable: false, cellStyle: { fontWeight: 700, color: '#0f172a' } },
    { field: 'current', headerName: 'Value', editable: true, minWidth: 140 },
    { field: 'unit', headerName: 'Unit', editable: true, minWidth: 120 },
    { field: 'periodId', headerName: 'Period', editable: true, minWidth: 150 },
    { field: 'confidence', headerName: 'Confidence', editable: false, minWidth: 120 },
    { field: 'source', headerName: 'Source', editable: false, minWidth: 180 },
  ],
};

export default function AssumptionFamilySurface({ family }: { family: AssumptionFamilyKey }) {
  const ctx = usePlanningContext();
  const gridRef = useRef<AgGridReact<AssumptionRow>>(null);
  const selectedScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);
  const config = ASSUMPTION_FAMILY_CONFIG[family];
  const api = ASSUMPTION_FAMILY_HANDLERS[family];
  const variableOptions = ASSUMPTION_FAMILY_VARIABLES[family];

  const [rows, setRows] = useState<AssumptionRow[]>([]);
  const [setInfo, setSetInfo] = useState<AssumptionPanelInfo>(defaultSetInfo);
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'warning' | 'error' | 'success'; text: string } | null>(null);

  const defaultColDef = useMemo<ColDef<AssumptionRow>>(() => ({
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
  }), []);

  const avgConfidence = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length);
  }, [rows]);

  const periodCoverage = useMemo(() => {
    return new Set(rows.map((row) => row.periodId).filter(Boolean)).size;
  }, [rows]);

  const confidenceTone = avgConfidence >= 80
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : avgConfidence >= 60
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  useEffect(() => {
    let cancelled = false;

    async function loadSetInfo() {
      if (!ctx.companyId || !ctx.scenarioId) {
        setSetInfo(defaultSetInfo);
        return;
      }

      const result = await getAssumptionsSets({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        versionId: selectedScenario?.latestVersionId || undefined,
        limit: 1,
      });

      if (cancelled) {
        return;
      }

      const activeSet = result.data?.[0];
      setSetInfo({
        setId: activeSet?.assumptionSetId || 'No active assumption set',
        version: selectedScenario?.latestVersionId
          ? `Version ${selectedScenario.latestVersionId.slice(0, 8)}`
          : 'Version unavailable',
        owner: ctx.companyName || 'Planning context required',
        confidence: activeSet ? 100 : 0,
        confidenceLabel: activeSet ? 'Tracked' : 'Pending',
        lastModified: formatPanelDate(activeSet?.createdAt),
        approvalStatus: activeSet?.status || 'Draft',
      });

      if (result.error) {
        setBanner({
          tone: 'warning',
          text: result.error,
        });
      }
    }

    void loadSetInfo().catch((error) => {
      if (!cancelled) {
        setSetInfo(defaultSetInfo);
        setBanner({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Failed to load assumption-set metadata.',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.companyName, ctx.scenarioId, selectedScenario?.latestVersionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      if (!ctx.companyId) {
        setRows([]);
        setDataSource('api');
        setLastFetched(null);
        setIsDirty(false);
        return;
      }

      setDataSource('loading');
      const result = await api.load({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        versionId: selectedScenario?.latestVersionId || undefined,
      });

      if (cancelled) {
        return;
      }

      if (!result.data) {
        setRows([]);
        setDataSource('api');
        setLastFetched(new Date());
        setBanner({
          tone: 'warning',
          text: result.error || `No ${config.shortLabel.toLowerCase()} assumptions were returned.`,
        });
        return;
      }

      const nextRows = result.data.map((item: any, index: number) => ({
        id: item.fieldId || `${family}-${index + 1}`,
        name: item.name || `Field ${index + 1}`,
        current: String(item.value ?? ''),
        rawValue: parseNumericValue(item.value ?? ''),
        confidence: parseConfidence(item.confidence),
        source: item.source || 'Assumption pack',
        unit: item.unit || '',
        periodId: item.periodId || item.grainSignature?.period_id || '',
        grainSignature: item.grainSignature || (item.periodId ? { period_id: item.periodId } : {}),
        variableName: item.variableName || item.name || `field_${index + 1}`,
      }));

      setRows(nextRows);
      setIsDirty(false);
      setDataSource('api');
      setLastFetched(new Date());
      setBanner(null);
    }

    void loadRows().catch((error) => {
      if (!cancelled) {
        setRows([]);
        setDataSource('api');
        setBanner({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Failed to load assumptions.',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, config.shortLabel, ctx.companyId, ctx.scenarioId, family, selectedScenario?.latestVersionId]);

  const syncRowsFromGrid = useCallback(() => {
    if (!gridRef.current?.api) {
      return;
    }
    const nextRows: AssumptionRow[] = [];
    gridRef.current.api.forEachNode((node) => {
      const data = node.data;
      if (!data) return;
      nextRows.push({
        ...data,
        rawValue: parseNumericValue(data.current),
      });
    });
    setRows(nextRows);
  }, []);

  const onCellValueChanged = useCallback(() => {
    setIsDirty(true);
    syncRowsFromGrid();
  }, [syncRowsFromGrid]);

  const addMissingField = useCallback(() => {
    const existingVariables = new Set(rows.map((row) => row.variableName));
    const nextVariable = variableOptions.find((option) => !existingVariables.has(option.variableName));

    if (!nextVariable) {
      setBanner({
        tone: 'warning',
        text: `All canonical ${config.shortLabel.toLowerCase()} fields are already present in this surface.`,
      });
      return;
    }

    setRows((currentRows) => [
      ...currentRows,
      {
        id: `draft-${family}-${Date.now()}`,
        name: nextVariable.label,
        current: '0',
        rawValue: 0,
        confidence: 60,
        source: 'Draft entry',
        unit: nextVariable.unit,
        periodId: '',
        grainSignature: {},
        variableName: nextVariable.variableName,
      },
    ]);
    setIsDirty(true);
    setBanner(null);
  }, [config.shortLabel, family, rows, variableOptions]);

  const handleSave = useCallback(async () => {
    if (!ctx.companyId || !ctx.scenarioId) {
      setBanner({ tone: 'warning', text: 'Select a company and scenario before saving assumptions.' });
      return;
    }

    setIsSaving(true);
    setBanner(null);
    try {
      const payload = {
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        updates: rows.map((row) => ({
          ...(isUuid(row.id) ? { fieldId: row.id } : {}),
          variableName: row.variableName,
          value: Number.isFinite(row.rawValue) ? row.rawValue : parseNumericValue(row.current),
          unit: row.unit || undefined,
          grainSignature: {
            ...(row.grainSignature || {}),
            ...(row.periodId ? { period_id: row.periodId } : {}),
          },
        })),
      };

      const result = await api.save(payload);
      if (!result.data) {
        throw new Error(result.error || 'Save did not return a response payload');
      }

      setIsDirty(false);
      setDataSource('api');
      setLastFetched(new Date());
      setBanner({
        tone: 'success',
        text: `${config.label} saved successfully.`,
      });
    } catch (error) {
      setBanner({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Save failed.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [api, config.label, ctx.companyId, ctx.scenarioId, rows]);

  const handleRunEngine = useCallback(async () => {
    if (!ctx.companyId || !ctx.scenarioId) {
      setBanner({ tone: 'warning', text: 'Select a company and scenario before running compute.' });
      return;
    }

    const versionId = selectedScenario?.latestVersionId;
    if (!versionId) {
      setBanner({ tone: 'warning', text: 'The active scenario does not yet have a version to compute.' });
      return;
    }

    setBanner(null);
    try {
      const result = await createComputeRuns({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        versionId,
        triggerType: 'manual',
      });

      if (!result.data?.computeRunId) {
        throw new Error(result.error || 'Compute run could not be started');
      }

      setBanner({
        tone: 'success',
        text: `Compute run ${result.data.computeRunId} started with status ${result.data.status}.`,
      });
    } catch (error) {
      setBanner({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Compute run failed to start.',
      });
    }
  }, [ctx.companyId, ctx.scenarioId, selectedScenario?.latestVersionId]);

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="rounded-[28px] bg-[#10233F] px-8 py-7 text-white shadow-xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">Canonical Assumptions</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{config.label}</h1>
            <p className="mt-3 text-sm text-slate-200">{config.description}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DataFreshness source={dataSource} lastFetched={lastFetched} />
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handleRunEngine}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#0F2746] hover:bg-cyan-200"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Run Compute
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/assumptions"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Overview
          </Link>
          {ASSUMPTION_FAMILY_ORDER.map((key) => {
            const familyConfig = ASSUMPTION_FAMILY_CONFIG[key];
            const active = key === family;
            return (
              <Link
                key={key}
                href={familyConfig.href}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-white text-[#10233F]'
                    : 'border border-white/15 bg-white/10 text-slate-100 hover:bg-white/20'
                }`}
              >
                {familyConfig.shortLabel}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Active Set</p>
          <div className="mt-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-sm font-semibold text-gray-900">{setInfo.setId}</p>
          </div>
          <p className="mt-2 text-xs text-gray-500">{setInfo.version}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Bindings</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{rows.length}</p>
          <p className="mt-2 text-xs text-gray-500">Live rows available for this family surface.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Average Confidence</p>
          <div className="mt-3">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${confidenceTone}`}>
              {avgConfidence}% {avgConfidence >= 80 ? 'High' : avgConfidence >= 60 ? 'Medium' : 'Low'}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-500">Derived from the current live assumption rows.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Period Coverage</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{periodCoverage}</p>
          <p className="mt-2 text-xs text-gray-500">Distinct planning periods represented in the editor.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">{config.label}</h2>
            <p className="mt-1 text-sm text-gray-500">
              This surface persists canonical family updates only. Deletes are intentionally excluded because the underlying API is upsert-oriented.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addMissingField}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]"
            >
              Add Missing Field
            </button>
          </div>
        </div>

        {banner && (
          <div className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm ${
            banner.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : banner.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>
            <div className="flex items-start gap-3">
              {banner.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : banner.tone === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
          </div>
        )}

        <div className="px-5 py-5">
          <div className="ag-theme-alpine w-full overflow-hidden rounded-2xl border border-gray-200" style={{ minHeight: '460px' }}>
            <style jsx global>{`
              .ag-theme-alpine {
                --ag-border-color: #e5e7eb;
                --ag-header-background-color: #dbe7f5;
                --ag-header-foreground-color: #10233f;
                --ag-odd-row-background-color: #f8fafc;
                --ag-row-hover-color: #ecfeff;
                --ag-selected-row-background-color: #e0f2fe;
                --ag-font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
                --ag-font-size: 12px;
              }
              .ag-theme-alpine .ag-header-cell-label {
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-size: 0.65rem;
                color: #10233f;
              }
            `}</style>

            <AgGridReact<AssumptionRow>
              ref={gridRef}
              rowData={rows}
              columnDefs={FAMILY_COLUMNS[family]}
              defaultColDef={defaultColDef}
              animateRows
              domLayout="autoHeight"
              getRowId={(params) => params.data.id}
              onCellValueChanged={onCellValueChanged}
              overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading live assumptions...</span>'}
            />
          </div>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Unsaved edits are present on this family surface. Save before switching context or running governance workflows.
        </div>
      )}
    </div>
  );
}
