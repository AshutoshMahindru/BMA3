"use client";

/* ══════════════════════════════════════════════════════════════════════════
   S16: MARKET ROLLOUT PLANNER
   Wireframe v4.0: Geo hierarchy tree (8 markets, 6 columns),
   Launch Gantt Timeline (8 kitchens × 12 quarters)
   ══════════════════════════════════════════════════════════════════════ */

import { MapPin, Calendar, CheckCircle2, Clock, AlertTriangle, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { exportCSV, exportPDF } from '@/lib/export';
import { fetchRolloutPlans } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';
import { ROLLOUT_FALLBACK, QUARTERS, type RolloutPlanData } from '@/lib/data/markets';
import DataFreshness from '@/components/data-freshness';

export default function MarketRolloutPlanner() {
  const ctx = usePlanningContext();
  const scenarioId = ctx.scenario === 'base' ? 'sc_base_001' : `sc_${ctx.scenario}_001`;

  const { data: rolloutData, source, lastFetched } = useApiData<RolloutPlanData>(
    () => fetchRolloutPlans(scenarioId),
    ROLLOUT_FALLBACK,
    [scenarioId]
  );

  const markets = rolloutData.markets;
  const ganttData = rolloutData.gantt;
  const quarters = QUARTERS;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1E5B9C]" />
            Market Rollout Planner
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — Kitchen Expansion Pipeline & Timeline
            <DataFreshness source={source} lastFetched={lastFetched} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Kitchen','City','Status','Launch Q','Orders','Revenue','Margin']; const r=markets.map(m=>[m.name,m.city,m.status,m.launchQ,m.orders,m.revenue,m.margin]); exportCSV('Market_Rollout',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Kitchen','City','Status','Launch Q','Orders','Revenue','Margin']; const r=markets.map(m=>[m.name,m.city,m.status,m.launchQ,m.orders,m.revenue,m.margin]); exportPDF('Market Rollout Plan',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {/* Market Hierarchy Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Geo Hierarchy — Market Pipeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Kitchen', 'City', 'Status', 'Launch Quarter', 'Monthly Orders', 'Monthly Revenue', 'EBITDA Margin'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {markets.map((m, i) => (
                  <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{m.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{m.city}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.statusColor}`}>{m.status}</span></td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{m.launchQ}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{m.orders}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{m.revenue}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[#1A7A4A]">{m.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Launch Gantt Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1E5B9C]" />
            Launch Gantt Timeline
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[140px] pb-2">Kitchen</th>
                  {quarters.map(q => (
                    <th key={q} className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-wider pb-2 min-w-[60px]">{q}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ganttData.map((g, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-2 font-semibold text-gray-700 pr-3">{g.kitchen}</td>
                    {quarters.map((_, qIdx) => (
                      <td key={qIdx} className="py-2 px-0.5">
                        {qIdx >= g.start && qIdx < g.start + g.duration ? (
                          <div className="h-5 rounded" style={{ backgroundColor: g.color, opacity: 0.8 }} />
                        ) : (
                          <div className="h-5" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[10px] font-medium text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1A7A4A]" /> Live</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2563eb]" /> Launching</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C47A1E]" /> Planned</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#94a3b8]" /> Pipeline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
