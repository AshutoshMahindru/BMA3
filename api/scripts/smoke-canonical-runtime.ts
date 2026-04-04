const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const API_TOKEN = process.env.API_TOKEN || 'dev-local-token';
const REQUEST_TIMEOUT_MS = 5000;
const RUN_POLL_INTERVAL_MS = Number(process.env.COMPUTE_RUN_POLL_INTERVAL_MS || '500');
const RUN_POLL_TIMEOUT_MS = Number(process.env.COMPUTE_RUN_POLL_TIMEOUT_MS || '30000');

type Envelope<T> = {
  data?: T;
  error?: { code?: string; message?: string };
  status?: string;
  message?: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        ...(init?.headers || {}),
      },
    });

    const payload = (await response.json().catch(() => ({}))) as Envelope<T>;

    if (!response.ok) {
      throw new Error(payload.error?.message || `HTTP ${response.status} for ${path}`);
    }

    return (payload.data ?? payload) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms for ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type ComputeRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

type ComputeRunDetails = {
  computeRunId: string;
  status: ComputeRunStatus;
  stepsTotal: number;
  stepsCompleted: number;
  createdAt?: string;
  completedAt?: string | null;
};

async function waitForComputeRun(runId: string): Promise<ComputeRunDetails> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < RUN_POLL_TIMEOUT_MS) {
    const run = await request<ComputeRunDetails>(`/compute/runs/${encodeURIComponent(runId)}`);

    if (run.status === 'completed') {
      return run;
    }

    if (run.status === 'failed' || run.status === 'cancelled') {
      throw new Error(`Compute run ${runId} ended in status "${run.status}"`);
    }

    await new Promise((resolve) => setTimeout(resolve, RUN_POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for compute run ${runId} after ${RUN_POLL_TIMEOUT_MS}ms`);
}

async function main() {
  const health = await request<{ status: string; message: string }>('/health');
  assert(health.status === 'OK', 'Health check did not return OK');

  const companies = await request<Array<{ companyId: string; name: string }>>('/context/companies?status=active&limit=1');
  assert(companies.length > 0, 'No active companies returned from /context/companies');
  const company = companies[0];

  const scenarios = await request<Array<{ scenarioId: string; name: string; latestVersionId: string }>>(
    `/context/scenarios?companyId=${encodeURIComponent(company.companyId)}&limit=1`,
  );
  assert(scenarios.length > 0, 'No scenarios returned from /context/scenarios');
  const scenario = scenarios[0];
  assert(scenario.latestVersionId, 'Scenario is missing latestVersionId');

  const periods = await request<Array<{ periodId: string; label: string }>>(
    `/context/planning-periods?companyId=${encodeURIComponent(company.companyId)}&limit=3`,
  );
  assert(periods.length > 0, 'No planning periods returned from /context/planning-periods');

  const assumptionSets = await request<Array<{ assumptionSetId: string; name: string; status: string }>>(
    `/assumptions/sets?companyId=${encodeURIComponent(company.companyId)}&scenarioId=${encodeURIComponent(scenario.scenarioId)}&versionId=${encodeURIComponent(scenario.latestVersionId)}&limit=1`,
  );
  assert(assumptionSets.length > 0, 'No assumption sets returned from /assumptions/sets');

  const executiveSummary = await request<{
    revenue: number;
    grossProfit: number;
    ebitda: number;
    netIncome: number;
  }>(
    `/financials/executive-summary?companyId=${encodeURIComponent(company.companyId)}&scenarioId=${encodeURIComponent(scenario.scenarioId)}&versionId=${encodeURIComponent(scenario.latestVersionId)}`,
  );
  assert(Number.isFinite(executiveSummary.revenue), 'Executive summary revenue is not numeric');

  const validation = await request<{ validationId: string; status: string }>(
    '/compute/validations',
    {
      method: 'POST',
      body: JSON.stringify({
        companyId: company.companyId,
        scenarioId: scenario.scenarioId,
        versionId: scenario.latestVersionId,
      }),
    },
  );
  assert(validation.status === 'COMPLETED', 'Compute validation did not complete');

  const run = await request<{ computeRunId: string; status: string }>(
    '/compute/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        companyId: company.companyId,
        scenarioId: scenario.scenarioId,
        versionId: scenario.latestVersionId,
        triggerType: 'manual',
      }),
    },
  );
  assert(['queued', 'completed'].includes(run.status), `Unexpected initial compute run status "${run.status}"`);

  const runDetails = run.status === 'completed'
    ? await request<ComputeRunDetails>(`/compute/runs/${encodeURIComponent(run.computeRunId)}`)
    : await waitForComputeRun(run.computeRunId);

  assert(runDetails.status === 'completed', `Compute run did not complete successfully (status="${runDetails.status}")`);
  assert(runDetails.stepsTotal > 0, 'Compute run recorded no steps');
  assert(runDetails.stepsTotal === runDetails.stepsCompleted, 'Compute run steps are incomplete');

  const steps = await request<Array<{ stepId: string; status: string }>>(
    `/compute/runs/${encodeURIComponent(run.computeRunId)}/steps?limit=25&offset=0`,
  );
  assert(steps.length > 0, 'Compute run returned no step records');
  assert(steps.every((step) => step.status === 'completed'), 'One or more compute run steps did not complete');

  const results = await request<{ computeRunId: string; status: string; outputSummary: Record<string, number>; warnings: string[] }>(
    `/compute/runs/${encodeURIComponent(run.computeRunId)}/results`,
  );
  assert(results.computeRunId === run.computeRunId, 'Compute run results returned the wrong run id');
  assert(results.status === 'completed', 'Compute run results did not report completed status');

  const freshness = await request<{ freshness: string; lastRunId: string | null; staleSurfaces: string[] }>(
    `/compute/freshness?companyId=${encodeURIComponent(company.companyId)}&scenarioId=${encodeURIComponent(scenario.scenarioId)}`,
  );
  assert(freshness.freshness === 'fresh', 'Compute freshness did not report fresh after run completion');
  assert(freshness.lastRunId === run.computeRunId, 'Compute freshness did not report the latest run id');
  assert(Array.isArray(freshness.staleSurfaces), 'Compute freshness did not return staleSurfaces');

  console.log(
    JSON.stringify(
      {
        ok: true,
        company: company.name,
        scenario: scenario.name,
        assumptionSetId: assumptionSets[0].assumptionSetId,
        firstPeriod: periods[0].label,
        revenue: executiveSummary.revenue,
        ebitda: executiveSummary.ebitda,
        computeRunId: run.computeRunId,
        initialStatus: run.status,
        stepsTotal: runDetails.stepsTotal,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`canonical smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
