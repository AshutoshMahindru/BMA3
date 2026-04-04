"use client";

import { useEffect, useMemo, useState } from 'react';
import { Banknote, Download, Printer, TrendingDown } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getFinancialsCapitalStrategy,
  getFinancialsCashFlow,
  getFinancialsFundingSummary,
} from '@/lib/api-client';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════ S04: Cash & Funding Console ══════════════════════ */

interface FinancialLineItem {
  label: string;
  values: number[];
  fy: number;
}

interface CashFlowPayload {
  periods: string[];
  lineItems: FinancialLineItem[];
}

interface FundingSummary {
  currentCash: number;
  runwayMonths: number;
  monthlyBurn: number;
  totalDebt: number;
  totalEquity: number;
  recommendedRaise: number;
}

interface CapitalStrategy {
  currentCash: number;
  monthlyBurn: number;
  runwayMonths: number;
  debtCapacity: number;
  dilutionEstimatePct: number;
  recommendedRaise: number;
  nextRaiseWindowMonths: number;
}

interface FundingEvent {
  event: string;
  date: string;
  amount: string;
  type: string;
  status: string;
  statusColor: string;
}

function emptyCashFlow(): CashFlowPayload {
  return { periods: [], lineItems: [] };
}

function lineValues(payload: CashFlowPayload, label: string) {
  return payload.lineItems.find((item) => item.label === label)?.values || [];
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  return `AED ${(value / 1000).toFixed(0)}K`;
}

function formatTableValue(value: number) {
  if (value === 0) return '—';
  const negative = value < 0;
  const absolute = Math.round(Math.abs(value));
  return `${negative ? '(' : ''}${absolute.toLocaleString()}${negative ? ')' : ''}`;
}

export default function CashFundingConsole() {
  const ctx = usePlanningContext();

  const [cashFlow, setCashFlow] = useState<CashFlowPayload>(emptyCashFlow());
  const [fundingSummary, setFundingSummary] = useState<FundingSummary | null>(null);
  const [capitalStrategy, setCapitalStrategy] = useState<CapitalStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getFinancialsCashFlow({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
      getFinancialsFundingSummary({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
      getFinancialsCapitalStrategy({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
      }),
    ])
      .then(([cashFlowResult, fundingResult, capitalResult]) => {
        if (!cashFlowResult.data || !fundingResult.data || !capitalResult.data) {
          throw new Error(
            cashFlowResult.error ||
              fundingResult.error ||
              capitalResult.error ||
              'Failed to load cash & funding data'
          );
        }

        setCashFlow(cashFlowResult.data as CashFlowPayload);
        setFundingSummary(fundingResult.data as FundingSummary);
        setCapitalStrategy(capitalResult.data as CapitalStrategy);
        setLastFetched(new Date().toISOString());
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load cash & funding data');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const months = useMemo(
    () => cashFlow.periods.map((period) => period.split(' ')[0]),
    [cashFlow.periods]
  );
  const openingBalance = lineValues(cashFlow, 'Opening Balance');
  const operatingCashflow = lineValues(cashFlow, 'Operating Cashflow');
  const investingCashflow = lineValues(cashFlow, 'Investing Cashflow');
  const financingCashflow = lineValues(cashFlow, 'Financing Cashflow');
  const closingBalance = lineValues(cashFlow, 'Closing Balance');
  const netChange = lineValues(cashFlow, 'Net Change');
  const burnRateMonthly = netChange.map((value) => Math.abs(Math.min(value, 0)));
  const maxBurn = Math.max(1, ...burnRateMonthly);

  const kpis = fundingSummary && capitalStrategy
    ? [
        {
          label: 'Cash Balance',
          value: formatCompact(fundingSummary.currentCash),
          delta: fundingSummary.currentCash >= 1_000_000 ? 'Strong liquidity buffer' : 'Tighter cash cushion',
          positive: fundingSummary.currentCash >= 1_000_000,
        },
        {
          label: 'Monthly Burn',
          value: formatCompact(fundingSummary.monthlyBurn),
          delta: fundingSummary.monthlyBurn <= 100_000 ? 'Below alert threshold' : 'Monitor burn closely',
          positive: fundingSummary.monthlyBurn <= 100_000,
        },
        {
          label: 'Runway',
          value: `${fundingSummary.runwayMonths.toFixed(1)} Months`,
          delta: fundingSummary.runwayMonths >= 9 ? 'Healthy runway' : 'Raise planning active',
          positive: fundingSummary.runwayMonths >= 9,
        },
        {
          label: 'Recommended Raise',
          value: formatCompact(capitalStrategy.recommendedRaise),
          delta: capitalStrategy.nextRaiseWindowMonths > 0 ? `Window in ~${capitalStrategy.nextRaiseWindowMonths.toFixed(0)} mo` : 'Raise now if pursued',
          positive: capitalStrategy.recommendedRaise === 0,
        },
        {
          label: 'Debt Outstanding',
          value: formatCompact(fundingSummary.totalDebt),
          delta: `Capacity remaining ${formatCompact(capitalStrategy.debtCapacity)}`,
          positive: capitalStrategy.debtCapacity > 0,
        },
      ]
    : [];

  const fundingEvents: FundingEvent[] = [];
  financingCashflow.forEach((value, index) => {
    if (value > 0) {
      fundingEvents.push({
        event: `Capital Inflow ${fundingEvents.length + 1}`,
        date: cashFlow.periods[index] || `Period ${index + 1}`,
        amount: formatCompact(value),
        type: 'Funding Inflow',
        status: 'Funded',
        statusColor: 'bg-green-100 text-green-700',
      });
    }
  });

  if (capitalStrategy && capitalStrategy.recommendedRaise > 0) {
    fundingEvents.push({
      event: 'Recommended Raise',
      date: capitalStrategy.nextRaiseWindowMonths > 0 ? `~${capitalStrategy.nextRaiseWindowMonths.toFixed(0)} mo` : 'Immediate',
      amount: formatCompact(capitalStrategy.recommendedRaise),
      type: 'Equity Planning',
      status: 'Open',
      statusColor: 'bg-amber-100 text-amber-700',
    });
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1E5B9C]" /> Cash & Funding Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.periodLabel} — {ctx.scenarioName}
            <DataFreshness source={loading ? 'loading' : error ? 'static' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Line', ...months];
              const rows = [
                ['Opening Balance', ...openingBalance],
                ['Operating CF', ...operatingCashflow],
                ['Investing CF', ...investingCashflow],
                ['Funding Events', ...financingCashflow],
                ['Closing Balance', ...closingBalance],
              ];
              exportCSV('CashFlow_Monthly', headers, rows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const headers = ['Line', ...months];
              const rows = [
                ['Opening Balance', ...openingBalance],
                ['Operating CF', ...operatingCashflow],
                ['Investing CF', ...investingCashflow],
                ['Funding Events', ...financingCashflow],
                ['Closing Balance', ...closingBalance],
              ];
              exportPDF('Cash Flow Monthly', headers, rows);
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
            <p className="text-sm font-semibold text-red-800">Failed to load cash & funding data</p>
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
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Monthly Cash Flow Waterfall (AED K)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider w-32">Line</th>
                      {months.map((month) => (
                        <th key={month} className="px-2 py-2.5 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Opening Balance', openingBalance],
                      ['Operating CF', operatingCashflow],
                      ['Investing CF', investingCashflow],
                      ['Funding Events', financingCashflow],
                      ['Closing Balance', closingBalance],
                    ].map(([label, values], rowIndex) => {
                      const isBold = label === 'Closing Balance';
                      return (
                        <tr key={label as string} className={`${rowIndex % 2 === 1 ? 'bg-[#F4F5F7]' : ''} ${isBold ? 'border-t-2 border-[#1B2A4A]' : 'border-b border-gray-50'}`}>
                          <td className={`px-4 py-2 ${isBold ? 'font-bold text-[#1B2A4A]' : 'font-semibold text-gray-700'}`}>{label}</td>
                          {(values as number[]).map((value, index) => (
                            <td key={`${label}-${index}`} className={`px-2 py-2 text-right font-mono ${value < 0 ? 'text-[#C0392B]' : value === 0 ? 'text-gray-300' : isBold ? 'font-bold text-[#1B2A4A]' : 'text-gray-700'}`}>
                              {formatTableValue(value)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Funding Events Timeline</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['Event', 'Date', 'Amount', 'Type', 'Status'].map((header) => (
                          <th key={header} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fundingEvents.length > 0 ? fundingEvents.map((event, index) => (
                        <tr key={`${event.event}-${index}`} className={`hover:bg-blue-50/30 transition ${index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                          <td className="px-4 py-2.5 font-bold text-gray-800">{event.event}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-600">{event.date}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{event.amount}</td>
                          <td className="px-4 py-2.5 text-gray-600">{event.type}</td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${event.statusColor}`}>{event.status}</span></td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No funding events recorded for the selected plan.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Burn Rate Trend (AED K/month)</h3>
                <div className="flex items-end justify-between gap-2 h-36">
                  {burnRateMonthly.map((value, index) => (
                    <div key={months[index] || index} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="text-[8px] font-bold text-gray-500 mb-1">{Math.round(value / 1000)}</span>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${(value / maxBurn) * 100}%`,
                          minHeight: '4px',
                          backgroundColor: value > 180000 ? '#C0392B' : value > 120000 ? '#C47A1E' : '#1A7A4A',
                        }}
                      />
                      <span className="text-[7px] text-gray-400 mt-1 font-medium">{months[index]}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-3 flex items-center justify-center gap-2">
                  <TrendingDown className="w-3 h-3 text-[#1A7A4A]" />
                  Burn profile is computed from the live monthly net-change series for the selected scenario.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
