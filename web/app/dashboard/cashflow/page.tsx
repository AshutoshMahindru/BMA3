"use client";

import { useEffect, useState } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { getFinancialsCashFlow } from '@/lib/api-client';
import { Banknote, AlertTriangle, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════════════════════════════════════════════════════════
   S12: CASH FLOW PROJECTION CONSOLE
   Uses canonical /financials/cash-flow data and reshapes monthly outputs into
   the existing quarterly console layout.
   ══════════════════════════════════════════════════════════════════════ */

interface FinancialLineItem {
  label: string;
  values: number[];
  fy: number;
  bold?: boolean;
  highlight?: string;
}

interface CashFlowPayload {
  periods: string[];
  lineItems: FinancialLineItem[];
}

interface CFRow {
  label: string;
  section?: string;
  bold?: boolean;
  highlight?: boolean;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  fy?: number;
}

type QuarterMode = 'sum' | 'first' | 'last';

const quarterLabels = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'];

function emptyValues() {
  return Array.from({ length: 12 }, () => 0);
}

function quarterValue(values: number[], quarterIndex: number, mode: QuarterMode) {
  const start = quarterIndex * 3;
  const slice = values.slice(start, start + 3);
  if (slice.length === 0) return 0;
  if (mode === 'first') return slice[0];
  if (mode === 'last') return slice[slice.length - 1];
  return slice.reduce((sum, value) => sum + value, 0);
}

function buildQuarterRow(label: string, values: number[], mode: QuarterMode, options?: { bold?: boolean; highlight?: boolean }): CFRow {
  return {
    label,
    q1: quarterValue(values, 0, mode),
    q2: quarterValue(values, 1, mode),
    q3: quarterValue(values, 2, mode),
    q4: quarterValue(values, 3, mode),
    fy: mode === 'sum' ? values.reduce((sum, value) => sum + value, 0) : quarterValue(values, 3, 'last'),
    bold: options?.bold,
    highlight: options?.highlight,
  };
}

function buildCashflowRows(payload: CashFlowPayload): CFRow[] {
  const byLabel = new Map(payload.lineItems.map((item) => [item.label, item.values]));
  const opening = byLabel.get('Opening Balance') || emptyValues();
  const operating = byLabel.get('Operating Cashflow') || emptyValues();
  const investing = byLabel.get('Investing Cashflow') || emptyValues();
  const financing = byLabel.get('Financing Cashflow') || emptyValues();
  const netChange = byLabel.get('Net Change') || emptyValues();
  const closing = byLabel.get('Closing Balance') || emptyValues();
  const runway = byLabel.get('Cash Runway Months') || emptyValues();

  return [
    { section: 'operating', label: 'Operating Activities' },
    buildQuarterRow('Operating Cashflow', operating, 'sum'),
    { section: 'investing', label: 'Investing Activities' },
    buildQuarterRow('Investing Cashflow', investing, 'sum'),
    { section: 'financing', label: 'Financing Activities' },
    buildQuarterRow('Financing Cashflow', financing, 'sum'),
    { section: 'liquidity', label: 'Liquidity' },
    buildQuarterRow('Opening Balance', opening, 'first', { bold: true }),
    buildQuarterRow('Net Change', netChange, 'sum', { bold: true, highlight: true }),
    buildQuarterRow('Closing Balance', closing, 'last', { bold: true, highlight: true }),
    buildQuarterRow('Cash Runway Months', runway, 'last', { bold: true }),
  ];
}

function fmtValue(value: number) {
  if (value === 0) return '0';
  const negative = value < 0;
  const absolute = Math.abs(value);
  return `${negative ? '(' : ''}${absolute.toLocaleString()}${negative ? ')' : ''}`;
}

export default function CashflowConsole() {
  const ctx = usePlanningContext();
  const [payload, setPayload] = useState<CashFlowPayload>({ periods: [], lineItems: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    getFinancialsCashFlow({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
    })
      .then((result) => {
        if (result.data) {
          setPayload(result.data as CashFlowPayload);
          setLastFetched(new Date().toISOString());
        } else {
          setError(result.error || 'Failed to load cash flow');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load cash flow');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const rows = buildCashflowRows(payload);
  const lineMap = new Map(payload.lineItems.map((item) => [item.label, item.values]));
  const netChangeMonthly = lineMap.get('Net Change') || emptyValues();
  const closingMonthly = lineMap.get('Closing Balance') || emptyValues();
  const runwayMonthly = lineMap.get('Cash Runway Months') || emptyValues();
  const financingMonthly = lineMap.get('Financing Cashflow') || emptyValues();
  const averageBurn = netChangeMonthly.reduce((sum, value) => sum + Math.abs(Math.min(value, 0)), 0) / Math.max(netChangeMonthly.length, 1);
  const lastClosing = closingMonthly[closingMonthly.length - 1] || 0;
  const lastRunway = runwayMonthly[runwayMonthly.length - 1] || 0;
  const fyNetChange = netChangeMonthly.reduce((sum, value) => sum + value, 0);
  const totalFinancing = financingMonthly.reduce((sum, value) => sum + value, 0);

  const kpis = [
    { label: 'Closing Cash', value: `AED ${(lastClosing / 1000).toFixed(0)}K`, delta: fyNetChange >= 0 ? 'Positive FY cash generation' : 'Cash declined over FY', positive: fyNetChange >= 0, sub: 'Quarter 4 Exit' },
    { label: 'Avg Monthly Burn', value: `AED ${(averageBurn / 1000).toFixed(0)}K`, delta: averageBurn <= 85000 ? 'Inside seeded target band' : 'Above seeded target band', positive: averageBurn <= 85000, sub: 'Negative Months Only' },
    { label: 'Runway', value: `${lastRunway.toFixed(1)} Months`, delta: lastRunway >= 9 ? 'Healthy coverage' : 'Needs attention', positive: lastRunway >= 9, sub: 'Quarter 4 Exit' },
    { label: 'FY Financing', value: `AED ${(totalFinancing / 1000).toFixed(0)}K`, delta: totalFinancing > 0 ? 'External support injected' : 'No external funding', positive: totalFinancing > 0, sub: 'Total Raised' },
    { label: 'FY Net Change', value: `AED ${(fyNetChange / 1000).toFixed(0)}K`, delta: fyNetChange >= 0 ? 'Cash increased over year' : 'Cash burned over year', positive: fyNetChange >= 0, sub: 'Operating + Investing + Financing' },
  ];

  const fcfMonthly = payload.periods.map((period, index) => ({
    month: period.split(' ')[0],
    fcf: netChangeMonthly[index] || 0,
  }));
  const maxFCF = Math.max(1, ...fcfMonthly.map((item) => Math.abs(item.fcf)));
  const firstPositiveMonth = fcfMonthly.find((item) => item.fcf > 0)?.month || null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1E5B9C]" />
            Cash Flow Projection Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.scenarioName} — {ctx.periodLabel}
            <DataFreshness source={loading ? 'loading' : error ? 'static' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Line Item', ...quarterLabels, 'FY 2025'];
              const exportRows = rows.filter((row) => !row.section).map((row) => [row.label, row.q1 ?? 0, row.q2 ?? 0, row.q3 ?? 0, row.q4 ?? 0, row.fy ?? 0]);
              exportCSV('CashFlow', headers, exportRows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const headers = ['Line Item', ...quarterLabels, 'FY 2025'];
              const exportRows = rows.filter((row) => !row.section).map((row) => [row.label, row.q1 ?? 0, row.q2 ?? 0, row.q3 ?? 0, row.q4 ?? 0, row.fy ?? 0]);
              exportPDF('Cash Flow Statement', headers, exportRows);
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
            <p className="text-sm font-semibold text-red-800">Failed to load cash flow</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && rows.filter((row) => !row.section).length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-[#1B2A4A]/20 transition">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
                  <p className={`text-[10px] font-semibold mt-1 ${kpi.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{kpi.delta}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Quarterly Cash Flow Statement (AED &apos;000s)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[280px] border-r border-white/10">Line Item</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q1 2025</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q2 2025</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q3 2025</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Q4 2025</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider bg-white/10">FY 2025</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      if (row.section) {
                        return (
                          <tr key={`${row.section}-${index}`} className="bg-[#D6E4F7]">
                            <td colSpan={6} className="px-5 py-2.5 text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{row.label}</td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={row.label} className={`transition ${row.highlight ? 'bg-blue-50/50 border-y border-blue-200' : index % 2 === 0 ? '' : 'bg-[#F4F5F7]'} hover:bg-blue-50/30`}>
                          <td className={`px-5 py-2.5 border-r border-gray-100 ${row.bold ? 'font-bold text-[#1B2A4A]' : ''}`}>
                            {row.label}
                          </td>
                          {[row.q1, row.q2, row.q3, row.q4, row.fy].map((value, valueIndex) => (
                            <td
                              key={`${row.label}-${valueIndex}`}
                              className={`px-4 py-2.5 text-right font-mono ${row.bold ? 'font-bold text-[#1B2A4A]' : (value ?? 0) < 0 ? 'text-[#C0392B]' : 'text-gray-700'} ${valueIndex === 4 ? 'bg-gray-50/50 font-bold' : ''}`}
                            >
                              {fmtValue(value ?? 0)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800">Free Cash Flow — Rolling 12-Month Trend</h3>
                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1A7A4A]" /> Positive FCF</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#C0392B]" /> Negative FCF</span>
                </div>
              </div>
              <div className="h-48 flex items-end justify-between gap-2 relative">
                <div className="absolute left-0 right-0 border-t border-dashed border-gray-300" style={{ bottom: '50%' }}>
                  <span className="text-[9px] text-gray-400 font-bold absolute -left-0 -top-3">0</span>
                </div>
                {fcfMonthly.map((item) => {
                  const barHeight = (Math.abs(item.fcf) / maxFCF) * 44;
                  const negative = item.fcf < 0;
                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center justify-end h-full relative">
                      <div className="flex-1 flex items-end w-full justify-center" style={{ paddingBottom: negative ? '0' : '50%' }}>
                        {!negative && (
                          <div className="w-full max-w-[32px] bg-[#1A7A4A] rounded-t-md transition-all hover:opacity-80" style={{ height: `${barHeight}%` }} />
                        )}
                      </div>
                      {negative && (
                        <div className="w-full max-w-[32px] bg-[#C0392B] rounded-b-md transition-all hover:opacity-80" style={{ height: `${barHeight}%`, position: 'absolute', top: '50%' }} />
                      )}
                      <span className="text-[7px] text-gray-400 mt-1 font-medium absolute bottom-0">{item.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C47A1E]" />
                <p className="text-[11px] text-gray-500">
                  {firstPositiveMonth
                    ? `Free cash flow turns positive in ${firstPositiveMonth} 2025 in the seeded plan and remains positive through year-end.`
                    : 'Free cash flow stays negative across the selected period.'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
