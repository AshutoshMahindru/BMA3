"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   PLANNING CONTEXT — Shared state for Scope / Time Period / Scenario
   Every dashboard screen reads from this instead of hardcoding headers.
   Persisted in localStorage so refreshes retain selections.
   ══════════════════════════════════════════════════════════════════════ */

export type Scope = 'portfolio' | 'uae' | 'dubai' | 'jlt' | 'jlt-north';
export type TimePeriod = 'monthly' | 'quarterly' | 'annual' | 'multi-year';
export type ScenarioKey = 'base' | 'bull' | 'bear' | 'stress';

interface PlanningState {
  scope: Scope;
  scopeLabel: string;
  timePeriod: TimePeriod;
  timePeriodLabel: string;
  scenario: ScenarioKey;
  scenarioLabel: string;
  assumptionSetVersion: string;
  lastComputed: string | null;
}

interface PlanningContextValue extends PlanningState {
  setScope: (s: Scope) => void;
  setTimePeriod: (t: TimePeriod) => void;
  setScenario: (s: ScenarioKey) => void;
  markComputed: () => void;
}

const scopeLabels: Record<Scope, string> = {
  portfolio: 'UAE Portfolio',
  uae: 'UAE',
  dubai: 'Dubai',
  jlt: 'JLT Cluster',
  'jlt-north': 'JLT-North Kitchen',
};

const timePeriodLabels: Record<TimePeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: '2025 Annual',
  'multi-year': '2025–2027 (3 Year)',
};

const scenarioLabels: Record<ScenarioKey, string> = {
  base: 'Base Case',
  bull: 'Bull Case',
  bear: 'Bear Case',
  stress: 'Stress Test',
};

const defaults: PlanningState = {
  scope: 'uae',
  scopeLabel: 'UAE Portfolio',
  timePeriod: 'annual',
  timePeriodLabel: '2025 Annual',
  scenario: 'base',
  scenarioLabel: 'Base Case',
  assumptionSetVersion: 'AS-2025-03 v4 (Draft)',
  lastComputed: null,
};

const PlanningContext = createContext<PlanningContextValue | null>(null);

function loadState(): PlanningState {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem('fpe_planning_ctx');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaults;
}

function saveState(s: PlanningState) {
  try { localStorage.setItem('fpe_planning_ctx', JSON.stringify(s)); } catch { /* ignore */ }
}

export function PlanningContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlanningState>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const setScope = (s: Scope) => setState(prev => ({ ...prev, scope: s, scopeLabel: scopeLabels[s] }));
  const setTimePeriod = (t: TimePeriod) => setState(prev => ({ ...prev, timePeriod: t, timePeriodLabel: timePeriodLabels[t] }));
  const setScenario = (s: ScenarioKey) => setState(prev => ({ ...prev, scenario: s, scenarioLabel: scenarioLabels[s] }));
  const markComputed = () => setState(prev => ({ ...prev, lastComputed: new Date().toISOString() }));

  return (
    <PlanningContext.Provider value={{ ...state, setScope, setTimePeriod, setScenario, markComputed }}>
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanningContext() {
  const ctx = useContext(PlanningContext);
  if (!ctx) {
    // Return defaults when outside provider (shouldn't happen in normal use)
    return {
      ...defaults,
      setScope: () => {},
      setTimePeriod: () => {},
      setScenario: () => {},
      markComputed: () => {},
    } as PlanningContextValue;
  }
  return ctx;
}

export { scopeLabels, timePeriodLabels, scenarioLabels };
