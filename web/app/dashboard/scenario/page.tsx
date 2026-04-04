"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, Download, GitCompare, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { createAnalysisComparisons, getAnalysisSensitivity } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { exportCSV, exportPDF } from '@/lib/export';
import { asArray, asRecord, formatDate, formatMoney, formatPercent, titleCase, toNumber, toText } from '@/lib/phase5-utils';

interface ScenarioMetricRow {
  scenarioId: string;
  name: string;
  metrics: Record<string, number>;
}

interface ComparisonDelta {
  metric: string;
  baseScenarioId: string;
  compareScenarioId: string;
  baseValue: number;
  compareValue: number;
  delta: number;
  deltaPct: number;
}

interface SensitivityRow {
  driver: string;
  downside: number;
  upside: number;
}

function normalizeScenarioMetrics(raw: unknown): ScenarioMetricRow[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    const metricsRecord = asRecord(row.metrics);
    const metrics = Object.entries(metricsRecord).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = toNumber(value);
      return acc;
    }, {});

    return {
      scenarioId: toText(row.scenarioId, ''),
      name: toText(row.name, 'Scenario'),
      metrics,
    };
  }).filter((item) => item.scenarioId);
}

function normalizeDeltas(raw: unknown): ComparisonDelta[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    return {
      metric: toText(row.metric, 'metric'),
      baseScenarioId: toText(row.baseScenarioId, ''),
      compareScenarioId: toText(row.compareScenarioId, ''),
      baseValue: toNumber(row.baseValue),
      compareValue: toNumber(row.compareValue),
      delta: toNumber(row.delta),
      deltaPct: toNumber(row.deltaPct),
    };
  });
}

function normalizeSensitivity(raw: unknown): SensitivityRow[] {
  const value = asRecord(raw);

  return asArray(value.sensitivities).map((item) => {
    const row = asRecord(item);
    const impactRange = asRecord(row.impactRange);
    return {
      driver: toText(row.driver, 'Driver'),
      downside: toNumber(impactRange.downside),
      upside: toNumber(impactRange.upside),
    };
  });
}

export default function ScenarioComparisonConsole() {
  const ctx = usePlanningContext();
  const [scenarioRows, setScenarioRows] = useState<ScenarioMetricRow[]>([]);
  const [deltas, setDeltas] = useState<ComparisonDelta[]>([]);
  const [sensitivities, setSensitivities] = useState<SensitivityRow[]>([]);
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId || ctx.scenarios.length < 2) {
      setScenarioRows([]);
      setDeltas([]);
      setSensitivities([]);
      setComparisonId(null);
      setLastFetched(null);
      return;
    }

    const orderedScenarioIds = [
      ...(ctx.scenarioId ? [ctx.scenarioId] : []),
      ...ctx.scenarios.map((scenario) => scenario.scenarioId).filter((scenarioId) => scenarioId !== ctx.scenarioId),
    ].slice(0, 4);

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      createAnalysisComparisons({
        scenarioIds: orderedScenarioIds,
        metrics: ['revenue', 'ebitda', 'cash_runway'],
      }),
      getAnalysisSensitivity({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || orderedScenarioIds[0],
        targetMetric: 'EBITDA',
      }),
    ])
      .then(([comparisonResult, sensitivityResult]) => {
        if (cancelled) return;

        const comparison = asRecord(comparisonResult.data);
        setComparisonId(toText(comparison.comparisonId, ''));
        setScenarioRows(normalizeScenarioMetrics(comparison.scenarios));
        setDeltas(normalizeDeltas(comparison.deltas));
        setSensitivities(normalizeSensitivity(sensitivityResult.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load scenario comparison');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId, ctx.scenarios]);

  const scenarioNameMap = scenarioRows.reduce<Record<string, string>>((acc, row) => {
    acc[row.scenarioId] = row.name;
    return acc;
  }, {});
  const maxTornado = Math.max(...sensitivities.map((item) => Math.max(Math.abs(item.downside), Math.abs(item.upside))), 1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[#1E5B9C]" />
            Scenario Comparison Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.periodLabel}
            <DataFreshness source={loading ? 'loading' : scenarioRows.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(
              'Scenario_Comparison',
              ['Scenario', 'Revenue', 'EBITDA', 'Cash Runway'],
              scenarioRows.map((row) => [
                row.name,
                row.metrics.revenue || 0,
                row.metrics.ebitda || 0,
                row.metrics.cash_runway || 0,
              ]),
            )}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => exportPDF(
              'Scenario Comparison',
              ['Scenario', 'Revenue', 'EBITDA', 'Cash Runway'],
              scenarioRows.map((row) => [
                row.name,
                formatMoney(row.metrics.revenue || 0),
                formatMoney(row.metrics.ebitda || 0),
                `${(row.metrics.cash_runway || 0).toFixed(1)} mo`,
              ]),
            )}
            className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {ctx.scenarios.length < 2 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            At least two scenarios are required before a live comparison can be generated.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Scenario comparison could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && scenarioRows.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Scenario Definitions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Scenario', 'Status', 'Created', 'Latest Version', 'Role'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ctx.scenarios.slice(0, 4).map((scenario, index) => (
                      <tr key={scenario.scenarioId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{scenario.name}</td>
                        <td className="px-4 py-3 text-gray-600">{titleCase(scenario.status)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(scenario.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{scenario.latestVersionId}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${index === 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {index === 0 ? 'Base' : 'Compare'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarioRows.map((row) => (
                <div key={row.scenarioId} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{row.name}</p>
                  <div className="mt-4 space-y-3">
                    {Object.entries(row.metrics).map(([metric, value]) => (
                      <div key={metric} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700">{titleCase(metric)}</span>
                        <span className="font-mono font-bold text-[#1B2A4A]">
                          {metric.includes('runway') ? `${value.toFixed(1)} mo` : formatMoney(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Comparison Delta Table {comparisonId ? `· ${comparisonId.slice(0, 8)}` : ''}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      {['Metric', 'Base Scenario', 'Compare Scenario', 'Base Value', 'Compare Value', 'Delta', 'Delta %'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deltas.map((delta, index) => (
                      <tr key={`${delta.metric}-${delta.compareScenarioId}`} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{titleCase(delta.metric)}</td>
                        <td className="px-4 py-3 text-gray-600">{scenarioNameMap[delta.baseScenarioId] || delta.baseScenarioId}</td>
                        <td className="px-4 py-3 text-gray-600">{scenarioNameMap[delta.compareScenarioId] || delta.compareScenarioId}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(delta.baseValue)}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(delta.compareValue)}</td>
                        <td className={`px-4 py-3 font-mono font-bold ${delta.delta >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                          {delta.delta >= 0 ? '+' : ''}{formatMoney(delta.delta)}
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${delta.deltaPct >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                          {delta.deltaPct >= 0 ? '+' : ''}{formatPercent(delta.deltaPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#1E5B9C]" />
                EBITDA Sensitivity Tornado
              </h3>
              <p className="text-[11px] text-gray-400 mb-4">Live sensitivity ranges for the active scenario.</p>
              <div className="space-y-3">
                {sensitivities.map((item) => (
                  <div key={item.driver} className="flex items-center gap-3">
                    <div className="w-44 text-right text-xs font-semibold text-gray-700 shrink-0 truncate">{item.driver}</div>
                    <div className="flex-1 flex items-center h-7">
                      <div className="flex-1 flex justify-end">
                        <div
                          className="h-6 bg-[#C0392B] rounded-l-md flex items-center justify-start px-1.5"
                          style={{ width: `${(Math.abs(item.downside) / maxTornado) * 100}%` }}
                        >
                          <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatMoney(Math.abs(item.downside))}</span>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-400 shrink-0" />
                      <div className="flex-1">
                        <div
                          className="h-6 bg-[#1A7A4A] rounded-r-md flex items-center justify-end px-1.5"
                          style={{ width: `${(Math.abs(item.upside) / maxTornado) * 100}%` }}
                        >
                          <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatMoney(item.upside)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong>Live interpretation:</strong> {deltas[0]?.metric ? `${titleCase(deltas[0].metric)} is currently the largest recorded comparison delta.` : 'Scenario deltas are available above.'}
                {sensitivities[0]?.driver ? ` The widest sensitivity swing is ${sensitivities[0].driver}.` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
