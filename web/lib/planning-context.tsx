"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  getContextCompanies,
  getContextScenarios,
  getContextPlanningPeriods,
} from "@/lib/api-client";

/* ══════════════════════════════════════════════════════════════════════════
   PLANNING CONTEXT — Shared state for Company / Scenario / Period
   Wired to real API data from the BMA3 context endpoints.
   Selected IDs are UUIDs from the database; no hardcoded string IDs.
   ══════════════════════════════════════════════════════════════════════ */

// ── Data shapes returned by API ────────────────────────────────────────────

export interface Company {
  companyId: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface Scenario {
  scenarioId: string;
  name: string;
  status: string;
  createdAt: string;
  latestVersionId: string;
}

export interface PlanningPeriod {
  periodId: string;
  label: string;
  startDate: string;
  endDate: string;
  granularity: string;
}

// ── Context value shape ────────────────────────────────────────────────────

interface PlanningContextValue {
  // Lists for dropdowns
  companies: Company[];
  scenarios: Scenario[];
  periods: PlanningPeriod[];

  // Selected IDs (UUIDs from DB)
  companyId: string | null;
  scenarioId: string | null;
  periodStart: string | null;
  periodEnd: string | null;

  // Derived labels for display
  companyName: string;
  scenarioName: string;
  periodLabel: string;

  // Setters
  setCompanyId: (id: string) => void;
  setScenarioId: (id: string) => void;
  setPeriodRange: (start: string, end: string) => void;

  // Loading / error states
  loadingCompanies: boolean;
  loadingScenarios: boolean;
  loadingPeriods: boolean;
  error: string | null;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

// ── localStorage persistence helpers ──────────────────────────────────────

const STORAGE_KEY = 'bma3_planning_ctx_v2';

interface PersistedState {
  companyId: string | null;
  scenarioId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') return { companyId: null, scenarioId: null, periodStart: null, periodEnd: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { companyId: null, scenarioId: null, periodStart: null, periodEnd: null };
}

function savePersistedState(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Provider ──────────────────────────────────────────────────────────────

export function PlanningContextProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [periods, setPeriods] = useState<PlanningPeriod[]>([]);

  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [scenarioId, setScenarioIdState] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);

  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    const saved = loadPersistedState();
    if (saved.companyId) setCompanyIdState(saved.companyId);
    if (saved.scenarioId) setScenarioIdState(saved.scenarioId);
    if (saved.periodStart) setPeriodStart(saved.periodStart);
    if (saved.periodEnd) setPeriodEnd(saved.periodEnd);
    setHydrated(true);
  }, []);

  // Persist whenever selections change
  useEffect(() => {
    if (hydrated) {
      savePersistedState({ companyId, scenarioId, periodStart, periodEnd });
    }
  }, [hydrated, companyId, scenarioId, periodStart, periodEnd]);

  // Fetch companies on mount
  useEffect(() => {
    setLoadingCompanies(true);
    setError(null);
    getContextCompanies({ status: 'active', limit: 100 })
      .then((result) => {
        if (result.data) {
          setCompanies(result.data);
          // Auto-select first company if nothing is persisted
          if (!companyId && result.data.length > 0) {
            setCompanyIdState(result.data[0].companyId);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load companies');
      })
      .finally(() => setLoadingCompanies(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch scenarios when company changes
  useEffect(() => {
    if (!companyId) {
      setScenarios([]);
      return;
    }
    setLoadingScenarios(true);
    getContextScenarios({ companyId, limit: 100 })
      .then((result) => {
        if (result.data) {
          setScenarios(result.data);
          // Auto-select first active/draft scenario if nothing persisted
          if (!scenarioId || !result.data.find(s => s.scenarioId === scenarioId)) {
            const first = result.data.find(s => s.status === 'active' || s.status === 'draft') ?? result.data[0];
            if (first) setScenarioIdState(first.scenarioId);
            else setScenarioIdState(null);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      })
      .finally(() => setLoadingScenarios(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Fetch planning periods when scenario changes
  useEffect(() => {
    if (!companyId || !scenarioId) {
      setPeriods([]);
      return;
    }
    setLoadingPeriods(true);
    getContextPlanningPeriods({ companyId, limit: 50 })
      .then((result) => {
        if (result.data) {
          setPeriods(result.data);
          // Auto-select first period range if nothing persisted
          if (!periodStart && result.data.length > 0) {
            const first = result.data[0];
            const last = result.data[result.data.length - 1];
            setPeriodStart(first.periodId);
            setPeriodEnd(last.periodId);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load planning periods');
      })
      .finally(() => setLoadingPeriods(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, scenarioId]);

  // ── Derived labels ─────────────────────────────────────────────────────

  const companyName =
    companies.find(c => c.companyId === companyId)?.name ?? companyId ?? '—';
  const scenarioName =
    scenarios.find(s => s.scenarioId === scenarioId)?.name ?? scenarioId ?? '—';

  const startPeriod = periods.find(p => p.periodId === periodStart);
  const endPeriod = periods.find(p => p.periodId === periodEnd);
  const periodLabel =
    startPeriod && endPeriod
      ? startPeriod.periodId === endPeriod.periodId
        ? startPeriod.label
        : `${startPeriod.label} – ${endPeriod.label}`
      : startPeriod?.label ?? '—';

  // ── Setters ────────────────────────────────────────────────────────────

  const setCompanyId = (id: string) => {
    setCompanyIdState(id);
    // Reset downstream selections when company changes
    setScenarioIdState(null);
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const setScenarioId = (id: string) => {
    setScenarioIdState(id);
    // Reset period range when scenario changes
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const setPeriodRange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const value: PlanningContextValue = {
    companies,
    scenarios,
    periods,
    companyId,
    scenarioId,
    periodStart,
    periodEnd,
    companyName,
    scenarioName,
    periodLabel,
    setCompanyId,
    setScenarioId,
    setPeriodRange,
    loadingCompanies,
    loadingScenarios,
    loadingPeriods,
    error,
  };

  return (
    <PlanningContext.Provider value={value}>
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanningContext(): PlanningContextValue {
  const ctx = useContext(PlanningContext);
  if (!ctx) {
    throw new Error('usePlanningContext must be used within a PlanningContextProvider');
  }
  return ctx;
}
