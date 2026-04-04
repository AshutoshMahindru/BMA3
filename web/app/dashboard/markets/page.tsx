"use client";

/* ===================================================================
   S16: MARKET ROLLOUT PLANNER
   Wireframe v4.0: Geo hierarchy tree (8 markets, 6 columns),
   Launch Gantt Timeline (8 kitchens x 12 quarters)
   Wave 4 rewire: fetches from canonical decisions/markets API
   =================================================================== */

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { exportCSV, exportPDF } from '@/lib/export';
import { getDecisionsMarkets } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import type { DataSource } from '@/lib/data-source';

/* ── Types ── */
type GanttRow = { kitchen: string; start: number; duration: number; color: string };
type MarketRow = { name: string; city: string; status: string; statusColor: string; launchQ: string; orders: string | number; revenue: string | number; margin: string | number };

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  draft: 'text-blue-700 bg-blue-50 border border-blue-200',
  frozen: 'text-amber-700 bg-amber-50 border border-amber-200',
  archived: 'text-gray-500 bg-gray-100 border border-gray-200',
};

const GANTT_COLORS: Record<string, string> = {
  active: '#1A7A4A',
  draft: '#2563eb',
  frozen: '#C47A1E',
  archived: '#94a3b8',
};

const QUARTERS = ['Q1\'26', 'Q2\'26', 'Q3\'26', 'Q4\'26', 'Q1\'27', 'Q2\'27', 'Q3\'27', 'Q4\'27', 'Q1\'28', 'Q2\'28', 'Q3\'28', 'Q4\'28'];

function quarterIndexForDate(value: Date): number {
  const quarter = Math.floor(value.getMonth() / 3);
  return (value.getFullYear() - 2026) * 4 + quarter;
}

function parseSchedule(value: any): { start: number; duration: number; launchQ: string } | null {
  const effectivePeriod = value?.effectivePeriod;
  const parsedStart = new Date(
    typeof effectivePeriod === 'object' && effectivePeriod !== null
      ? effectivePeriod.start || value?.startDate || value?.effective_from || ''
      : value?.startDate || effectivePeriod || '',
  );

  if (Number.isNaN(parsedStart.getTime())) {
    return null;
  }

  const parsedEnd = new Date(
    typeof effectivePeriod === 'object' && effectivePeriod !== null
      ? effectivePeriod.end || value?.endDate || value?.effective_to || ''
      : value?.endDate || effectivePeriod || '',
  );

  const start = Math.max(0, quarterIndexForDate(parsedStart));
  const end = Number.isNaN(parsedEnd.getTime()) ? start : Math.max(start, quarterIndexForDate(parsedEnd));
  const launchQ = `Q${Math.floor(parsedStart.getMonth() / 3) + 1}'${String(parsedStart.getFullYear()).slice(2)}`;

  return {
    start,
    duration: Math.min(end - start + 1, Math.max(QUARTERS.length - start, 1)),
    launchQ,
  };
}

export default function MarketRolloutPlanner() {
  const ctx = usePlanningContext();
  const scenarioId = ctx.scenarioId || '';
  const companyId = ctx.companyId || '';

  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [ganttData, setGanttData] = useState<GanttRow[]>([]);
  const [source, setSource] = useState<DataSource>('loading');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setMarkets([]);
      setGanttData([]);
      setSource('api');
      setLastFetched(new Date());
      return;
    }

    setSource('loading');
    const result = await getDecisionsMarkets({
      companyId,
      scenarioId: scenarioId || undefined,
    });

    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const rows: MarketRow[] = result.data.map((d: any, idx: number) => {
        const schedule = parseSchedule(d);
        return {
          name: d.title || `Market ${idx + 1}`,
          city: typeof d.city === 'string'
            ? d.city
            : (typeof d.effectivePeriod === 'string' ? d.effectivePeriod : 'TBD'),
          status: d.status || 'draft',
          statusColor: STATUS_COLORS[d.status] || STATUS_COLORS.draft,
          launchQ: schedule?.launchQ || 'TBD',
          orders: '--',
          revenue: '--',
          margin: '--',
        };
      });

      const gantt: GanttRow[] = result.data.flatMap((decision: any, idx: number) => {
        const schedule = parseSchedule(decision);
        if (!schedule) {
          return [];
        }
        return [{
          kitchen: rows[idx].name,
          start: schedule.start,
          duration: schedule.duration,
          color: GANTT_COLORS[rows[idx].status] || GANTT_COLORS.draft,
        }];
      });

      setMarkets(rows);
      setGanttData(gantt);
      setSource('api');
      setLastFetched(new Date());
    } else {
      setMarkets([]);
      setGanttData([]);
      setSource('api');
      setLastFetched(new Date());
    }
  }, [companyId, scenarioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1E5B9C]" />
            Market Rollout Planner
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — Kitchen Expansion Pipeline & Timeline
            <DataFreshness source={source} lastFetched={lastFetched ? new Date(lastFetched) : null} />
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
          {markets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No market decisions found for this context. Create market decisions in the Decisions workspace to populate this view.
            </div>
          ) : (
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
          )}
        </div>

        {/* Launch Gantt Timeline */}
        {ganttData.length > 0 && (
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
                    {QUARTERS.map(q => (
                      <th key={q} className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-wider pb-2 min-w-[60px]">{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ganttData.map((g, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-2 font-semibold text-gray-700 pr-3">{g.kitchen}</td>
                      {QUARTERS.map((_, qIdx) => (
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
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1A7A4A]" /> Active</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2563eb]" /> Draft</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C47A1E]" /> Frozen</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#94a3b8]" /> Archived</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
