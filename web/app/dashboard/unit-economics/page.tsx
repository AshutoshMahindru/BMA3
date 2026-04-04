"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { Calculator, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';
import { getFinancialsUnitEconomics } from '@/lib/api-client';

/* ══════════════════════════════════════════════════════════════════════════
   S14: UNIT ECONOMICS CONSOLE
   Canonical /financials/unit-economics implementation.
   ══════════════════════════════════════════════════════════════════════ */

interface FinancialLineItem {
  label: string;
  values: number[];
  fy: number;
}

interface UnitEconomicsPayload {
  periods: string[];
  lineItems: FinancialLineItem[];
}

interface WaterfallRow {
  label: string;
  value: number;
  type?: 'cost' | 'margin' | 'revenue';
  marginLabel?: string;
}

function lineValues(payload: UnitEconomicsPayload | null, label: string) {
  return payload?.lineItems.find((item) => item.label === label)?.values || [];
}

function latestValue(values: number[]) {
  return values.length > 0 ? values[values.length - 1] : 0;
}

function fmtAed(value: number) {
  return `AED ${Math.abs(value).toFixed(1)}`;
}

export default function UnitEconomicsConsole() {
  const ctx = usePlanningContext();

  const [payload, setPayload] = useState<UnitEconomicsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx.companyId || !ctx.scenarioId) return;

    setLoading(true);
    setError(null);

    getFinancialsUnitEconomics({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      ...(ctx.periodStart ? { periodId: ctx.periodStart } : {}),
    })
      .then((result) => {
        if (!result.data) {
          throw new Error(result.error || 'Failed to load unit economics');
        }

        setPayload(result.data as UnitEconomicsPayload);
        setLastFetched(new Date().toISOString());
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load unit economics');
      })
      .finally(() => setLoading(false));
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart]);

  const periods = useMemo(() => payload?.periods || [], [payload]);
  const aovValues = lineValues(payload, 'AOV');
  const cacValues = lineValues(payload, 'CAC');
  const clvValues = lineValues(payload, 'CLV');
  const ordersValues = lineValues(payload, 'Orders / Day');
  const cm1Values = lineValues(payload, 'Contribution Margin 1');
  const cm2Values = lineValues(payload, 'Contribution Margin 2');
  const ebitdaValues = lineValues(payload, 'EBITDA / Order');
  const paybackValues = lineValues(payload, 'Payback Months');

  const latestAov = latestValue(aovValues);
  const latestCac = latestValue(cacValues);
  const latestClv = latestValue(clvValues);
  const latestCm1 = latestValue(cm1Values);
  const latestCm2 = latestValue(cm2Values);
  const latestEbitda = latestValue(ebitdaValues);
  const latestPayback = latestValue(paybackValues);

  const waterfall: WaterfallRow[] = [
    { label: 'Gross Order Value', value: latestAov, type: 'revenue' },
    { label: 'Customer Acquisition Cost', value: latestCac, type: 'cost' },
    { label: 'Contribution Margin 1', value: latestCm1, type: 'margin', marginLabel: 'CM1' },
    { label: 'Kitchen Conversion Cost', value: Math.max(latestCm1 - latestCm2, 0), type: 'cost' },
    { label: 'Contribution Margin 2', value: latestCm2, type: 'margin', marginLabel: 'CM2' },
    { label: 'Allocated Overhead', value: Math.max(latestCm2 - latestEbitda, 0), type: 'cost' },
    { label: 'EBITDA / Order', value: latestEbitda, type: 'margin', marginLabel: 'EBITDA' },
    { label: 'CLV', value: latestClv, type: 'revenue' },
  ];

  const maxWaterfall = Math.max(1, ...waterfall.map((row) => Math.abs(row.value)));

  const rankingRows = useMemo(() => {
    return periods
      .map((period, index) => {
        const ordersPerDay = ordersValues[index] || 0;
        const aov = aovValues[index] || 0;
        const cm2 = cm2Values[index] || 0;
        const ebitdaPerOrder = ebitdaValues[index] || 0;
        const payback = paybackValues[index] || 0;

        return {
          period,
          orders: Math.round(ordersPerDay * 30),
          aov,
          cm2,
          cm2Pct: aov > 0 ? (cm2 / aov) * 100 : 0,
          ebitdaPerOrder,
          payback,
        };
      })
      .sort((left, right) => right.ebitdaPerOrder - left.ebitdaPerOrder)
      .slice(0, 5);
  }, [aovValues, cm2Values, ebitdaValues, ordersValues, paybackValues, periods]);

  const paybackCurve = useMemo(() => {
    const monthlyContribution = periods.map((_, index) => (ordersValues[index] || 0) * 30 * (ebitdaValues[index] || 0));
    const averagePaybackMonths = paybackValues.length > 0
      ? paybackValues.reduce((sum, value) => sum + value, 0) / paybackValues.length
      : 12;
    const initialInvestment = (monthlyContribution[0] || 0) * Math.max(averagePaybackMonths, 1);

    let cumulative = -initialInvestment;
    return monthlyContribution.map((value, index) => {
      cumulative += value;
      return {
        month: index + 1,
        label: periods[index] || `Month ${index + 1}`,
        cumCF: cumulative,
      };
    });
  }, [ebitdaValues, ordersValues, paybackValues, periods]);

  const maxPositive = Math.max(1, ...paybackCurve.map((point) => point.cumCF), 0);
  const maxNegative = Math.min(0, ...paybackCurve.map((point) => point.cumCF));
  const curveScale = Math.max(Math.abs(maxNegative), Math.abs(maxPositive), 1);
  const breakevenPoint = paybackCurve.find((point) => point.cumCF >= 0) || null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1E5B9C]" />
            Unit Economics Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.scenarioName} — Per-Order Breakdown
            <DataFreshness source={loading ? 'loading' : error ? 'static' : 'api'} lastFetched={lastFetched ? new Date(lastFetched) : null} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ['Line Item', 'AED/Order'];
              const rows = waterfall.map((row) => [row.label, row.value]);
              exportCSV('UnitEconomics', headers, rows);
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => {
              const headers = ['Line Item', 'AED/Order'];
              const rows = waterfall.map((row) => [row.label, row.value]);
              exportPDF('Unit Economics', headers, rows);
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
            <p className="text-sm font-semibold text-red-800">Failed to load unit economics</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && payload && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Per-Order Economics Waterfall (GOV → EBITDA)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[260px] border-r border-white/10">Line Item</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider w-[100px]">AED / Order</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider w-[80px]">% of GOV</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider w-[80px]">Margin</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waterfall.map((row, index) => {
                      const pctOfGov = latestAov > 0 ? (row.value / latestAov) * 100 : 0;
                      const barWidth = (Math.abs(row.value) / maxWaterfall) * 100;
                      const isMargin = row.type === 'margin';
                      const isCost = row.type === 'cost';

                      return (
                        <tr key={row.label} className={`transition hover:bg-blue-50/30 ${isMargin ? 'bg-blue-50/50 border-y border-blue-200' : index % 2 === 0 ? '' : 'bg-[#F4F5F7]'}`}>
                          <td className={`px-5 py-3 border-r border-gray-100 ${isMargin ? 'font-bold text-[#1B2A4A]' : isCost ? 'pl-10 text-gray-600' : 'font-semibold text-gray-800'}`}>
                            {row.label}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${isMargin ? 'font-bold text-[#1B2A4A]' : isCost ? 'text-[#C0392B]' : 'text-gray-800 font-semibold'}`}>
                            {isCost ? `(${fmtAed(row.value)})` : fmtAed(row.value)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">
                            {Math.abs(pctOfGov).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.marginLabel && (
                              <span className="text-[10px] font-bold text-white bg-[#1E5B9C] px-2 py-0.5 rounded">
                                {row.marginLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-4 flex items-center">
                              <div
                                className={`h-3 rounded ${isMargin ? 'bg-[#1E5B9C]' : isCost ? 'bg-[#C0392B]/60' : 'bg-[#1A7A4A]'}`}
                                style={{ width: `${barWidth}%`, maxWidth: '200px' }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Period Ranking — Unit Economics
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['#', 'Period', 'Monthly Orders', 'AOV', 'CM2/Order', 'CM2 %', 'EBITDA/Order', 'Payback'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rankingRows.map((row, index) => (
                        <tr key={row.period} className={`hover:bg-blue-50/30 transition ${index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                          <td className="px-3 py-2.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>{index + 1}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800">{row.period}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{row.orders.toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">AED {row.aov.toFixed(1)}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#1A7A4A]">AED {row.cm2.toFixed(1)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{row.cm2Pct.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#1B2A4A]">AED {row.ebitdaPerOrder.toFixed(1)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row.payback <= 18 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {Math.round(row.payback)} mo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Payback Curve — Seeded Kitchen</h3>
                <svg viewBox="0 0 240 200" className="w-full h-auto">
                  {[40, 80, 120, 160].map((y) => (
                    <line key={y} x1="30" y1={y} x2="230" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  ))}
                  <line x1="30" y1="120" x2="230" y2="120" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
                  <text x="0" y="124" fontSize="7" fill="#94a3b8">AED 0</text>
                  <text x="0" y="44" fontSize="7" fill="#94a3b8">{`+${Math.round(maxPositive / 1000)}K`}</text>
                  <text x="0" y="164" fontSize="7" fill="#94a3b8">{`${Math.round(maxNegative / 1000)}K`}</text>

                  <polyline
                    points={paybackCurve.map((point, index) => {
                      const x = 30 + (index / Math.max(paybackCurve.length - 1, 1)) * 200;
                      const y = 120 - (point.cumCF / curveScale) * 80;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#1E5B9C"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={`30,120 ${paybackCurve.map((point, index) => {
                      const x = 30 + (index / Math.max(paybackCurve.length - 1, 1)) * 200;
                      const y = 120 - (point.cumCF / curveScale) * 80;
                      return `${x},${y}`;
                    }).join(' ')} 230,120`}
                    fill="url(#paybackGrad)"
                    opacity="0.3"
                  />
                  <defs>
                    <linearGradient id="paybackGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E5B9C" />
                      <stop offset="100%" stopColor="#1E5B9C" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {breakevenPoint && (
                    <>
                      <circle
                        cx={30 + ((breakevenPoint.month - 1) / Math.max(paybackCurve.length - 1, 1)) * 200}
                        cy={120 - (breakevenPoint.cumCF / curveScale) * 80}
                        r="4"
                        fill="#1A7A4A"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={30 + ((breakevenPoint.month - 1) / Math.max(paybackCurve.length - 1, 1)) * 200}
                        y="138"
                        fontSize="7"
                        fill="#1A7A4A"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        Month {breakevenPoint.month}
                      </text>
                    </>
                  )}

                  {paybackCurve.map((point, index) => (
                    <text
                      key={point.label}
                      x={30 + (index / Math.max(paybackCurve.length - 1, 1)) * 200}
                      y="190"
                      fontSize="7"
                      fill="#94a3b8"
                      textAnchor="middle"
                    >
                      {point.label.split(' ')[0]}
                    </text>
                  ))}
                </svg>
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-500">
                    Latest payback estimate is <span className="font-bold text-[#1A7A4A]">~{Math.round(latestPayback)} months</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Live curve uses the monthly EBITDA/order series and seeded kitchen throughput.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
