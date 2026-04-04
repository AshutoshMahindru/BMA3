"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck, User, XCircle } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getGovernanceApprovalWorkflows,
  getGovernanceAuditLog,
  getGovernanceEvents,
  getGovernanceVersions,
} from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import {
  asArray,
  asRecord,
  formatDate,
  formatDateTime,
  governanceTone,
  titleCase,
  toText,
} from '@/lib/phase5-utils';

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
    stepOrder: number;
    stepName: string;
    requiredRole: string;
    status: string;
    actedAt: string;
    comment: string;
  }>;
}

interface GovernanceEvent {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

interface AuditEntry {
  logId: string;
  action: string;
  actor: string;
  entityType: string;
  entityId: string;
  timestamp: string;
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
          stepOrder: Number(value.stepOrder || 0),
          stepName: toText(value.stepName, 'Step'),
          requiredRole: toText(value.requiredRole, 'reviewer'),
          status: toText(value.status, 'pending'),
          actedAt: toText(value.actedAt, ''),
          comment: toText(value.comment, ''),
        };
      }),
    };
  }).filter((item) => item.workflowId);
}

function normalizeEvents(raw: unknown): GovernanceEvent[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      eventId: toText(row.eventId, ''),
      eventType: toText(row.eventType, 'event'),
      entityType: toText(row.entityType, 'version'),
      entityId: toText(row.entityId, ''),
      actor: toText(row.actor, 'system'),
      timestamp: toText(row.timestamp, ''),
      details: asRecord(row.details),
    };
  }).filter((item) => item.eventId);
}

function normalizeAuditLog(raw: unknown): AuditEntry[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      logId: toText(row.logId, ''),
      action: toText(row.action, 'event'),
      actor: toText(row.actor, 'system'),
      entityType: toText(row.entityType, 'version'),
      entityId: toText(row.entityId, ''),
      timestamp: toText(row.timestamp, ''),
    };
  }).filter((item) => item.logId);
}

const WORKFLOW_COLUMNS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function workflowColumnKey(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'submitted' || normalized === 'under_review' || normalized === 'pending') {
    return 'submitted';
  }
  if (normalized === 'approved' || normalized === 'published') {
    return 'approved';
  }
  if (normalized === 'rejected' || normalized === 'archived') {
    return 'rejected';
  }
  return 'draft';
}

export default function GovernanceDashboard() {
  const ctx = usePlanningContext();
  const [versions, setVersions] = useState<GovernanceVersion[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setVersions([]);
      setWorkflows([]);
      setEvents([]);
      setAuditLog([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getGovernanceVersions({ companyId: ctx.companyId, limit: 12 }),
      getGovernanceApprovalWorkflows({ companyId: ctx.companyId, limit: 20 }),
      getGovernanceEvents({ companyId: ctx.companyId, limit: 12 }),
      getGovernanceAuditLog({ companyId: ctx.companyId, limit: 12 }),
    ])
      .then(([versionsResult, workflowsResult, eventsResult, auditResult]) => {
        if (cancelled) return;

        setVersions(normalizeVersions(versionsResult.data));
        setWorkflows(normalizeWorkflows(workflowsResult.data));
        setEvents(normalizeEvents(eventsResult.data));
        setAuditLog(normalizeAuditLog(auditResult.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load governance dashboard');
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

  const versionMap = versions.reduce<Record<string, GovernanceVersion>>((acc, version) => {
    acc[version.versionId] = version;
    return acc;
  }, {});

  const workflowsByColumn = WORKFLOW_COLUMNS.map((column) => ({
    ...column,
    items: workflows.filter((workflow) => workflowColumnKey(workflow.status) === column.key),
  }));

  const pendingApprovals = workflows.filter((workflow) => workflowColumnKey(workflow.status) === 'submitted').length;
  const publishedVersions = versions.filter((version) => version.governanceState.toLowerCase() === 'published').length;
  const approvedVersions = versions.filter((version) => version.governanceState.toLowerCase() === 'approved').length;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1E5B9C]" />
          Planning Governance Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — Approval workflows, audit trail, and publication state
          <DataFreshness source={loading ? 'loading' : versions.length > 0 || workflows.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load governance workflows and audit history.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Governance data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && (versions.length > 0 || workflows.length > 0 || events.length > 0) && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Pending Approvals', value: String(pendingApprovals), sub: 'Submitted workflows', tone: pendingApprovals > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'Approved Versions', value: String(approvedVersions), sub: 'Governance-approved plans', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: 'Published Versions', value: String(publishedVersions), sub: 'Live stakeholder views', tone: 'bg-green-100 text-green-700 border-green-200' },
                { label: 'Audit Events', value: String(auditLog.length), sub: 'Recent immutable events', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.tone}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{card.label}</p>
                  <p className="text-2xl font-extrabold mt-1">{card.value}</p>
                  <p className="text-[11px] mt-1 opacity-80">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Approval Workflow Board</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {workflowsByColumn.map((column) => (
                  <div key={column.key} className="min-w-[240px] flex-1 bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{column.label}</h4>
                      <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">{column.items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {column.items.length === 0 && (
                        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-3 text-[11px] text-gray-400">
                          No workflows in this column.
                        </div>
                      )}
                      {column.items.map((workflow) => {
                        const version = versionMap[workflow.versionId];
                        const currentStep = workflow.steps[workflow.steps.length - 1];
                        return (
                          <div key={workflow.workflowId} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${governanceTone(workflow.status)}`}>
                                {titleCase(workflow.status)}
                              </span>
                              <span className="text-[9px] font-mono text-gray-400">{workflow.workflowId.slice(0, 8)}</span>
                            </div>
                            <p className="text-[11px] font-semibold text-gray-800">{version?.label || 'Unmapped version'}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{workflow.submittedAt ? formatDate(workflow.submittedAt) : 'Not yet submitted'}</p>
                            {currentStep && (
                              <div className="mt-3 text-[10px] text-gray-500">
                                <span className="font-semibold text-gray-700">{currentStep.stepName}</span>
                                {' · '}
                                {titleCase(currentStep.status)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Version Governance State</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {versions.length === 0 && (
                    <div className="px-5 py-8 text-sm text-gray-400">No governed versions are available yet.</div>
                  )}
                  {versions.map((version) => (
                    <div key={version.versionId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{version.label}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            Scenario {version.scenarioId.slice(0, 8)}
                            {version.approvedAt ? ` · Approved ${formatDate(version.approvedAt)}` : ''}
                            {version.publishedAt ? ` · Published ${formatDate(version.publishedAt)}` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${governanceTone(version.governanceState)}`}>
                          {titleCase(version.governanceState)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Governance Events</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {events.length === 0 && (
                    <div className="px-5 py-8 text-sm text-gray-400">No governance domain events have been recorded.</div>
                  )}
                  {events.map((event) => (
                    <div key={event.eventId} className="px-5 py-4 flex items-start gap-3">
                      <div className="mt-0.5">
                        {event.eventType.toLowerCase() === 'approve' || event.eventType.toLowerCase() === 'publish' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#1A7A4A]" />
                        ) : event.eventType.toLowerCase() === 'reject' ? (
                          <XCircle className="w-4 h-4 text-[#C0392B]" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#1E5B9C]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{titleCase(event.eventType)}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {titleCase(event.entityType)} · {event.entityId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 justify-end">
                          <User className="w-3 h-3" />
                          {event.actor}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Governance Audit Log</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {auditLog.length === 0 && (
                  <div className="px-5 py-8 text-sm text-gray-400">No audit records are available for this company yet.</div>
                )}
                {auditLog.map((entry) => (
                  <div key={entry.logId} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition">
                    <span className="text-[10px] font-mono text-gray-400 w-36 shrink-0">{formatDateTime(entry.timestamp)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${governanceTone(entry.action)}`}>
                      {titleCase(entry.action)}
                    </span>
                    <span className="text-xs text-gray-700 flex-1">
                      {titleCase(entry.entityType)} · {entry.entityId}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0">
                      <User className="w-3 h-3" />
                      {entry.actor}
                    </span>
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
