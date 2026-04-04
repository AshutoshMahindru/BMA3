/* ══════════════════════════════════════════════════════════════════════════
   LEGACY API DATA LAYER — fallback-first helper for non-core screens only.
   Core finance views should use web/lib/api-client.ts so they are wired to
   canonical contracts instead of silent fallback behavior.
   ══════════════════════════════════════════════════════════════════════ */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const TIMEOUT_MS = 3000;

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Core fetch wrapper — never throws, always returns { data, error }
 */
export async function fetchAPI<T = any>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        ...(options?.headers || {}),
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body?.error?.message || `HTTP ${res.status}` };
    }

    const json = await res.json();
    return { data: (json.data ?? json) as T, error: null };
  } catch (err: any) {
    clearTimeout(timer);
    // Silent fallback — API unreachable is expected during local dev
    return { data: null, error: err.name === 'AbortError' ? 'Timeout' : (err.message || 'Network error') };
  }
}

/* ── Typed endpoint helpers ──────────────────────────────────────────── */

export const fetchDemandDrivers = (scenarioId: string) =>
  fetchAPI(`/demand-drivers?scenario_id=${scenarioId}`);

export const fetchCapexPlans = (scenarioId?: string) =>
  fetchAPI(`/capex-plans${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const fetchPricePlans = (scenarioId?: string) =>
  fetchAPI(`/price-plans${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const upsertDemandDrivers = (drivers: any[]) =>
  fetchAPI('/demand-drivers/upsert', {
    method: 'POST',
    body: JSON.stringify(drivers),
  });

export const upsertPricePlans = (plans: any) =>
  fetchAPI('/price-plans', {
    method: 'POST',
    body: JSON.stringify(plans),
  });

export const fetchLaborModels = (scenarioId?: string) =>
  fetchAPI(`/labor-models${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const upsertLaborModels = (models: any) =>
  fetchAPI('/labor-models', {
    method: 'POST',
    body: JSON.stringify(models),
  });

export const fetchMarketingPlans = (scenarioId?: string) =>
  fetchAPI(`/marketing-plans${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const upsertMarketingPlans = (plans: any) =>
  fetchAPI('/marketing-plans', {
    method: 'POST',
    body: JSON.stringify(plans),
  });

export const upsertCapexPlans = (plans: any) =>
  fetchAPI('/capex-plans', {
    method: 'POST',
    body: JSON.stringify(plans),
  });

export const fetchWorkingCapitalPolicies = (scenarioId?: string) =>
  fetchAPI(`/working-capital-policies${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const upsertWorkingCapitalPolicies = (policies: any) =>
  fetchAPI('/working-capital-policies', {
    method: 'POST',
    body: JSON.stringify(policies),
  });

export const upsertUnitCostProfiles = (profiles: any) =>
  fetchAPI('/unit-cost-profiles', {
    method: 'POST',
    body: JSON.stringify(profiles),
  });

export const fetchFundingParameters = (scenarioId?: string) =>
  fetchAPI(`/funding-parameters${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const upsertFundingParameters = (params: any) =>
  fetchAPI('/funding-parameters', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const fetchRolloutPlans = (scenarioId?: string) =>
  fetchAPI(`/rollout-plans${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const triggerCompute = (payload: {
  scenario_id: string;
  assumption_set_id: string;
  period_range_start?: string;
  period_range_end?: string;
}) =>
  fetchAPI('/financial-projections/compute', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const pollJob = (jobId: string) =>
  fetchAPI(`/financial-projections/jobs/${jobId}`);

export const fetchRiskScenarios = (scenarioId: string) =>
  fetchAPI(`/risk-scenarios?scenario_id=${scenarioId}`);

export const triggerSimulation = (payload: {
  scenario_id: string;
  simulator_type: string;
  iterations?: number;
  input_params?: any;
}) =>
  fetchAPI('/simulation-runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchSimulationResults = (runId: string) =>
  fetchAPI(`/simulation-runs/${runId}/results`);

export const checkHealth = () =>
  fetchAPI<{ status: string; message: string }>('/health');
