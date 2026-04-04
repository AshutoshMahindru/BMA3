"use client";

import { useEffect, useState } from 'react';
import { Clock, GitBranch, ShieldCheck } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getGovernanceApprovalWorkflows, getGovernanceVersions } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { asArray, asRecord, formatDate, governanceTone, titleCase, toText } from '@/lib/phase5-utils';

interface GovernanceVersion {
  versionId: string;
  label: string;
  scenarioId: string;
  governanceState: string;
  approvedAt: string;
  publishedAt: string;
}

interface ApprovalWorkflow {
  workflowId: string;
  versionId: string;
  status: string;
  submittedAt: string;
  steps: Array<{
    stepName: string;
    status: string;
    actedAt: string;
    comment: string;
  }>;
}

function normalizeVersions(raw: unknown): GovernanceVersion[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      versionId: toText(row.versionId, ''),
      label: toText(row.label, 'Unnamed version'),
      scenarioId: toText(row.scenarioId, ''),
      governanceState: toText(row.governanceState, 'draft'),
      approvedAt: toText(row.approvedAt, ''),
      publishedAt: toText(row.publishedAt, ''),
    };
  }).filter((item) => item.versionId);
}

function normalizeWorkflows(raw: unknown): ApprovalWorkflow[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      workflowId: toText(row.workflowId, ''),
      versionId: toText(row.versionId, ''),
      status: toText(row.status, 'draft'),
      submittedAt: toText(row.submittedAt, ''),
      steps: asArray(row.steps).map((step) => {
        const value = asRecord(step);
        return {
          stepName: toText(value.stepName, 'Step'),
          status: toText(value.status, 'pending'),
          actedAt: toText(value.actedAt, ''),
          comment: toText(value.comment, ''),
        };
      }),
    };
  }).filter((item) => item.workflowId);
}

export default function VersionManager() {
  const ctx = usePlanningContext();
  const [versions, setVersions] = useState<GovernanceVersion[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setVersions([]);
      setWorkflows([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getGovernanceVersions({ companyId: ctx.companyId, limit: 20 }),
      getGovernanceApprovalWorkflows({ companyId: ctx.companyId, limit: 20 }),
    ])
      .then(([versionsResult, workflowsResult]) => {
        if (cancelled) return;
        setVersions(normalizeVersions(versionsResult.data));
        setWorkflows(normalizeWorkflows(workflowsResult.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load versions');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId]);

  const scenarioNameMap = ctx.scenarios.reduce<Record<string, string>>((acc, scenario) => {
    acc[scenario.scenarioId] = scenario.name;
    return acc;
  }, {});
  const workflowMap = workflows.reduce<Record<string, ApprovalWorkflow[]>>((acc, workflow) => {
    const current = acc[workflow.versionId] || [];
    current.push(workflow);
    acc[workflow.versionId] = current;
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[#1E5B9C]" />
          Plan Version Manager
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — governed version history
          <DataFreshness source={loading ? 'loading' : versions.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load version history.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Version history could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && versions.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Tracked Versions', value: String(versions.length), sub: 'Governed plan revisions' },
                { label: 'Under Review', value: String(versions.filter((item) => item.governanceState.toLowerCase().includes('review')).length), sub: 'Awaiting action' },
                { label: 'Approved', value: String(versions.filter((item) => item.governanceState.toLowerCase() === 'approved').length), sub: 'Ready for publication' },
                { label: 'Published', value: String(versions.filter((item) => item.governanceState.toLowerCase() === 'published').length), sub: 'Live stakeholder views' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Version History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Version', 'Scenario', 'Governance State', 'Approved', 'Published', 'Workflow Count', 'Version ID'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {versions.map((version, index) => (
                      <tr key={version.versionId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-bold text-[#1B2A4A]">{version.label}</td>
                        <td className="px-4 py-3 text-gray-600">{scenarioNameMap[version.scenarioId] || version.scenarioId}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${governanceTone(version.governanceState)}`}>
                            {titleCase(version.governanceState)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(version.approvedAt)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(version.publishedAt)}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{workflowMap[version.versionId]?.length || 0}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{version.versionId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1E5B9C]" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Workflow Step Ledger</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {workflows.length === 0 && (
                  <div className="px-5 py-8 text-sm text-gray-400">No workflow steps have been captured yet.</div>
                )}
                {workflows.map((workflow) => (
                  <div key={workflow.workflowId} className="px-5 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {versions.find((item) => item.versionId === workflow.versionId)?.label || workflow.versionId}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Submitted {formatDate(workflow.submittedAt)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${governanceTone(workflow.status)}`}>
                        {titleCase(workflow.status)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {workflow.steps.map((step, index) => (
                        <div key={`${workflow.workflowId}-${index}`} className="flex items-center gap-3 text-xs">
                          <Clock className="w-3.5 h-3.5 text-gray-300" />
                          <span className="font-semibold text-gray-700">{step.stepName}</span>
                          <span className="text-gray-400">{titleCase(step.status)}</span>
                          <span className="text-gray-400">{formatDate(step.actedAt)}</span>
                          {step.comment && <span className="text-gray-500">{step.comment}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
