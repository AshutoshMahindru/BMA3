"use client";

import { TrendingUp, TrendingDown, Activity, Clock, MapPin, AlertTriangle, CheckCircle, Timer, ArrowRight, Settings2, BarChart3, FlaskConical, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePlanningContext } from '@/lib/planning-context';
import { PORTFOLIO_KPIS, QUARTERLY_PNL, MARKET_PORTFOLIO, ACTIVE_ALERTS } from '@/lib/data/kpis';

/* ═══════════════════════ S01: Home / Global Planning Overview ═══════════════════ */

/* Derived KPI cards from shared data module */
const kpis = [
  { label: 'Total Revenue',     value: `AED ${(PORTFOLIO_KPIS.grossRevenue/1000).toFixed(1)}M`,  delta: `▲ ${PORTFOLIO_KPIS.revenueGrowth}% vs Plan`, positive: true  },
  { label: 'EBITDA',            value: `AED ${PORTFOLIO_KPIS.ebitda}K`,                           delta: `▲ ${PORTFOLIO_KPIS.ebitdaMargin}% Margin`,     positive: true  },
  { label: 'Monthly Burn',      value: `AED ${PORTFOLIO_KPIS.monthlyBurn}K`,                      delta: '▼ 8% (Better)',                               positive: true  },
  { label: 'Cash Runway',       value: `${PORTFOLIO_KPIS.cashRunway} Months`,                     delta: '▼ 0.5 Mo vs Plan',                            positive: false },
  { label: 'Active Kitchens',   value: String(PORTFOLIO_KPIS.totalKitchens),                      delta: `+ ${PORTFOLIO_KPIS.kitchensInPipeline} Pipeline`, positive: true  },
  { label: 'Confidence Score',  value: '76%',                                                     delta: 'Medium',                                    positive: true  },
];

const quickLaunches = [
  { label: 'New Scenario',      icon: BarChart3,    href: '/dashboard/scenario',    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { label: 'Update Assumptions',icon: Settings2,    href: '/dashboard/assumptions', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { label: 'View P&L',          icon: FileText,     href: '/dashboard/pnl',         color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { label: 'Run Simulation',    icon: FlaskConical, href: '/dashboard/simulation',  color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
];

/* P&L Snapshot from shared quarterly data */
const pnlSnapshot = QUARTERLY_PNL.map(q => ({
  line: q.quarter,
  q1:   q.revenue.toLocaleString(),
  q2:   q.ebitda.toLocaleString(),
  q3:   `${q.ebitdaMargin}%`,
  q4:   (q.fcf >= 0 ? '+' : '') + q.fcf.toLocaleString(),
  fy:   q.quarter === 'FY 2025' ? String(q.revenue) : '',
}));

const activityFeed = [
  { time: '10:30 AM',  title: 'Demand Assumption Update', desc: 'by Sarah K. — Increased JLT Base Orders (+5%)' },
  { time: 'Yesterday', title: 'Plan Freeze',               desc: 'Base Case v2.1 locked by CFO' },
  { time: 'Yesterday', title: 'Trigger Fired',             desc: "'Downtown Launch Readiness' reached 100%" },
];

const pendingActions = [
  { type: 'warning', text: 'Approval Required: Q2 Marketing Budget' },
  { type: 'warning', text: 'Data Gap: Abu Dhabi Rent Assumptions' },
];

export default function HomePage() {
  const ctx = usePlanningContext();

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Global Planning Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Consolidated view across {ctx.companyName} — {ctx.periodLabel} — {ctx.scenarioName}</p>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {/* ── KPI Strip (6 cards) ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1a2744]/20 transition">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-xl font-extrabold text-gray-900">{kpi.value}</p>
              <p className={`text-[10px] font-medium mt-1.5 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        {/* ── Quick-Launch Tiles (4) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLaunches.map(ql => {
            const Icon = ql.icon;
            return (
              <Link key={ql.label} href={ql.href}
                className={`flex items-center gap-3 p-4 rounded-xl border transition group ${ql.color}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-xs font-bold">{ql.label}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-100 transition" />
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── P&L Snapshot (Q1-Q4 table) ── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Company-Wide P&L Snapshot (AED K)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider w-[160px]">Line Item</th>
                    {['Q1', 'Q2', 'Q3', 'Q4', 'FY 2025'].map(h => (
                      <th key={h} className={`px-3 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider ${h === 'FY 2025' ? 'bg-[#1B2A4A] text-white' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pnlSnapshot.map((row, i) => (
                    <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''} ${i === QUARTERLY_PNL.length - 1 ? 'font-bold bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-2 font-semibold text-gray-800">{row.line}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.q1}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.q2}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.q3}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.q4}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#1B2A4A] bg-blue-50/50">{row.fy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Market Portfolio ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#1E5B9C]" /> Active Markets
            </h3>
            <div className="space-y-2.5">
              {MARKET_PORTFOLIO.slice(0, 4).map(m => (
                <div key={m.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{m.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{m.launchQ}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    m.status === 'Live' ? 'bg-green-100 text-green-700' :
                    m.status === 'Launching' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Revenue / EBITDA SVG Chart ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Revenue vs EBITDA Trend</h3>
          <svg viewBox="0 0 800 180" className="w-full" role="img" aria-label="Revenue vs EBITDA bar chart">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <line key={i} x1="50" y1={30 + i * 35} x2="770" y2={30 + i * 35} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {/* Revenue bars */}
            {[280, 310, 340, 360, 355, 370, 385, 400, 390, 410, 430, 450].map((v, i) => (
              <g key={`r-${i}`}>
                <rect x={62 + i * 60} y={170 - v / 3.5} width="22" height={v / 3.5} rx="2" fill="#1B2A4A" opacity="0.85" />
                <rect x={86 + i * 60} y={170 - (v * 0.22) / 3.5} width="22" height={(v * 0.22) / 3.5} rx="2" fill="#1A7A4A" opacity="0.8" />
              </g>
            ))}
            {/* X labels */}
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
              <text key={m} x={80 + i * 60} y={178} textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">{m}</text>
            ))}
          </svg>
          <div className="flex items-center gap-5 mt-2 text-[10px] font-bold text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#1B2A4A]" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#1A7A4A]" /> EBITDA</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Activity Feed ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#1E5B9C]" /> Recent Activity
            </h3>
            <div className="space-y-3">
              {activityFeed.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="text-[10px] text-gray-400 font-mono w-16 pt-0.5 shrink-0">{a.time}</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pending Actions ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#C47A1E]" /> Pending Actions
            </h3>
            <div className="space-y-2">
              {pendingActions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-gray-700">{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
