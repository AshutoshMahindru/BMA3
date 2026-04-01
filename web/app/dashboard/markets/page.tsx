"use client";

/* ══════════════════════════════════════════════════════════════════════════
   S16: MARKET ROLLOUT PLANNER
   Wireframe v4.0: Geo hierarchy tree (8 markets, 6 columns),
   Launch Gantt Timeline (8 kitchens × 12 quarters)
   ══════════════════════════════════════════════════════════════════════ */

import { MapPin, Calendar, CheckCircle2, Clock, AlertTriangle, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { exportCSV, exportPDF } from '@/lib/export';

const markets = [
  { name: 'JLT North', city: 'Dubai', status: 'Live', launchQ: 'Q1 2024', orders: '4,350/mo', revenue: 'AED 270K', margin: '42%', statusColor: 'bg-green-100 text-green-700' },
  { name: 'Marina', city: 'Dubai', status: 'Live', launchQ: 'Q2 2024', orders: '3,800/mo', revenue: 'AED 232K', margin: '39%', statusColor: 'bg-green-100 text-green-700' },
  { name: 'Downtown', city: 'Dubai', status: 'Launching', launchQ: 'Q1 2025', orders: '— (projected)', revenue: 'AED 180K (F)', margin: '35% (F)', statusColor: 'bg-blue-100 text-blue-700' },
  { name: 'JBR', city: 'Dubai', status: 'Launching', launchQ: 'Q2 2025', orders: '— (projected)', revenue: 'AED 155K (F)', margin: '33% (F)', statusColor: 'bg-blue-100 text-blue-700' },
  { name: 'Business Bay', city: 'Dubai', status: 'Planned', launchQ: 'Q4 2025', orders: '—', revenue: 'AED 140K (F)', margin: '30% (F)', statusColor: 'bg-amber-100 text-amber-700' },
  { name: 'Al Reem Island', city: 'Abu Dhabi', status: 'Planned', launchQ: 'Q1 2026', orders: '—', revenue: 'AED 120K (F)', margin: '28% (F)', statusColor: 'bg-amber-100 text-amber-700' },
  { name: 'Al Nahda', city: 'Sharjah', status: 'Pipeline', launchQ: 'Q3 2026', orders: '—', revenue: 'TBD', margin: 'TBD', statusColor: 'bg-gray-100 text-gray-600' },
  { name: 'Al Ain Central', city: 'Al Ain', status: 'Pipeline', launchQ: 'Q1 2027', orders: '—', revenue: 'TBD', margin: 'TBD', statusColor: 'bg-gray-100 text-gray-600' },
];

const quarters = ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26', 'Q4 26'];
const ganttData = [
  { kitchen: 'JLT North', start: 0, duration: 12, color: '#1A7A4A' },
  { kitchen: 'Marina', start: 1, duration: 11, color: '#1A7A4A' },
  { kitchen: 'Downtown', start: 4, duration: 8, color: '#2563eb' },
  { kitchen: 'JBR', start: 5, duration: 7, color: '#2563eb' },
  { kitchen: 'Business Bay', start: 7, duration: 5, color: '#C47A1E' },
  { kitchen: 'Al Reem Island', start: 8, duration: 4, color: '#C47A1E' },
  { kitchen: 'Al Nahda', start: 10, duration: 2, color: '#94a3b8' },
  { kitchen: 'Al Ain Central', start: 12, duration: 0, color: '#94a3b8' },
];

export default function MarketRolloutPlanner() {
  const ctx = usePlanningContext();
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1E5B9C]" />
            Market Rollout Planner
          </h1>
          <p className="text-sm text-gray-500 mt-1">{ctx.scopeLabel} — Kitchen Expansion Pipeline & Timeline</p>
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
