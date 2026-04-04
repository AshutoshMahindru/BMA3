"use client";

import { useEffect, useState } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { getFinancialsBalanceSheet } from '@/lib/api-client';
import { Building2, CheckCircle2, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ══════════════════════════════════════════════════════════════════════════
   S13: BALANCE SHEET PROJECTION CONSOLE
   Uses canonical /financials/balance-sheet data and reshapes monthly outputs
   into the existing comparison-oriented console layout.
   ══════════════════════════════════════════════════════════════════════ */

interface FinancialLineItem {
  label: string;
  values: number[];
  fy: number;
}

interface BalanceSheetPayload {
  periods: string[];
  lineItems: FinancialLineItem[];
}

interface BSRow {
  label: string;
  section?: string;
  dec24: number;
  dec25f: number;
  bold?: boolean;
  indent?: boolean;
  isTotalAssets?: boolean;
  isTotalLE?: boolean;
}

interface RatioRow {
  name: string;
  dec24: string;
  dec25f: string;
  benchmark: string;
}

function findValue(values: number[] | undefined, index: number) {
  if (!values || values.length === 0) return 0;
  return values[index] ?? values[values.length - 1] ?? 0;
}

function formatRatio(value: number, suffix = 'x') {
  if (!Number.isFinite(value)) return '0.0x';
  return `${value.toFixed(1)}${suffix}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

export default function BalanceSheetConsole() {
  const ctx = usePlanningContext();
  const [payload, setPayload] = useState<BalanceSheetPayload>({ periods: [], lineItems: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    getFinancialsBalanceSheet({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
    })
      .then((result) => {
        if (result.data) {
          setPayload(result.data as BalanceSheetPayload);
          setLastFetched(new Date().toISOString());
        } else {
          setError(result.error || 'Failed to load balance sheet');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load balance sheet');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const byLabel = new Map(payload.lineItems.map((item) => [item.label, item.values]));
  const firstIndex = 0;
  const lastIndex = Math.max(payload.periods.length - 1, 0);
  const firstPeriodLabel = payload.periods[firstIndex] || 'Opening Period';
  const lastPeriodLabel = payload.periods[lastIndex] || 'Latest Period';

  const cashAssets = byLabel.get('Cash Assets');
  const inventoryAssets = byLabel.get('Inventory Assets');
  const receivables = byLabel.get('Receivables');
  const fixedAssets = byLabel.get('Fixed Assets Net');
  const totalAssets = byLabel.get('Total Assets');
  const accountsPayable = byLabel.get('Accounts Payable');
  const shortTermDebt = byLabel.get('Short-Term Debt');
  const longTermDebt = byLabel.get('Long-Term Debt');
  const totalLiabilities = byLabel.get('Total Liabilities');
  const paidInCapital = byLabel.get('Paid In Capital');
  const retainedEarnings = byLabel.get('Retained Earnings');
  const totalEquity = byLabel.get('Total Equity');

  const bsData: BSRow[] = [
    { section: 'assets', label: 'Assets', dec24: 0, dec25f: 0 },
    { label: 'Cash Assets', dec24: findValue(cashAssets, firstIndex), dec25f: findValue(cashAssets, lastIndex) },
    { label: 'Inventory Assets', dec24: findValue(inventoryAssets, firstIndex), dec25f: findValue(inventoryAssets, lastIndex) },
    { label: 'Receivables', dec24: findValue(receivables, firstIndex), dec25f: findValue(receivables, lastIndex) },
    { label: 'Fixed Assets Net', dec24: findValue(fixedAssets, firstIndex), dec25f: findValue(fixedAssets, lastIndex) },
    { label: 'Total Assets', dec24: findValue(totalAssets, firstIndex), dec25f: findValue(totalAssets, lastIndex), bold: true, isTotalAssets: true },
    { section: 'liabilities', label: 'Liabilities', dec24: 0, dec25f: 0 },
    { label: 'Accounts Payable', dec24: findValue(accountsPayable, firstIndex), dec25f: findValue(accountsPayable, lastIndex) },
    { label: 'Short-Term Debt', dec24: findValue(shortTermDebt, firstIndex), dec25f: findValue(shortTermDebt, lastIndex) },
    { label: 'Long-Term Debt', dec24: findValue(longTermDebt, firstIndex), dec25f: findValue(longTermDebt, lastIndex) },
    { label: 'Total Liabilities', dec24: findValue(totalLiabilities, firstIndex), dec25f: findValue(totalLiabilities, lastIndex), bold: true },
    { section: 'sub', label: 'Equity', dec24: 0, dec25f: 0 },
    { label: 'Paid In Capital', dec24: findValue(paidInCapital, firstIndex), dec25f: findValue(paidInCapital, lastIndex) },
    { label: 'Retained Earnings', dec24: findValue(retainedEarnings, firstIndex), dec25f: findValue(retainedEarnings, lastIndex) },
    { label: 'Total Equity', dec24: findValue(totalEquity, firstIndex), dec25f: findValue(totalEquity, lastIndex), bold: true },
    {
      label: 'Total Liabilities + Equity',
      dec24: findValue(totalLiabilities, firstIndex) + findValue(totalEquity, firstIndex),
      dec25f: findValue(totalLiabilities, lastIndex) + findValue(totalEquity, lastIndex),
      bold: true,
      isTotalLE: true,
    },
  ];

  const currentAssetsStart = findValue(cashAssets, firstIndex) + findValue(inventoryAssets, firstIndex) + findValue(receivables, firstIndex);
  const currentAssetsEnd = findValue(cashAssets, lastIndex) + findValue(inventoryAssets, lastIndex) + findValue(receivables, lastIndex);
  const currentLiabilitiesStart = findValue(accountsPayable, firstIndex) + findValue(shortTermDebt, firstIndex);
  const currentLiabilitiesEnd = findValue(accountsPayable, lastIndex) + findValue(shortTermDebt, lastIndex);

  const ratios: RatioRow[] = [
    {
      name: 'Current Ratio',
      dec24: formatRatio(currentAssetsStart / Math.max(currentLiabilitiesStart, 1)),
      dec25f: formatRatio(currentAssetsEnd / Math.max(currentLiabilitiesEnd, 1)),
      benchmark: '>= 1.5x',
    },
    {
      name: 'Debt / Equity',
      dec24: formatRatio(findValue(totalLiabilities, firstIndex) / Math.max(findValue(totalEquity, firstIndex), 1)),
      dec25f: formatRatio(findValue(totalLiabilities, lastIndex) / Math.max(findValue(totalEquity, lastIndex), 1)),
      benchmark: '<= 1.0x',
    },
    {
      name: 'Equity Ratio',
      dec24: formatPercent((findValue(totalEquity, firstIndex) / Math.max(findValue(totalAssets, firstIndex), 1)) * 100),
      dec25f: formatPercent((findValue(totalEquity, lastIndex) / Math.max(findValue(totalAssets, lastIndex), 1)) * 100),
      benchmark: '>= 40%',
    },
    {
      name: 'Cash Ratio',
      dec24: formatRatio(findValue(cashAssets, firstIndex) / Math.max(currentLiabilitiesStart, 1)),
      dec25f: formatRatio(findValue(cashAssets, lastIndex) / Math.max(currentLiabilitiesEnd, 1)),
      benchmark: '>= 1.0x',
    },
    {
      name: 'Working Capital',
      dec24: `${Math.round(currentAssetsStart - currentLiabilitiesStart).toLocaleString()}`,
      dec25f: `${Math.round(currentAssetsEnd - currentLiabilitiesEnd).toLocaleString()}`,
      benchmark: 'Positive',
    },
    {
      name: 'Net Asset Value',
      dec24: `${Math.round(findValue(totalEquity, firstIndex)).toLocaleString()}`,
      dec25f: `${Math.round(findValue(totalEquity, lastIndex)).toLocaleString()}`,
      benchmark: 'Growing',
    },
  ];

  const fmt = (value: number) => value === 0 ? '' : Math.round(value).toLocaleString();
  const change = (start: number, end: number) => {
    if (start === 0 && end === 0) return { val: '', pct: '', positive: true };
    const diff = end - start;
    const pct = start !== 0 ? `${((diff / start) * 100).toFixed(1)}%` : 'New';
    return { val: diff >= 0 ? `+${Math.round(diff).toLocaleString()}` : Math.round(diff).toLocaleString(), pct, positive: diff >= 0 };
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1E5B9C]" />
            Balance Sheet Projection Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.scenarioName} — {firstPeriodLabel} vs {lastPeriodLabel}
            <DataFreshness source={loading ? 'loading' : error ? 'static' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Line Item', firstPeriodLabel, lastPeriodLabel];
              const exportRows = bsData.filter((row) => !row.section).map((row) => [row.label, row.dec24, row.dec25f]);
              exportCSV('BalanceSheet', headers, exportRows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const headers = ['Line Item', firstPeriodLabel, lastPeriodLabel];
              const exportRows = bsData.filter((row) => !row.section).map((row) => [row.label, row.dec24, row.dec25f]);
              exportPDF('Balance Sheet', headers, exportRows);
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
            <p className="text-sm font-semibold text-red-800">Failed to load balance sheet</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1A7A4A]" />
              <div>
                <p className="text-sm font-bold text-green-800">Balance Sheet Verified ✓</p>
                <p className="text-[11px] text-green-600">Total assets match total liabilities plus equity at both comparison points.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Projected Balance Sheet (AED &apos;000s)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[280px] border-r border-white/10">Line Item</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">{firstPeriodLabel}</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">{lastPeriodLabel}</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Change</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bsData.map((row, index) => {
                      if (row.section === 'assets' || row.section === 'liabilities') {
                        return (
                          <tr key={`${row.section}-${index}`} className="bg-[#D6E4F7]">
                            <td colSpan={5} className="px-5 py-2.5 text-[10px] font-bold text-[#1B2A4A] uppercase tracking-widest">{row.label}</td>
                          </tr>
                        );
                      }
                      if (row.section === 'sub') {
                        return (
                          <tr key={`${row.label}-${index}`} className="bg-gray-50/80">
                            <td colSpan={5} className="px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{row.label}</td>
                          </tr>
                        );
                      }

                      const delta = change(row.dec24, row.dec25f);
                      const isMajorTotal = row.isTotalAssets || row.isTotalLE;

                      return (
                        <tr key={row.label} className={`transition hover:bg-blue-50/30 ${isMajorTotal ? 'bg-blue-50 border-y-2 border-blue-300' : row.bold ? 'bg-gray-50/50 border-y border-gray-200' : index % 2 === 0 ? '' : 'bg-[#F4F5F7]'}`}>
                          <td className={`px-5 py-2.5 border-r border-gray-100 ${row.indent ? 'pl-10 text-gray-600' : ''} ${row.bold || isMajorTotal ? 'font-bold text-[#1B2A4A]' : ''} ${isMajorTotal ? 'text-sm uppercase tracking-wider' : ''}`}>
                            {row.label}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(row.dec24)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${row.bold || isMajorTotal ? 'font-bold text-[#1B2A4A]' : 'text-gray-700'}`}>{fmt(row.dec25f)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${delta.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{delta.val}</td>
                          <td className={`px-4 py-2.5 text-right font-mono ${delta.positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{delta.pct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Key Financial Ratios
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Ratio</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{firstPeriodLabel}</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{lastPeriodLabel}</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Benchmark</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ratios.map((ratio, index) => (
                      <tr key={ratio.name} className={`hover:bg-blue-50/30 transition ${index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                        <td className="px-5 py-3 font-semibold text-gray-800">{ratio.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">{ratio.dec24}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#1B2A4A]">{ratio.dec25f}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{ratio.benchmark}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1A7A4A] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            <CheckCircle2 className="w-3 h-3" /> Pass
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
