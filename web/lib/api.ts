/* ══════════════════════════════════════════════════════════════════════════
   API DATA LAYER — Try-first, fallback-silently pattern
   - Attempts to fetch from the Express backend on localhost:4000
   - If the server is offline or returns an error, returns null
   - Callers use: const data = await fetchAPI('/pnl') ?? fallbackData;
   ══════════════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:4000/api/v1';
const TENANT_ID = 'tttttttt-0000-0000-0000-000000000001';
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

export const fetchScenarios = (companyId?: string) =>
  fetchAPI(`/scenarios${companyId ? `?company_id=${companyId}` : ''}`);

export const fetchDemandDrivers = (scenarioId: string) =>
  fetchAPI(`/demand-drivers?scenario_id=${scenarioId}`);

export const fetchPnl = (scenarioId?: string) =>
  fetchAPI(`/financial-projections/pnl${scenarioId ? `?scenario_id=${scenarioId}` : ''}`);

export const fetchKpiProjections = () =>
  fetchAPI('/kpi-projections');

export const fetchUnitEconomics = () =>
  fetchAPI('/unit-economics');

export const fetchDriverExplainability = (scenarioId: string) =>
  fetchAPI(`/driver-explainability?scenario_id=${scenarioId}`);

export const upsertDemandDrivers = (drivers: any[]) =>
  fetchAPI('/demand-drivers/upsert', {
    method: 'POST',
    body: JSON.stringify(drivers),
  });

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

export const checkHealth = () =>
  fetchAPI<{ status: string; message: string }>('/health');
