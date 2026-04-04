"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Sparkles, Wand2 } from 'lucide-react';
import {
  createComputeRuns,
  createContextScenarios,
  createContextVersions,
  getContextCompanies,
  getContextScenarios,
  publishContextVersions,
} from '@/lib/api-client';

type Company = {
  companyId: string;
  name: string;
};

type Scenario = {
  scenarioId: string;
  name: string;
};

type WizardStepKey = 'start' | 'context' | 'scope' | 'decisions' | 'assumptions' | 'compute' | 'review' | 'publish';

const WIZARD_STEPS: Array<{
  key: WizardStepKey;
  label: string;
  description: string;
  actionHref?: string;
}> = [
  { key: 'start', label: 'Start', description: 'Create the draft scenario shell and a working version.' },
  { key: 'context', label: 'Context', description: 'Confirm company context and baseline scenario inheritance.', actionHref: '/dashboard/analysis/compare' },
  { key: 'scope', label: 'Scope', description: 'Move into the live dimension editors to refine planning scope.', actionHref: '/dashboard/scope/formats' },
  { key: 'decisions', label: 'Decisions', description: 'Capture market, product, marketing, and operations decisions.', actionHref: '/dashboard/decisions' },
  { key: 'assumptions', label: 'Assumptions', description: 'Refine the live assumptions tables and confidence inputs.', actionHref: '/dashboard/assumptions/demand' },
  { key: 'compute', label: 'Compute', description: 'Trigger the compute engine on the newly created version.' },
  { key: 'review', label: 'Review', description: 'Inspect comparison outputs before governance actions.', actionHref: '/dashboard/analysis/compare' },
  { key: 'publish', label: 'Publish', description: 'Publish the version once the working draft is ready.', actionHref: '/dashboard/governance' },
];

function buildHref(step: WizardStepKey, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  const search = query.toString();
  return `/wizard/scenario/${step}${search ? `?${search}` : ''}`;
}

export default function ScenarioWizardPage({ params }: { params: { step: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams || new URLSearchParams();
  const currentStep = (WIZARD_STEPS.find((step) => step.key === params.step)?.key || 'start') as WizardStepKey;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [companyId, setCompanyId] = useState(safeSearchParams.get('companyId') || '');
  const [scenarioName, setScenarioName] = useState(safeSearchParams.get('scenarioName') || '');
  const [description, setDescription] = useState(safeSearchParams.get('description') || '');
  const [versionLabel, setVersionLabel] = useState(safeSearchParams.get('versionLabel') || 'Working Draft v1');
  const [baseScenarioId, setBaseScenarioId] = useState(safeSearchParams.get('baseScenarioId') || '');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const scenarioId = safeSearchParams.get('scenarioId') || '';
  const versionId = safeSearchParams.get('versionId') || '';

  useEffect(() => {
    let cancelled = false;

    getContextCompanies({ status: 'active', limit: 50 }).then((result) => {
      if (cancelled || !result.data) return;
      setCompanies(result.data.map((company) => ({ companyId: company.companyId, name: company.name })));
      if (!companyId && result.data.length > 0) {
        setCompanyId(result.data[0].companyId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setScenarios([]);
      return;
    }

    let cancelled = false;
    getContextScenarios({ companyId, limit: 50 }).then((result) => {
      if (cancelled || !result.data) return;
      setScenarios(result.data.map((scenario) => ({ scenarioId: scenario.scenarioId, name: scenario.name })));
    });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const queryState = useMemo(
    () => ({
      companyId,
      scenarioId,
      versionId,
      scenarioName,
      versionLabel,
      ...(baseScenarioId ? { baseScenarioId } : {}),
      ...(description ? { description } : {}),
    }),
    [baseScenarioId, companyId, description, scenarioId, scenarioName, versionId, versionLabel],
  );

  async function handleCreateScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId || !scenarioName.trim() || !versionLabel.trim()) {
      setBanner({ tone: 'warning', text: 'Choose a company, scenario name, and version label before starting the wizard.' });
      return;
    }

    setBusy(true);
    setBanner(null);

    try {
      const scenarioResult = await createContextScenarios({
        companyId,
        name: scenarioName.trim(),
        description: description.trim() || undefined,
        baseScenarioId: baseScenarioId || undefined,
      });

      const createdScenarioId = scenarioResult.data?.scenarioId;
      if (!createdScenarioId) {
        throw new Error(scenarioResult.error || 'Scenario creation did not return an ID');
      }

      const versionResult = await createContextVersions({
        companyId,
        scenarioId: createdScenarioId,
        label: versionLabel.trim(),
      });

      const createdVersionId = versionResult.data?.versionId;
      if (!createdVersionId) {
        throw new Error(versionResult.error || 'Version creation did not return an ID');
      }

      router.push(
        buildHref('scope', {
          companyId,
          scenarioId: createdScenarioId,
          versionId: createdVersionId,
          scenarioName: scenarioName.trim(),
          versionLabel: versionLabel.trim(),
          ...(baseScenarioId ? { baseScenarioId } : {}),
          ...(description ? { description } : {}),
        }),
      );
    } catch (error) {
      setBanner({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to start scenario wizard.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRunCompute() {
    if (!companyId || !scenarioId || !versionId) {
      setBanner({ tone: 'warning', text: 'Create the scenario shell first so compute has a valid company, scenario, and version.' });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const result = await createComputeRuns({ companyId, scenarioId, versionId });
      if (!result.data?.computeRunId) {
        throw new Error(result.error || 'Compute run could not be created');
      }
      setBanner({ tone: 'success', text: `Compute run ${result.data.computeRunId} was started for the working draft.` });
    } catch (error) {
      setBanner({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to run compute.' });
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishVersion() {
    if (!versionId) {
      setBanner({ tone: 'warning', text: 'No version is available yet. Start the wizard and create a draft first.' });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const result = await publishContextVersions(versionId, { reason: 'Published from Scenario Wizard' });
      if (!result.data?.versionId) {
        throw new Error(result.error || 'Publish failed');
      }
      setBanner({ tone: 'success', text: `Version ${result.data.versionId} was published successfully.` });
    } catch (error) {
      setBanner({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to publish version.' });
    } finally {
      setBusy(false);
    }
  }

  const currentStepMeta = WIZARD_STEPS.find((step) => step.key === currentStep) || WIZARD_STEPS[0];

  return (
    <div className="min-h-screen bg-[#F3F5F8] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[28px] bg-[#10233F] px-8 py-8 text-white shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">Scenario Wizard</p>
          <div className="mt-3 flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Guided scenario orchestration across the live planning stack</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200">
                This wizard uses the existing context, scope, assumptions, compute, and governance APIs. It does not create unpublished side state — every step stays on the canonical routes.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
              <p className="font-semibold">{scenarioName || 'Scenario draft not started yet'}</p>
              <p className="mt-1 text-slate-200">{versionLabel || 'Working Draft v1'}</p>
              <p className="mt-1 text-slate-300 text-xs">{companyId || 'Pick a company to begin'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <aside className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-900">Wizard Map</h2>
            <div className="mt-5 space-y-3">
              {WIZARD_STEPS.map((step, index) => {
                const href = buildHref(step.key, queryState);
                const isCurrent = step.key === currentStep;
                return (
                  <Link
                    key={step.key}
                    href={href}
                    className={`block rounded-2xl border px-4 py-3 transition ${
                      isCurrent
                        ? 'border-[#1E5B9C] bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-[#1E5B9C]/30 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Step {index + 1}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{step.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{step.description}</p>
                      </div>
                      {isCurrent ? <CheckCircle2 className="w-5 h-5 text-[#1E5B9C]" /> : <Wand2 className="w-4 h-4 text-gray-300" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>

          <main className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E5B9C]">Current Step</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">{currentStepMeta.label}</h2>
                <p className="mt-2 text-sm text-gray-500 max-w-2xl">{currentStepMeta.description}</p>
              </div>
              {currentStepMeta.actionHref && (
                <Link
                  href={currentStepMeta.actionHref}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]"
                >
                  Open Live Surface
                </Link>
              )}
            </div>

            {banner && (
              <div className={`mt-6 rounded-2xl p-4 text-sm ${
                banner.tone === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : banner.tone === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {banner.text}
              </div>
            )}

            <div className="mt-6">
              {(currentStep === 'start' || currentStep === 'context') && (
                <form onSubmit={handleCreateScenario} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Company</span>
                      <select
                        value={companyId}
                        onChange={(event) => setCompanyId(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="">Select company</option>
                        {companies.map((company) => (
                          <option key={company.companyId} value={company.companyId}>{company.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Base Scenario</span>
                      <select
                        value={baseScenarioId}
                        onChange={(event) => setBaseScenarioId(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="">Start from scratch</option>
                        {scenarios.map((scenario) => (
                          <option key={scenario.scenarioId} value={scenario.scenarioId}>{scenario.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Scenario Name</span>
                      <input
                        value={scenarioName}
                        onChange={(event) => setScenarioName(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                        placeholder="FY27 Growth Plan"
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Version Label</span>
                      <input
                        value={versionLabel}
                        onChange={(event) => setVersionLabel(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                        placeholder="Working Draft v1"
                      />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="font-semibold text-gray-700">Description</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 min-h-[120px]"
                      placeholder="Summarize the planning objective, horizon, or strategic angle."
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#10233F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#17315A] disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    {busy ? 'Starting wizard…' : 'Create Draft and Continue'}
                  </button>
                </form>
              )}

              {currentStep === 'scope' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Use the live scope editors to refine the reusable dimension nodes for this scenario. The editor pages read the real `/scope/*` and `/reference/*` routes.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/scope/formats" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Formats</Link>
                    <Link href="/dashboard/scope/categories" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Categories</Link>
                    <Link href={buildHref('decisions', queryState)} className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A]">Continue to Decisions</Link>
                  </div>
                </div>
              )}

              {currentStep === 'decisions' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Capture the market, product, marketing, and operating choices that shape the scenario. The live decisions surface is already wired to the canonical API family.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/decisions" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Decisions</Link>
                    <Link href={buildHref('assumptions', queryState)} className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A]">Continue to Assumptions</Link>
                  </div>
                </div>
              )}

              {currentStep === 'assumptions' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Adjust demand, cost, funding, and working-capital assumptions on the live dashboard page. This keeps the wizard draft aligned with the real tables and compute trigger flow.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/assumptions" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Assumptions Overview</Link>
                    <Link href={buildHref('compute', queryState)} className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A]">Continue to Compute</Link>
                  </div>
                </div>
              )}

              {currentStep === 'compute' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Once the draft is shaped, trigger a compute run against the current company, scenario, and version. The compute run stays on the same canonical API the dashboard already uses.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleRunCompute}
                      disabled={busy}
                      className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A] disabled:opacity-60"
                    >
                      {busy ? 'Running compute…' : 'Run Compute'}
                    </button>
                    <Link href={buildHref('review', queryState)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Continue to Review</Link>
                  </div>
                </div>
              )}

              {currentStep === 'review' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Review the draft against the canonical scenario comparison console before publishing. This is the best point to validate deltas and surface gaps to stakeholders.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/analysis/compare" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Scenario Comparison</Link>
                    <Link href={buildHref('publish', queryState)} className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A]">Continue to Publish</Link>
                  </div>
                </div>
              )}

              {currentStep === 'publish' && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">
                    Publish the version once the draft is ready. This step uses the live publish endpoint and then hands back to the governance dashboard for the broader approval flow.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePublishVersion}
                      disabled={busy}
                      className="rounded-xl bg-[#10233F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17315A] disabled:opacity-60"
                    >
                      {busy ? 'Publishing…' : 'Publish Version'}
                    </button>
                    <Link href="/dashboard/governance" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]">Open Governance</Link>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
