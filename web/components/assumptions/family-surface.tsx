"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import {
  AlertCircle,
  ArrowLeft,
  BadgeInfo,
  CheckCircle2,
  Clock3,
  History,
  Package,
  PencilLine,
  Play,
  RotateCw,
  Save,
  Shield,
} from 'lucide-react';
import {
  applyAssumptionsPacks,
  createAssumptionsOverrides,
  createComputeRuns,
  getAssumptionsOverrides,
  getAssumptionsPacks,
  getAssumptionsSets,
} from '@/lib/api-client';
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

type AssumptionPack = {
  packId: string;
  name: string;
  category: string;
  fieldCount: number;
};

type AssumptionOverride = {
  overrideId: string;
  fieldId: string;
  originalValue: number;
  overrideValue: number;
  reason: string;
  actor: string;
  createdAt: string;
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

type OverrideDraft = {
  value: string;
  reason: string;
  evidenceRef: string;
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

function parseStrictNumericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePackFamily(value: string): AssumptionFamilyKey | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  switch (normalized) {
    case 'demand':
    case 'cost':
    case 'funding':
    case 'working-capital':
      return normalized;
    case 'workingcapital':
      return 'working-capital';
    default:
      return null;
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSignedDelta(value: number) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value}`;
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
  const [availablePacks, setAvailablePacks] = useState<AssumptionPack[]>([]);
  const [overrideLog, setOverrideLog] = useState<AssumptionOverride[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<OverrideDraft>({
    value: '',
    reason: '',
    evidenceRef: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingPackId, setIsApplyingPackId] = useState<string | null>(null);
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'warning' | 'error' | 'success'; text: string } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

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

  const familyPacks = useMemo(() => availablePacks.filter((pack) => normalizePackFamily(pack.category) === family), [availablePacks, family]);
  const visiblePacks = useMemo(() => {
    if (familyPacks.length > 0) {
      return familyPacks;
    }
    return availablePacks;
  }, [availablePacks, familyPacks]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId],
  );
  const selectedOverride = useMemo(
    () => overrideLog.find((entry) => entry.fieldId === selectedRowId) || null,
    [overrideLog, selectedRowId],
  );
  const activeSetId = isUuid(setInfo.setId) ? setInfo.setId : null;

  const confidenceTone = avgConfidence >= 80
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : avgConfidence >= 60
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const latestOverride = overrideLog[0] || null;
  const packCount = visiblePacks.length;
  const overrideCount = overrideLog.length;

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
        setSelectedRowId(null);
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
      setSelectedRowId((current) => {
        if (current && nextRows.some((row) => row.id === current)) {
          return current;
        }
        return nextRows[0]?.id || null;
      });
    }

    void loadRows().catch((error) => {
      if (!cancelled) {
        setRows([]);
        setSelectedRowId(null);
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
  }, [api, config.shortLabel, ctx.companyId, ctx.scenarioId, family, refreshTick, selectedScenario?.latestVersionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuxiliaryData() {
      if (!ctx.companyId) {
        setAvailablePacks([]);
        setOverrideLog([]);
        return;
      }

      const [packsResult, overridesResult] = await Promise.all([
        getAssumptionsPacks({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId || undefined,
          versionId: selectedScenario?.latestVersionId || undefined,
          limit: 50,
        }),
        getAssumptionsOverrides({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId || undefined,
          versionId: selectedScenario?.latestVersionId || undefined,
          limit: 20,
        }),
      ]);

      if (cancelled) {
        return;
      }

      setAvailablePacks(packsResult.data || []);
      setOverrideLog(overridesResult.data || []);

      const errorMessages = [packsResult.error, overridesResult.error].filter(Boolean);
      if (errorMessages.length > 0) {
        setBanner({
          tone: 'warning',
          text: errorMessages.join(' '),
        });
      }
    }

    void loadAuxiliaryData().catch((error) => {
      if (!cancelled) {
        setAvailablePacks([]);
        setOverrideLog([]);
        setBanner({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Failed to load pack and override metadata.',
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId, refreshTick, selectedScenario?.latestVersionId]);

  useEffect(() => {
    if (!selectedRow) {
      setOverrideDraft({
        value: '',
        reason: '',
        evidenceRef: '',
      });
      return;
    }

    setOverrideDraft({
      value: selectedRow.current,
      reason: '',
      evidenceRef: '',
    });
  }, [selectedRow]);

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

    const draftRow: AssumptionRow = {
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
    };

    setRows((currentRows) => [...currentRows, draftRow]);
    setSelectedRowId(draftRow.id);
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
      setRefreshTick((value) => value + 1);
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

  const handleRefreshSurface = useCallback(() => {
    setBanner(null);
    setRefreshTick((value) => value + 1);
  }, []);

  const handleApplyPack = useCallback(async (pack: AssumptionPack) => {
    if (isDirty) {
      setBanner({
        tone: 'warning',
        text: 'Save or refresh the draft edits before applying a pack so the live surface stays aligned.',
      });
      return;
    }

    if (!activeSetId) {
      setBanner({
        tone: 'warning',
        text: 'Load a live company/scenario context before applying a pack.',
      });
      return;
    }

    setIsApplyingPackId(pack.packId);
    setBanner(null);
    try {
      const result = await applyAssumptionsPacks(pack.packId, { targetSetId: activeSetId });
      if (!result.data?.applied) {
        throw new Error('Pack apply did not return a successful response.');
      }

      setBanner({
        tone: 'success',
        text: `${pack.name} applied to the active assumption set (${result.data.fieldsApplied} fields).`,
      });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setBanner({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Pack apply failed.',
      });
    } finally {
      setIsApplyingPackId(null);
    }
  }, [activeSetId, isDirty]);

  const handleCreateOverride = useCallback(async () => {
    if (!selectedRow) {
      setBanner({
        tone: 'warning',
        text: 'Select a live assumption row before writing an override.',
      });
      return;
    }

    if (!isUuid(selectedRow.id)) {
      setBanner({
        tone: 'warning',
        text: 'Draft rows must be saved before they can receive an override.',
      });
      return;
    }

    if (isDirty) {
      setBanner({
        tone: 'warning',
        text: 'Save or refresh the draft edits before creating an override.',
      });
      return;
    }

    const overrideValue = parseStrictNumericValue(overrideDraft.value);
    if (overrideValue === null) {
      setBanner({
        tone: 'warning',
        text: 'Enter a numeric override value before submitting.',
      });
      return;
    }

    if (overrideDraft.evidenceRef.trim() && !isUuid(overrideDraft.evidenceRef.trim())) {
      setBanner({
        tone: 'warning',
        text: 'Evidence reference must be a UUID when provided.',
      });
      return;
    }

    if (!overrideDraft.reason.trim()) {
      setBanner({
        tone: 'warning',
        text: 'Provide a reason so the override log stays auditable.',
      });
      return;
    }

    setIsCreatingOverride(true);
    setBanner(null);
    try {
      const result = await createAssumptionsOverrides({
        fieldId: selectedRow.id,
        overrideValue,
        reason: overrideDraft.reason.trim(),
        ...(overrideDraft.evidenceRef.trim()
          ? { evidenceRef: overrideDraft.evidenceRef.trim() }
          : {}),
      });

      if (!result.data?.overrideId) {
        throw new Error('Override did not return a response payload.');
      }

      setBanner({
        tone: 'success',
        text: `Override written for ${selectedRow.name}.`,
      });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setBanner({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Override creation failed.',
      });
    } finally {
      setIsCreatingOverride(false);
    }
  }, [isDirty, overrideDraft.evidenceRef, overrideDraft.reason, overrideDraft.value, selectedRow]);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="rounded-[32px] border border-white/10 bg-[#071725] px-8 py-8 text-white shadow-[0_24px_80px_rgba(6,23,41,0.35)]">
        <div className={`h-1.5 w-28 rounded-full bg-gradient-to-r ${config.accentClass}`} />
        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">Canonical Assumptions</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{config.label}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-200">{config.description}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-100/90">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Scenario {selectedScenario?.name || 'not selected'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Active set {isUuid(setInfo.setId) ? `${setInfo.setId.slice(0, 8)}…` : setInfo.setId}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {packCount} live packs
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {overrideCount} overrides
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DataFreshness source={dataSource} lastFetched={lastFetched} />
            <button
              type="button"
              onClick={handleRefreshSurface}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Reload Live
            </button>
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

        <div className="mt-6 flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Active Set</p>
          <div className="mt-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-sm font-semibold text-gray-900">{setInfo.setId}</p>
          </div>
          <p className="mt-2 text-xs text-gray-500">{setInfo.version}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              {setInfo.approvalStatus}
            </span>
            <span className="text-xs text-gray-500">Created {setInfo.lastModified}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Surface Health</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{rows.length}</p>
          <p className="mt-2 text-xs text-gray-500">Live rows available for this family surface.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${confidenceTone}`}>
              {avgConfidence}% {avgConfidence >= 80 ? 'High' : avgConfidence >= 60 ? 'Medium' : 'Low'} confidence
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
              {periodCoverage} periods
            </span>
            {isDirty && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                Draft edits live
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Pack Library</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{packCount}</p>
          <p className="mt-2 text-xs text-gray-500">
            {visiblePacks.length > 0
              ? `Ready-to-apply packs for ${config.shortLabel.toLowerCase()}.`
              : 'No packs are available for this family in the current context.'}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#1E5B9C]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Overrides</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{overrideCount}</p>
          <p className="mt-2 text-xs text-gray-500">
            {latestOverride
              ? `${latestOverride.actor} wrote the latest override ${formatRelativeTime(latestOverride.createdAt)}.`
              : 'No overrides have been written yet.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
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
                .ag-theme-alpine .ag-row.assumption-row-selected .ag-cell {
                  background-color: rgba(224, 242, 254, 0.9) !important;
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
                getRowClass={(params) => (params.data?.id === selectedRowId ? 'assumption-row-selected' : '')}
                onCellValueChanged={onCellValueChanged}
                onRowClicked={(event) => {
                  if (event.data?.id) {
                    setSelectedRowId(event.data.id);
                  }
                }}
                overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading live assumptions...</span>'}
              />
            </div>
          </div>
          {isDirty && (
            <div className="mx-5 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              Unsaved edits are present on this family surface. Save before switching context or running governance workflows.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[#1E5B9C]" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Pack Library</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Apply a live pack to the active assumption set. The routed surface keeps pack application visible and immediate.
            </p>

            <div className="mt-4 space-y-3">
              {visiblePacks.length > 0 ? (
                visiblePacks.map((pack) => {
                  const packFamilyKey = normalizePackFamily(pack.category);
                  const packFamily = packFamilyKey ? ASSUMPTION_FAMILY_CONFIG[packFamilyKey] : null;
                  const isApplying = isApplyingPackId === pack.packId;
                  return (
                    <div key={pack.packId} className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pack.name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {packFamily?.label || pack.category} pack
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                          {pack.fieldCount} fields
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Applies to the active set only. Scope bundle selection is not exposed here.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleApplyPack(pack)}
                          disabled={isDirty || isApplying || !activeSetId}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#10233F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#17315A] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isApplying ? 'Applying…' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  No packs are available for this family in the current planning context.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-xs text-cyan-900">
              <div className="flex items-start gap-2">
                <BadgeInfo className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Pack apply is intentionally constrained to the active assumption set. The API supports an optional scope bundle,
                  but this routed surface does not currently resolve a live scope bundle context to send with the request.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <PencilLine className="h-4 w-4 text-[#1E5B9C]" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Override Composer</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Select a live row, write a numeric override, and keep the rationale attached to the audit trail.
            </p>

            {selectedRow ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Selected row</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{selectedRow.name}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Current</span>
                      <span className="mt-1 block font-semibold text-gray-900">{selectedRow.current}</span>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Unit</span>
                      <span className="mt-1 block font-semibold text-gray-900">{selectedRow.unit || 'n/a'}</span>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Period</span>
                      <span className="mt-1 block font-semibold text-gray-900">{selectedRow.periodId || 'n/a'}</span>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Source</span>
                      <span className="mt-1 block font-semibold text-gray-900">{selectedRow.source}</span>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Override value</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={overrideDraft.value}
                    onChange={(event) => setOverrideDraft((current) => ({ ...current, value: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#1E5B9C]"
                    placeholder="Enter a numeric value"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Reason</span>
                  <textarea
                    value={overrideDraft.reason}
                    onChange={(event) => setOverrideDraft((current) => ({ ...current, reason: event.target.value }))}
                    className="mt-2 min-h-[96px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#1E5B9C]"
                    placeholder="Explain why the live value should differ from the pack"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Evidence ref</span>
                  <input
                    type="text"
                    value={overrideDraft.evidenceRef}
                    onChange={(event) => setOverrideDraft((current) => ({ ...current, evidenceRef: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#1E5B9C]"
                    placeholder="Optional UUID for supporting evidence"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCreateOverride}
                  disabled={isCreatingOverride}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17315A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingOverride ? 'Writing override…' : 'Write override'}
                </button>

                {!isUuid(selectedRow.id) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    Draft rows must be saved before they can be overridden because the API only accepts field binding UUIDs.
                  </div>
                )}

                {selectedOverride && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">Latest override on this row</p>
                    <p className="mt-1">
                      {formatSignedDelta(selectedOverride.originalValue)} → {formatSignedDelta(selectedOverride.overrideValue)} by {selectedOverride.actor} {formatRelativeTime(selectedOverride.createdAt)}.
                    </p>
                    {selectedOverride.reason && (
                      <p className="mt-1 text-slate-600">{selectedOverride.reason}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                Select a live row in the grid to compose an override. Draft rows do not have binding UUIDs yet.
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#1E5B9C]" />
                <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Recent overrides</h4>
              </div>
              <div className="mt-3 space-y-3">
                {overrideLog.length > 0 ? (
                  overrideLog.slice(0, 4).map((entry) => (
                    <div key={entry.overrideId} className="rounded-2xl border border-gray-200 bg-slate-50 p-3 text-xs text-gray-600">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.fieldId}</p>
                          <p className="mt-1">
                            {formatSignedDelta(entry.originalValue)} → {formatSignedDelta(entry.overrideValue)}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-gray-500">{entry.reason || 'No rationale captured.'}</p>
                      <p className="mt-1 text-gray-400">Actor: {entry.actor}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                    No override history is available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
