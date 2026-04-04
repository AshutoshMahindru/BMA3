"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, Info, AlertCircle, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getFinancialsExecutiveSummary } from '@/lib/api-client';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════ S02: Executive Planning Cockpit ══════════════════════ */

// ── Types for executive summary data returned by API ─────────────────────────

interface ExecutiveSummary {
  revenue: number;
  grossProfit: number;
  ebitda: number;
  netIncome: number;
  burn: number;
  runway: number;
  irr: number;
  periodLabel: string;
}

interface MonthlyRevenueEbitda {
  month: string;
  revenue: number;
  ebitda: number;
}

interface ScenarioSnapshot {
  scenario: string;
  revenue: string;
  ebitda: string;
  irr: string;
  payback: string;
  badge: string;
}

interface PlatformMixItem {
  name: string;
  pct: number;
  color: string;
}

interface Alert {
  type: string;
  text: string;
  icon: typeof AlertCircle;
  color: string;
}

const fmt = (val: number) =>
  new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val);

const fmtK = (val: number) => `AED ${fmt(Math.round(val / 1000))}K`;

export default function ExecutiveCockpit() {
  const ctx = usePlanningContext();

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    getFinancialsExecutiveSummary({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
    })
      .then((result) => {
        if (result.data) {
          setSummary(result.data);
        }
        setLastFetched(new Date().toISOString());
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load executive summary');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  // ── KPI cards built from live data ────────────────────────────────────────
  const kpis = summary
    ? [
        { label: 'Total Revenue', value: fmtK(summary.revenue), delta: '', positive: true, sub: summary.periodLabel },
        { label: 'Gross Profit', value: fmtK(summary.grossProfit), delta: `Margin: ${summary.revenue > 0 ? ((summary.grossProfit / summary.revenue) * 100).toFixed(1) : '0.0'}%`, positive: summary.grossProfit >= 0, sub: 'Period Total' },
        { label: 'EBITDA', value: fmtK(summary.ebitda), delta: `Margin: ${summary.revenue > 0 ? ((summary.ebitda / summary.revenue) * 100).toFixed(1) : '0.0'}%`, positive: summary.ebitda >= 0, sub: 'Period Total' },
        { label: 'Net Income', value: fmtK(summary.netIncome), delta: '', positive: summary.netIncome >= 0, sub: 'Period Total' },
        { label: 'Monthly Burn', value: fmtK(summary.burn), delta: '', positive: summary.burn <= 0, sub: 'Current Run Rate' },
        { label: 'Cash Runway', value: `${summary.runway.toFixed(1)} Mo`, delta: '', positive: summary.runway >= 6, sub: 'At Current Burn' },
      ]
    : [];

  // ── Placeholder data for sections not yet served by executive-summary ─────
  // These will be replaced when the API expands to return full monthly series.
  const monthlyRevenueEbitda: MonthlyRevenueEbitda[] = [];
  const scenarioSnapshot: ScenarioSnapshot[] = [];
  const platformMix: PlatformMixItem[] = [];
  const alerts: Alert[] = [];

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Executive Planning Cockpit</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.periodLabel} — {ctx.scenarioName}
            <DataFreshness source={loading ? 'loading' : error ? 'error' : 'api'} lastFetched={lastFetched} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const h = ['Scenario', 'Revenue', 'EBITDA', 'IRR', 'Payback'];
              const r = scenarioSnapshot.map(s => [s.scenario, s.revenue, s.ebitda, s.irr, s.payback]);
              exportCSV('Executive_Scenarios', h, r);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const h = ['Scenario', 'Revenue', 'EBITDA', 'IRR', 'Payback'];
              const r = scenarioSnapshot.map(s => [s.scenario, s.revenue, s.ebitda, s.irr, s.payback]);
              exportPDF('Executive Planning Cockpit', h, r);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* ── Loading state ── */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1E5B9C] rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading executive summary…</p>
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Failed to load executive summary</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && !ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 shadow-sm flex items-center justify-center">
            <p className="text-sm text-gray-400">Select a company and scenario to view the executive summary.</p>
          </div>
        )}

        {/* ── KPI Strip (6 cards) ── */}
        {!loading && kpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1a2744]/20 transition">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
                {kpi.delta && (
                  <p className={`text-[10px] font-medium mt-1 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{kpi.delta}</p>
                )}
                <p className="text-[9px] text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Monthly Revenue vs EBITDA Table ── */}
        {!loading && !error && monthlyRevenueEbitda.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Monthly Revenue vs EBITDA (AED K)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider w-[100px]">Metric</th>
                    {monthlyRevenueEbitda.map(m => (
                      <th key={m.month} className="px-2 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{m.month}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-white uppercase tracking-wider bg-[#1B2A4A]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">Revenue</td>
                    {monthlyRevenueEbitda.map(m => (
                      <td key={`r-${m.month}`} className="px-2 py-2.5 text-right font-mono text-gray-700">{m.revenue}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#1B2A4A] bg-blue-50/50">
                      {monthlyRevenueEbitda.reduce((s, m) => s + m.revenue, 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-[#F4F5F7]">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">EBITDA</td>
                    {monthlyRevenueEbitda.map(m => (
                      <td key={`e-${m.month}`} className="px-2 py-2.5 text-right font-mono font-bold text-[#1A7A4A]">{m.ebitda}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#1A7A4A] bg-blue-50/50">
                      {monthlyRevenueEbitda.reduce((s, m) => s + m.ebitda, 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2.5 font-semibold text-gray-500 text-[10px]">Margin %</td>
                    {monthlyRevenueEbitda.map(m => (
                      <td key={`m-${m.month}`} className="px-2 py-2.5 text-right font-mono text-gray-400 text-[10px]">{(m.ebitda / m.revenue * 100).toFixed(0)}%</td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-500 text-[10px] bg-blue-50/50">
                      {(monthlyRevenueEbitda.reduce((s, m) => s + m.ebitda, 0) / (monthlyRevenueEbitda.reduce((s, m) => s + m.revenue, 0) || 1) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && (scenarioSnapshot.length > 0 || platformMix.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Scenario Comparison Panel ── */}
            {scenarioSnapshot.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Scenario Comparison Panel</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['Scenario', 'Revenue', 'EBITDA', 'IRR', 'Payback'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scenarioSnapshot.map((s, i) => (
                        <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                          <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{s.scenario}</span></td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">AED {s.revenue}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#1B2A4A]">AED {s.ebitda}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-700">{s.irr}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-700">{s.payback}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Platform Mix Donut ── */}
            {platformMix.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Platform Revenue Mix</h3>
                <div className="flex items-center gap-8">
                  <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
                    {(() => {
                      let offset = 0;
                      return platformMix.map(p => {
                        const dashArray = `${p.pct * 2.83} ${283 - p.pct * 2.83}`;
                        const strokeDashoffset = -offset * 2.83;
                        const el = <circle key={p.name} cx="60" cy="60" r="45" fill="none" stroke={p.color} strokeWidth="22"
                          strokeDasharray={dashArray} strokeDashoffset={strokeDashoffset} />;
                        offset += p.pct;
                        return el;
                      });
                    })()}
                  </svg>
                  <div className="space-y-2 flex-1">
                    {platformMix.map(p => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
                        <span className="text-xs font-medium text-gray-700 flex-1">{p.name}</span>
                        <span className="text-xs font-bold text-gray-900">{p.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Cash Flow Waterfall (static skeleton — populated by cashflow API in future) ── */}
        {!loading && !error && summary && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Cash Flow Waterfall — FY 2025</h3>
            <svg viewBox="0 0 700 150" className="w-full" role="img">
              {[
                { label: 'Opening\nCash', value: 2800, y: 30, h: 80, color: '#1B2A4A' },
                { label: 'Operating\nCF', value: 950, y: 30, h: 55, color: '#1A7A4A' },
                { label: 'CAPEX', value: -380, y: 85, h: 25, color: '#C0392B' },
                { label: 'Funding', value: 500, y: 50, h: 35, color: '#2563eb' },
                { label: 'Debt\nRepay', value: -120, y: 95, h: 15, color: '#C0392B' },
                { label: 'Closing\nCash', value: 3750, y: 20, h: 90, color: '#1B2A4A' },
              ].map((bar, i) => (
                <g key={i}>
                  <rect x={20 + i * 115} y={bar.y} width={80} height={bar.h} rx={4} fill={bar.color} opacity={0.85} />
                  <text x={60 + i * 115} y={bar.y + bar.h + 14} textAnchor="middle" className="text-[8px] fill-gray-500 font-medium">
                    {bar.label.split('\n').map((line, li) => (
                      <tspan key={li} x={60 + i * 115} dy={li === 0 ? 0 : 10}>{line}</tspan>
                    ))}
                  </text>
                  <text x={60 + i * 115} y={bar.y - 4} textAnchor="middle" className="text-[9px] fill-gray-700 font-bold">
                    {(bar.value / 1000).toFixed(1)}M
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* ── Active Alerts ── */}
        {!loading && !error && alerts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Active Alerts</h3>
            <div className="space-y-2">
              {alerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${a.color}`}>
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="text-xs font-medium">{a.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
