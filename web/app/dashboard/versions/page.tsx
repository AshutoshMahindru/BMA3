"use client";

/* S23: PLAN VERSION MANAGER — Version History + Diff Table */

import { GitBranch, Eye, RotateCcw, CheckCircle2, Clock, User } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

const versions = [
  { version: 'v4 (Draft)', date: '29 Mar 2026', author: 'Commercial Team', status: 'Draft', statusColor: 'bg-amber-100 text-amber-700', changes: 12, notes: 'Downtown kitchen assumptions added, commission rate updated', scenario: 'Base Case' },
  { version: 'v3 (Approved)', date: '15 Mar 2026', author: 'CFO', status: 'Approved', statusColor: 'bg-green-100 text-green-700', changes: 8, notes: 'Series A terms updated, labor cost assumptions revised', scenario: 'Base Case' },
  { version: 'v2', date: '01 Mar 2026', author: 'Strategy', status: 'Superseded', statusColor: 'bg-gray-100 text-gray-600', changes: 15, notes: 'Full model restructure — 8-tab assumption framework introduced', scenario: 'Base Case' },
  { version: 'v1', date: '15 Feb 2026', author: 'Finance', status: 'Superseded', statusColor: 'bg-gray-100 text-gray-600', changes: 0, notes: 'Initial model setup — demand + pricing assumptions', scenario: 'Base Case' },
];

const diffTable = [
  { field: 'Daily Order Volume — JLT', v3: '130 orders', v4: '145 orders', change: '+11.5%', direction: 'up' },
  { field: 'Daily Order Volume — Downtown', v3: '80 orders', v4: '95 orders', change: '+18.8%', direction: 'up' },
  { field: 'Platform Commission — Talabat', v3: '30%', v4: '28%', change: '-2.0pp', direction: 'down' },
  { field: 'Food COGS per Order', v3: 'AED 14.80', v4: 'AED 14.20', change: '-4.1%', direction: 'down' },
  { field: 'CAC — Acquisition Cost', v3: 'AED 42', v4: 'AED 35', change: '-16.7%', direction: 'down' },
  { field: 'Kitchen Build-Out Cost', v3: 'AED 380K', v4: 'AED 350K', change: '-7.9%', direction: 'down' },
  { field: 'Series A Target', v3: 'AED 7.5M', v4: 'AED 8.0M', change: '+6.7%', direction: 'up' },
  { field: 'Staff per Kitchen (FTE)', v3: '7.0', v4: '6.5', change: '-7.1%', direction: 'down' },
  { field: 'Pre-Money Valuation', v3: 'AED 10M', v4: 'AED 12M', change: '+20.0%', direction: 'up' },
  { field: 'Inventory Days', v3: '7 days', v4: '5 days', change: '-28.6%', direction: 'down' },
  { field: 'Growth Rate — New Markets', v3: '12.0%', v4: '15.0%', change: '+3.0pp', direction: 'up' },
  { field: 'Own-Channel Revenue Mix', v3: '8%', v4: '12%', change: '+4.0pp', direction: 'up' },
];

export default function VersionManager() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-[#1E5B9C]" /> Plan Version Manager
        </h1>
        <p className="text-sm text-gray-500 mt-1">{ctx.scenarioLabel} — Track assumption changes across planning cycles</p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {/* Version History */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Version History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Version', 'Date', 'Author', 'Scenario', 'Status', 'Changes', 'Notes', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {versions.map((v, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i === 0 ? 'bg-blue-50/30' : i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1B2A4A]">{v.version}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />{v.date}</td>
                    <td className="px-4 py-3 text-gray-700 flex items-center gap-1"><User className="w-3 h-3 text-gray-400" />{v.author}</td>
                    <td className="px-4 py-3 text-gray-600">{v.scenario}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.statusColor}`}>{v.status}</span></td>
                    <td className="px-4 py-3 font-mono font-bold text-[#1B2A4A]">{v.changes}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[250px]">{v.notes}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="text-[9px] font-bold text-[#1E5B9C] hover:text-[#1B2A4A] flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition"><Eye className="w-3 h-3" /> View</button>
                        {v.status === 'Superseded' && (
                          <button className="text-[9px] font-bold text-gray-500 hover:text-gray-700 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 transition"><RotateCcw className="w-3 h-3" /> Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diff Table: v3 vs v4 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Change Diff — v3 (Approved) → v4 (Draft) · {diffTable.length} fields changed
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[240px] border-r border-white/10">Assumption Field</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider bg-red-900/20">v3 (Approved)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider bg-green-900/20">v4 (Draft)</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Δ Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {diffTable.map((d, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 border-r border-gray-100">{d.field}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-400 line-through">{d.v3}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#1A7A4A]">{d.v4}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${d.direction === 'up' ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{d.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
