"use client";

/* S24: PLANNING GOVERNANCE DASHBOARD — Approval Workflow Kanban */

import { ShieldCheck, Clock, CheckCircle2, AlertTriangle, XCircle, User, ArrowRight } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const workflowStages = [
  { stage: 'Draft', color: 'border-t-gray-400', items: [
    { id: 'WF-014', title: 'Downtown Kitchen CAPEX Final', assignee: 'Projects', due: '05 Apr', priority: 'High' },
    { id: 'WF-015', title: 'Q2 Marketing Budget', assignee: 'Marketing', due: '10 Apr', priority: 'Medium' },
  ]},
  { stage: 'Under Review', color: 'border-t-blue-500', items: [
    { id: 'WF-012', title: 'Assumption Set v4 — Full Model', assignee: 'Commercial', due: '02 Apr', priority: 'Critical' },
    { id: 'WF-013', title: 'JBR Kitchen — Conditional Terms', assignee: 'Strategy', due: '08 Apr', priority: 'High' },
  ]},
  { stage: 'CFO Review', color: 'border-t-amber-500', items: [
    { id: 'WF-011', title: 'Series A Term Sheet Review', assignee: 'CFO', due: '31 Mar', priority: 'Critical' },
  ]},
  { stage: 'Board Approval', color: 'border-t-purple-500', items: [
    { id: 'WF-009', title: 'FY2025 Annual Plan Approval', assignee: 'Board', due: '15 Apr', priority: 'Critical' },
  ]},
  { stage: 'Approved', color: 'border-t-green-500', items: [
    { id: 'WF-008', title: 'Talabat Commission Renegotiation', assignee: 'Partnerships', due: 'Completed', priority: 'High' },
    { id: 'WF-007', title: 'Staff Retention Bonus Program', assignee: 'HR', due: 'Completed', priority: 'Medium' },
    { id: 'WF-006', title: 'Downtown Kitchen — GO Decision', assignee: 'Board', due: 'Completed', priority: 'Critical' },
  ]},
];

const priorityColor = (p: string) => {
  if (p === 'Critical') return 'bg-red-100 text-red-700 border-red-200';
  if (p === 'High') return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
};

const auditLog = [
  { timestamp: '29 Mar 2026, 14:32', action: 'Assumption Set v4 submitted for review', user: 'Sarah (Commercial)', type: 'Submit' },
  { timestamp: '28 Mar 2026, 16:45', action: 'Downtown Kitchen GO approved by Board', user: 'Board Secretary', type: 'Approve' },
  { timestamp: '28 Mar 2026, 10:15', action: 'Series A terms escalated to CFO', user: 'Treasury Team', type: 'Escalate' },
  { timestamp: '27 Mar 2026, 09:00', action: 'JBR Kitchen conditional terms drafted', user: 'Strategy Team', type: 'Create' },
  { timestamp: '22 Mar 2026, 11:30', action: 'Staff Retention Bonus approved', user: 'CFO', type: 'Approve' },
  { timestamp: '15 Mar 2026, 15:00', action: 'Assumption Set v3 approved', user: 'CFO', type: 'Approve' },
];

const typeColor = (t: string) => {
  if (t === 'Approve') return 'text-[#1A7A4A]';
  if (t === 'Escalate') return 'text-[#C47A1E]';
  if (t === 'Submit') return 'text-[#1E5B9C]';
  return 'text-gray-500';
};

export default function GovernanceDashboard() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1E5B9C]" /> Planning Governance Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Approval workflows, audit trail & compliance</p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pending Approvals', value: '4', sub: 'Across all stages', color: 'border-l-amber-500 bg-amber-50' },
            { label: 'Completed This Month', value: '3', sub: 'On track', color: 'border-l-green-500 bg-green-50' },
            { label: 'Overdue', value: '1', sub: 'Series A Review', color: 'border-l-red-500 bg-red-50' },
            { label: 'Avg Cycle Time', value: '4.2 days', sub: 'Draft → Approved', color: 'border-l-blue-500 bg-blue-50' },
          ].map(k => (
            <div key={k.label} className={`border-l-4 ${k.color} rounded-lg p-3 border border-gray-200`}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
              <p className="text-xl font-extrabold text-gray-900 mt-1">{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Kanban Board */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Approval Workflow — Kanban View</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {workflowStages.map((stage, sIdx) => (
              <div key={sIdx} className={`min-w-[220px] flex-1 bg-gray-50 rounded-xl border-t-4 ${stage.color} border border-gray-200 p-3`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{stage.stage}</h4>
                  <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">{stage.items.length}</span>
                </div>
                <div className="space-y-2">
                  {stage.items.map((item, iIdx) => (
                    <div key={iIdx} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:border-[#1B2A4A]/20 transition cursor-pointer">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-mono text-gray-400">{item.id}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${priorityColor(item.priority)}`}>{item.priority}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-800 mb-2 leading-snug">{item.title}</p>
                      <div className="flex items-center justify-between text-[9px] text-gray-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.assignee}</span>
                        <span className="flex items-center gap-1">
                          {item.due === 'Completed' ? <CheckCircle2 className="w-3 h-3 text-[#1A7A4A]" /> : <Clock className="w-3 h-3" />}
                          {item.due}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Governance Audit Log</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {auditLog.map((log, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition">
                <span className="text-[10px] font-mono text-gray-400 w-36 shrink-0">{log.timestamp}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-16 text-center shrink-0 ${typeColor(log.type)} bg-gray-50`}>{log.type}</span>
                <span className="text-xs text-gray-700 flex-1">{log.action}</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0"><User className="w-3 h-3" />{log.user}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
