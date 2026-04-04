"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, Download, Lightbulb, Printer, SlidersHorizontal, Zap } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getAnalysisExplainability, getAnalysisSensitivity } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { exportCSV, exportPDF } from '@/lib/export';
import { asArray, asRecord, formatMoney, formatPercent, titleCase, toNumber, toText } from '@/lib/phase5-utils';

interface DriverRow {
  name: string;
  contribution: number;
  percentage: number;
  stage: string;
  entityRef: string;
}

interface SensitivityRow {
  driver: string;
  elasticity: number;
  downside: number;
  upside: number;
  deltaPct: number;
}

const METRICS = ['EBITDA', 'Revenue', 'Net Revenue', 'Cash Runway'];

function normalizeDrivers(raw: unknown): DriverRow[] {
  const value = asRecord(raw);

  return asArray(value.drivers).map((item) => {
    const row = asRecord(item);
    return {
      name: toText(row.name, 'Driver'),
      contribution: toNumber(row.contribution),
      percentage: toNumber(row.percentage),
      stage: toText(row.stage, 'analysis'),
      entityRef: toText(row.entityRef, ''),
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
      elasticity: toNumber(row.elasticity),
      downside: toNumber(impactRange.downside),
      upside: toNumber(impactRange.upside),
      deltaPct: toNumber(impactRange.deltaPct),
    };
  });
}

export default function DriverExplainability() {
  const ctx = usePlanningContext();
  const [selectedMetric, setSelectedMetric] = useState('EBITDA');
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [sensitivities, setSensitivities] = useState<SensitivityRow[]>([]);
  const [totalEffect, setTotalEffect] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setDrivers([]);
      setSensitivities([]);
      setTotalEffect(0);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalysisExplainability({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        periodId: ctx.periodStart || undefined,
        targetMetric: selectedMetric,
      }),
      getAnalysisSensitivity({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        targetMetric: selectedMetric,
      }),
    ])
      .then(([explainabilityResult, sensitivityResult]) => {
        if (cancelled) return;

        const explainability = asRecord(explainabilityResult.data);
        setDrivers(normalizeDrivers(explainability));
        setTotalEffect(toNumber(explainability.totalEffect));
        setSensitivities(normalizeSensitivity(sensitivityResult.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load explainability data');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId, ctx.periodStart, selectedMetric]);

  const maxBridgeValue = Math.max(
    ...drivers.map((driver) => Math.abs(driver.contribution)),
    1,
  );
  const maxSensitivity = Math.max(
    ...sensitivities.map((item) => Math.max(Math.abs(item.downside), Math.abs(item.upside))),
    1,
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#1E5B9C]" />
              Driver Explainability Console
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              {ctx.companyName} — {ctx.scenarioName}
              <DataFreshness source={loading ? 'loading' : drivers.length > 0 || sensitivities.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {METRICS.map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedMetric === metric
                      ? 'bg-[#1B2A4A] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {metric}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportCSV(
                `Explainability_${selectedMetric.replace(/\s+/g, '_')}`,
                ['Driver', 'Contribution', 'Contribution %', 'Stage'],
                drivers.map((driver) => [driver.name, driver.contribution, driver.percentage, driver.stage]),
              )}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => exportPDF(
                `Driver Explainability — ${selectedMetric}`,
                ['Driver', 'Contribution', 'Contribution %', 'Stage'],
                drivers.map((driver) => [driver.name, driver.contribution, `${driver.percentage.toFixed(1)}%`, driver.stage]),
              )}
              className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company and scenario to load live driver explainability.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Explainability data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && (drivers.length > 0 || sensitivities.length > 0) && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Tracked Drivers',
                  value: String(drivers.length),
                  sub: 'Contributing signals returned',
                },
                {
                  label: 'Net Effect',
                  value: formatMoney(totalEffect),
                  sub: `${selectedMetric} aggregate contribution`,
                },
                {
                  label: 'Sensitivity Inputs',
                  value: String(sensitivities.length),
                  sub: 'Ranked by impact range',
                },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#1E5B9C]" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  {selectedMetric} Contribution Bridge
                </h3>
              </div>
              <div className="p-5 space-y-2">
                {drivers.length === 0 && (
                  <p className="text-sm text-gray-400">No explainability rows were returned for this metric.</p>
                )}
                {drivers.map((driver) => {
                  const barWidth = (Math.abs(driver.contribution) / maxBridgeValue) * 100;
                  const positive = driver.contribution >= 0;
                  return (
                    <div key={`${driver.name}-${driver.entityRef}`} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition ${positive ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                      <div className="w-48 shrink-0 text-xs font-semibold text-gray-800 truncate">{driver.name}</div>
                      <div className="flex-1 flex items-center h-6">
                        <div
                          className={`h-5 rounded ${positive ? 'bg-[#1A7A4A]' : 'bg-[#C0392B]'}`}
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        />
                      </div>
                      <div className={`w-32 text-right font-mono text-sm font-bold shrink-0 ${positive ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                        {positive ? '+' : '-'}{formatMoney(Math.abs(driver.contribution))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Driver Attribution Detail</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Driver', 'Contribution', 'Share', 'Stage', 'Entity Ref'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drivers.map((driver, index) => (
                      <tr key={`${driver.entityRef}-${driver.name}`} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{driver.name}</td>
                        <td className={`px-4 py-3 font-mono font-bold ${driver.contribution >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                          {driver.contribution >= 0 ? '+' : '-'}{formatMoney(Math.abs(driver.contribution))}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{formatPercent(driver.percentage)}</td>
                        <td className="px-4 py-3 text-gray-600">{titleCase(driver.stage)}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{driver.entityRef || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#1E5B9C]" />
                Sensitivity Envelope
              </h3>
              <p className="text-[11px] text-gray-400 mb-4">Downside and upside range sourced from live sensitivity analysis for the selected metric.</p>
              <div className="space-y-3">
                {sensitivities.length === 0 && (
                  <p className="text-sm text-gray-400">No sensitivity rows are available for this metric yet.</p>
                )}
                {sensitivities.map((item) => (
                  <div key={item.driver} className="flex items-center gap-3">
                    <div className="w-44 text-right text-xs font-semibold text-gray-700 shrink-0 truncate">{item.driver}</div>
                    <div className="flex-1 flex items-center h-7">
                      <div className="flex-1 flex justify-end">
                        <div
                          className="h-6 bg-[#C0392B] rounded-l-md flex items-center justify-start px-1.5"
                          style={{ width: `${(Math.abs(item.downside) / maxSensitivity) * 100}%` }}
                        >
                          <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatMoney(Math.abs(item.downside))}</span>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-400 shrink-0" />
                      <div className="flex-1">
                        <div
                          className="h-6 bg-[#1A7A4A] rounded-r-md flex items-center justify-end px-1.5"
                          style={{ width: `${(Math.abs(item.upside) / maxSensitivity) * 100}%` }}
                        >
                          <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatMoney(item.upside)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-right text-[10px] font-bold text-gray-400">{formatPercent(item.deltaPct)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong>Live interpretation:</strong> {drivers[0]?.name || 'The leading driver'} is the largest contributor to {selectedMetric},
                while {sensitivities[0]?.driver || 'the top sensitivity input'} has the widest stress range in the current planning scope.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
