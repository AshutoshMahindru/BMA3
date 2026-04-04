"use client";

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileText,
  FlaskConical,
  MapPin,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getContextOverview,
  getDecisionsMarkets,
  getFinancialsPnl,
} from '@/lib/api-client';

type KpiCard = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
};

type SnapshotRow = {
  period: string;
  revenue: string;
  ebitda: string;
  margin: string;
  netIncome: string;
};

type ChartPoint = {
  label: string;
  revenue: number;
  ebitda: number;
};

type MarketCard = {
  name: string;
  launchQ: string;
  status: string;
};

type FeedItem = {
  time: string;
  title: string;
  desc: string;
};

const quickLaunches = [
  { label: 'New Scenario', icon: BarChart3, href: '/dashboard/scenario', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { label: 'Update Assumptions', icon: Settings2, href: '/dashboard/assumptions', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { label: 'View P&L', icon: FileText, href: '/dashboard/pnl', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { label: 'Run Simulation', icon: FlaskConical, href: '/dashboard/simulations', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
];

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function safeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function launchQuarter(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'TBD';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'TBD';
  }

  return `Q${Math.floor(date.getMonth() / 3) + 1}'${String(date.getFullYear()).slice(2)}`;
}

function lineItemValues(lineItems: Array<any> | undefined, label: string): number[] {
  const line = Array.isArray(lineItems)
    ? lineItems.find((item) => String(item?.label || '').toLowerCase() === label.toLowerCase())
    : null;
  return Array.isArray(line?.values) ? line.values.map((value: unknown) => safeNumber(value)) : [];
}

export default function HomePage() {
  const ctx = usePlanningContext();
  const activeScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);
  const activeVersionId = activeScenario?.latestVersionId;
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotRow[]>([]);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [marketCards, setMarketCards] = useState<MarketCard[]>([]);
  const [activityFeed, setActivityFeed] = useState<FeedItem[]>([]);
  const [pendingActions, setPendingActions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!ctx.companyId) {
        if (!cancelled) {
          setKpis([]);
          setSnapshotRows([]);
          setChartPoints([]);
          setMarketCards([]);
          setActivityFeed([]);
          setPendingActions([]);
        }
        return;
      }

      const [overviewResult, pnlResult, marketsResult] = await Promise.all([
        getContextOverview({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId || undefined,
          versionId: activeVersionId || undefined,
        }),
        getFinancialsPnl({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId || undefined,
          versionId: activeVersionId || undefined,
        }),
        getDecisionsMarkets({
          companyId: ctx.companyId,
          scenarioId: ctx.scenarioId || undefined,
          versionId: activeVersionId || undefined,
        }),
      ]);

      if (cancelled) {
        return;
      }

      const overview = overviewResult.data;
      const pnl = pnlResult.data;
      const markets = Array.isArray(marketsResult.data) ? marketsResult.data : [];

      const headline = overview?.headlineKpis as Record<string, unknown> | undefined;
      const alerts = Array.isArray(overview?.alerts) ? overview.alerts : [];

      setKpis([
        {
          label: 'Total Revenue',
          value: formatCompactCurrency(safeNumber(headline?.revenue)),
          delta: ctx.scenarioName || 'Live scenario',
          positive: true,
        },
        {
          label: 'EBITDA',
          value: formatCompactCurrency(safeNumber(headline?.ebitda)),
          delta: `Net income ${formatCompactCurrency(safeNumber((overview?.headlineKpis as any)?.netIncome || 0))}`,
          positive: safeNumber(headline?.ebitda) >= 0,
        },
        {
          label: 'Monthly Burn',
          value: formatCompactCurrency(safeNumber(headline?.burn)),
          delta: safeNumber(headline?.burn) > 0 ? 'Live cash use' : 'Cash positive',
          positive: safeNumber(headline?.burn) <= 0,
        },
        {
          label: 'Cash Runway',
          value: `${safeNumber(headline?.runway).toFixed(1)} Months`,
          delta: safeNumber(headline?.runway) >= 6 ? 'Healthy' : 'Needs review',
          positive: safeNumber(headline?.runway) >= 6,
        },
        {
          label: 'Active Markets',
          value: String(markets.length),
          delta: markets.length > 0 ? `${markets.length} live decisions` : 'No rollout decisions',
          positive: markets.length > 0,
        },
        {
          label: 'Open Alerts',
          value: String(alerts.length),
          delta: alerts.length === 0 ? 'No active issues' : `${alerts.length} require review`,
          positive: alerts.length === 0,
        },
      ]);

      const periods = Array.isArray(pnl?.periods)
        ? pnl.periods.filter((period): period is string => typeof period === 'string').slice(0, 6)
        : [];
      const netRevenue = lineItemValues(pnl?.lineItems as Array<any> | undefined, 'Net Revenue');
      const ebitda = lineItemValues(pnl?.lineItems as Array<any> | undefined, 'EBITDA');
      const ebitdaMargin = lineItemValues(pnl?.lineItems as Array<any> | undefined, 'EBITDA Margin %');
      const netIncome = lineItemValues(pnl?.lineItems as Array<any> | undefined, 'Net Income');

      setSnapshotRows(
        periods.map((period: string, index: number) => ({
          period,
          revenue: formatCurrency(netRevenue[index] || 0),
          ebitda: formatCurrency(ebitda[index] || 0),
          margin: formatPercent(ebitdaMargin[index] || 0),
          netIncome: formatCurrency(netIncome[index] || 0),
        })),
      );

      setChartPoints(
        periods.slice(0, 12).map((period: string, index: number) => ({
          label: period,
          revenue: netRevenue[index] || 0,
          ebitda: ebitda[index] || 0,
        })),
      );

      setMarketCards(
        markets.slice(0, 4).map((market: any) => ({
          name: market.title || market.decisionTitle || 'Untitled market',
          launchQ: launchQuarter(market.effectivePeriod || market.decidedAt || market.createdAt),
          status: String(market.status || 'draft'),
        })),
      );

      const feed: FeedItem[] = [];
      if (overview?.activeScenario) {
        feed.push({
          time: 'Now',
          title: 'Active Scenario',
          desc: `${(overview.activeScenario as any).name || 'Unnamed scenario'} is loaded in the planning context.`,
        });
      }
      if (overview?.activeVersion) {
        feed.push({
          time: 'Now',
          title: 'Active Version',
          desc: `${(overview.activeVersion as any).label || 'Current version'} is in ${(overview.activeVersion as any).governanceState || 'draft'} state.`,
        });
      }
      markets.slice(0, 2).forEach((market: any, index: number) => {
        feed.push({
          time: `Market ${index + 1}`,
          title: market.title || 'Market rollout',
          desc: `Status: ${market.status || 'draft'} • Launch ${launchQuarter(market.effectivePeriod || market.decidedAt || market.createdAt)}`,
        });
      });
      setActivityFeed(feed);

      setPendingActions(
        alerts.length > 0
          ? alerts.slice(0, 4).map((alert: any) => String(alert.message || alert.alert_name || 'Review required'))
          : ['No active governance or performance alerts.'],
      );
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [activeVersionId, ctx.companyId, ctx.scenarioId, ctx.scenarioName]);

  const chartMax = Math.max(
    1,
    ...chartPoints.flatMap((point) => [point.revenue, Math.abs(point.ebitda)]),
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Global Planning Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Consolidated view across {ctx.companyName} — {ctx.periodLabel} — {ctx.scenarioName}</p>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1a2744]/20 transition">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-xl font-extrabold text-gray-900">{kpi.value}</p>
              <p className={`text-[10px] font-medium mt-1.5 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLaunches.map((ql) => {
            const Icon = ql.icon;
            return (
              <Link
                key={ql.label}
                href={ql.href}
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
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Company-Wide P&amp;L Snapshot</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Period</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Net Revenue</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">EBITDA</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">EBITDA Margin</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Net Income</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {snapshotRows.map((row, index) => (
                    <tr key={row.period} className={`hover:bg-blue-50/30 transition ${index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                      <td className="px-4 py-2 font-semibold text-gray-800">{row.period}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.revenue}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.ebitda}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.margin}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.netIncome}</td>
                    </tr>
                  ))}
                  {snapshotRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No live P&amp;L rows available for the selected context.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#1E5B9C]" /> Active Markets
            </h3>
            <div className="space-y-2.5">
              {marketCards.map((market) => (
                <div key={`${market.name}-${market.launchQ}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{market.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{market.launchQ}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {market.status}
                  </span>
                </div>
              ))}
              {marketCards.length === 0 && (
                <p className="text-xs text-gray-400">No market rollout decisions available.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Revenue vs EBITDA Trend</h3>
          <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label="Revenue vs EBITDA bar chart">
            {[0, 1, 2, 3, 4].map((index) => (
              <line key={index} x1="50" y1={30 + index * 40} x2="770" y2={30 + index * 40} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {chartPoints.map((point, index) => {
              const x = 62 + index * 60;
              const revenueHeight = Math.max(4, (Math.max(point.revenue, 0) / chartMax) * 150);
              const ebitdaHeight = Math.max(4, (Math.abs(point.ebitda) / chartMax) * 150);
              return (
                <g key={point.label}>
                  <rect x={x} y={180 - revenueHeight} width="22" height={revenueHeight} rx="2" fill="#1B2A4A" opacity="0.85" />
                  <rect x={x + 24} y={180 - ebitdaHeight} width="22" height={ebitdaHeight} rx="2" fill={point.ebitda >= 0 ? '#1A7A4A' : '#C0392B'} opacity="0.8" />
                  <text x={x + 22} y={198} textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">{point.label}</text>
                </g>
              );
            })}
          </svg>
          <div className="flex items-center gap-5 mt-2 text-[10px] font-bold text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#1B2A4A]" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-[#1A7A4A]" /> EBITDA</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#1E5B9C]" /> Recent Activity
            </h3>
            <div className="space-y-3">
              {activityFeed.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex gap-3 items-start">
                  <div className="text-[10px] text-gray-400 font-mono w-16 pt-0.5 shrink-0">{item.time}</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{item.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && (
                <p className="text-xs text-gray-400">No recent live activity available.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#C47A1E]" /> Pending Actions
            </h3>
            <div className="space-y-2">
              {pendingActions.map((action) => (
                <div key={action} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-gray-700">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
