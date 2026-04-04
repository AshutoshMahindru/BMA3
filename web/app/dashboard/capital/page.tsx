"use client";

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getFinancialsCapitalStrategy,
  getFinancialsFundingSummary,
  getFinancialsUnitEconomics,
} from '@/lib/api-client';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════ S05: Capital Strategy Console ══════════════════════ */

interface CapitalStrategyPayload {
  currentCash: number;
  monthlyBurn: number;
  runwayMonths: number;
  debtCapacity: number;
  dilutionEstimatePct: number;
  recommendedRaise: number;
  nextRaiseWindowMonths: number;
}

interface FundingSummary {
  currentCash: number;
  runwayMonths: number;
  monthlyBurn: number;
  totalDebt: number;
  totalEquity: number;
  recommendedRaise: number;
}

interface FinancialLineItem {
  label: string;
  values: number[];
  fy: number;
}

interface UnitEconomicsPayload {
  periods: string[];
  lineItems: FinancialLineItem[];
}

interface LadderRow {
  instrument: string;
  amount: number;
  coverage: string;
  signal: string;
  status: string;
  statusColor: string;
}

interface CapTableRow {
  round: string;
  shares: string;
  pct: string;
  value: string;
}

function lineValue(payload: UnitEconomicsPayload | null, label: string, index: number) {
  const values = payload?.lineItems.find((item) => item.label === label)?.values || [];
  if (values.length === 0) return 0;
  return values[index] ?? values[values.length - 1] ?? 0;
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  return `AED ${(value / 1000).toFixed(0)}K`;
}

function cellColor(value: number) {
  if (value >= 35) return 'bg-[#1A7A4A] text-white';
  if (value >= 25) return 'bg-green-200 text-green-900';
  if (value >= 15) return 'bg-amber-100 text-amber-800';
  if (value >= 10) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export default function CapitalStrategy() {
  const ctx = usePlanningContext();

  const [strategy, setStrategy] = useState<CapitalStrategyPayload | null>(null);
  const [funding, setFunding] = useState<FundingSummary | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomicsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getFinancialsCapitalStrategy({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
      getFinancialsFundingSummary({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
      getFinancialsUnitEconomics({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
    ])
      .then(([strategyResult, fundingResult, unitResult]) => {
        if (!strategyResult.data || !fundingResult.data || !unitResult.data) {
          throw new Error(
            strategyResult.error ||
              fundingResult.error ||
              unitResult.error ||
              'Failed to load capital strategy'
          );
        }

        setStrategy(strategyResult.data as CapitalStrategyPayload);
        setFunding(fundingResult.data as FundingSummary);
        setUnitEconomics(unitResult.data as UnitEconomicsPayload);
        setLastFetched(new Date().toISOString());
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load capital strategy');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const latestIndex = Math.max((unitEconomics?.periods.length || 1) - 1, 0);
  const latestOrdersPerDay = lineValue(unitEconomics, 'Orders / Day', latestIndex);
  const latestAov = lineValue(unitEconomics, 'AOV', latestIndex);
  const latestEbitdaPerOrder = lineValue(unitEconomics, 'EBITDA / Order', latestIndex);
  const latestPayback = lineValue(unitEconomics, 'Payback Months', latestIndex);

  const kpis = strategy
    ? [
        {
          label: 'Recommended Raise',
          value: formatCompact(strategy.recommendedRaise),
          delta: strategy.recommendedRaise === 0 ? 'No incremental raise needed' : 'Computed from runway target',
          positive: strategy.recommendedRaise === 0,
        },
        {
          label: 'Debt Capacity',
          value: formatCompact(strategy.debtCapacity),
          delta: strategy.debtCapacity > 0 ? 'Balance sheet supports debt' : 'Limited incremental leverage',
          positive: strategy.debtCapacity > 0,
        },
        {
          label: 'Dilution Estimate',
          value: `${strategy.dilutionEstimatePct.toFixed(1)}%`,
          delta: strategy.dilutionEstimatePct <= 15 ? 'Within target range' : 'High ownership impact',
          positive: strategy.dilutionEstimatePct <= 15,
        },
        {
          label: 'Raise Window',
          value: `${strategy.nextRaiseWindowMonths.toFixed(0)} mo`,
          delta: strategy.nextRaiseWindowMonths >= 3 ? 'Time to prepare materials' : 'Immediate planning needed',
          positive: strategy.nextRaiseWindowMonths >= 3,
        },
        {
          label: 'Runway',
          value: `${strategy.runwayMonths.toFixed(1)} mo`,
          delta: strategy.runwayMonths >= 9 ? 'Healthy coverage' : 'Capital actions required',
          positive: strategy.runwayMonths >= 9,
        },
      ]
    : [];

  const ladderRows: LadderRow[] = strategy && funding
    ? [
        {
          instrument: 'Equity Raise',
          amount: strategy.recommendedRaise,
          coverage: strategy.monthlyBurn > 0 ? `${(strategy.recommendedRaise / strategy.monthlyBurn).toFixed(1)} mo` : 'N/A',
          signal: `Dilution ${strategy.dilutionEstimatePct.toFixed(1)}%`,
          status: strategy.recommendedRaise > 0 ? 'Recommended' : 'Optional',
          statusColor: strategy.recommendedRaise > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
        },
        {
          instrument: 'Debt Facility',
          amount: strategy.debtCapacity,
          coverage: strategy.monthlyBurn > 0 ? `${(strategy.debtCapacity / strategy.monthlyBurn).toFixed(1)} mo` : 'N/A',
          signal: `Outstanding ${formatCompact(funding.totalDebt)}`,
          status: strategy.debtCapacity > 0 ? 'Available' : 'Constrained',
          statusColor: strategy.debtCapacity > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
        },
        {
          instrument: 'Current Cash',
          amount: funding.currentCash,
          coverage: `${funding.runwayMonths.toFixed(1)} mo`,
          signal: `Burn ${formatCompact(funding.monthlyBurn)}`,
          status: funding.runwayMonths >= 9 ? 'Healthy' : 'Watch',
          statusColor: funding.runwayMonths >= 9 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
        },
        {
          instrument: 'Equity Base',
          amount: funding.totalEquity,
          coverage: 'Balance sheet support',
          signal: `Debt headroom ${formatCompact(strategy.debtCapacity)}`,
          status: funding.totalEquity > 0 ? 'Supporting' : 'Thin',
          statusColor: funding.totalEquity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
        },
      ]
    : [];

  const ordersRange = useMemo(() => {
    const base = latestOrdersPerDay || 320;
    return [0.8, 0.9, 1.0, 1.1, 1.2].map((multiplier) => Math.round(base * multiplier));
  }, [latestOrdersPerDay]);

  const aspRange = useMemo(() => {
    const base = latestAov || 40;
    return [0.9, 0.95, 1.0, 1.05, 1.1].map((multiplier) => Number((base * multiplier).toFixed(1)));
  }, [latestAov]);

  const sensitivityMatrix = useMemo(() => {
    const baseOrders = latestOrdersPerDay || 320;
    const baseAov = latestAov || 40;
    const dilutionPenalty = (strategy?.dilutionEstimatePct || 0) / 4;
    const unitMarginLift = latestEbitdaPerOrder * 1.6;

    return ordersRange.map((orders) =>
      aspRange.map((asp) => {
        const ordersEffect = ((orders / baseOrders) - 1) * 40;
        const aspEffect = ((asp / baseAov) - 1) * 32;
        const score = 14 + ordersEffect + aspEffect + unitMarginLift - dilutionPenalty;
        return Number(Math.max(score, 2).toFixed(1));
      })
    );
  }, [aspRange, latestAov, latestEbitdaPerOrder, latestOrdersPerDay, ordersRange, strategy?.dilutionEstimatePct]);

  const capTable: CapTableRow[] = useMemo(() => {
    const totalShares = 10_000_000;
    const newMoneyPct = Math.min(strategy?.dilutionEstimatePct || 0, 100);
    const employeePoolPct = 10;
    const existingInvestorPct = 18;
    const founderPct = Math.max(100 - existingInvestorPct - employeePoolPct - newMoneyPct, 0);
    const postMoneyValue = (funding?.totalEquity || 0) + (strategy?.recommendedRaise || 0);
    const valueFor = (pct: number) => formatCompact(postMoneyValue * (pct / 100));

    return [
      { round: 'Founders', shares: Math.round(totalShares * (founderPct / 100)).toLocaleString(), pct: `${founderPct.toFixed(1)}%`, value: valueFor(founderPct) },
      { round: 'Existing Investors', shares: Math.round(totalShares * (existingInvestorPct / 100)).toLocaleString(), pct: `${existingInvestorPct.toFixed(1)}%`, value: valueFor(existingInvestorPct) },
      { round: 'ESOP Pool', shares: Math.round(totalShares * (employeePoolPct / 100)).toLocaleString(), pct: `${employeePoolPct.toFixed(1)}%`, value: valueFor(employeePoolPct) },
      { round: 'New Money', shares: Math.round(totalShares * (newMoneyPct / 100)).toLocaleString(), pct: `${newMoneyPct.toFixed(1)}%`, value: valueFor(newMoneyPct) },
    ];
  }, [funding?.totalEquity, strategy?.dilutionEstimatePct, strategy?.recommendedRaise]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1E5B9C]" /> Capital Strategy & Raise Planning
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.periodLabel} — {ctx.scenarioName}
            <DataFreshness source={loading ? 'loading' : error ? 'static' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Instrument', 'Amount', 'Coverage', 'Signal', 'Status'];
              const rows = ladderRows.map((row) => [row.instrument, row.amount, row.coverage, row.signal, row.status]);
              exportCSV('CapitalStrategy', headers, rows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const headers = ['Instrument', 'Amount', 'Coverage', 'Signal', 'Status'];
              const rows = ladderRows.map((row) => [row.instrument, row.amount, row.coverage, row.signal, row.status]);
              exportPDF('Capital Strategy', headers, rows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Failed to load capital strategy</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && kpis.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1a2744]/20 transition">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
                  <p className={`text-[10px] font-medium mt-1 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{kpi.delta}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Capital Recommendation Ladder</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Instrument', 'Amount', 'Coverage', 'Signal', 'Status'].map((header) => (
                        <th key={header} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ladderRows.map((row, index) => (
                      <tr key={row.instrument} className={`hover:bg-blue-50/30 transition ${index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                        <td className="px-4 py-2.5 font-bold text-gray-800">{row.instrument}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{formatCompact(row.amount)}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{row.coverage}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.signal}</td>
                        <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.statusColor}`}>{row.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">5×5 Return Sensitivity Matrix — Estimated IRR %</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-[8px] font-bold text-gray-400 uppercase pb-2 text-left">Orders/Day ↓  ASP →</th>
                        {aspRange.map((asp) => (
                          <th key={asp} className="text-center text-[9px] font-bold text-gray-500 pb-2 px-1">AED {asp}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordersRange.map((orders, rowIndex) => (
                        <tr key={orders}>
                          <td className="text-[9px] font-bold text-gray-500 pr-2 py-1">{orders}</td>
                          {sensitivityMatrix[rowIndex].map((value, columnIndex) => (
                            <td key={`${orders}-${columnIndex}`} className="p-0.5">
                              <div className={`w-full py-2 rounded text-center text-[11px] font-bold ${cellColor(value)}`}>
                                {value}%
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] text-gray-400 text-center mt-3">
                  Matrix is anchored to the live latest-period unit economics and capital plan inputs for the selected scenario.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Cap Table — Post Raise View</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['Round', 'Shares', 'Ownership', 'Value'].map((header) => (
                          <th key={header} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {capTable.map((row, index) => (
                        <tr key={row.round} className={`hover:bg-blue-50/30 transition ${index === capTable.length - 1 ? 'bg-blue-50/50 border-t-2 border-blue-200' : index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                          <td className="px-4 py-2.5 font-bold text-gray-800">{row.round}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-700">{row.shares}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#1B2A4A]">{row.pct}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 text-[11px] text-gray-500">
                  Latest live unit metrics: {latestOrdersPerDay.toFixed(0)} orders/day, AED {latestAov.toFixed(1)} AOV, AED {latestEbitdaPerOrder.toFixed(1)} EBITDA/order, {latestPayback.toFixed(0)} month payback.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
