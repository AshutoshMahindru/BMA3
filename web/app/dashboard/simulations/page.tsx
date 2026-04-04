"use client";

import { useEffect, useState } from 'react';
import { Activity, BarChart, Play, RotateCcw, Sliders, Target, Zap } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import { createAnalysisSimulationRuns, getAnalysisSimulationRunsById } from '@/lib/api-client';
import { asArray, asRecord, formatMoney, toNumber, toText } from '@/lib/phase5-utils';

interface SimulationSummary {
  metricName: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
}

function normalizeSummary(item: unknown): SimulationSummary | null {
  const value = asRecord(item);
  const metricName = toText(value.metric_name, '');
  if (!metricName) return null;

  return {
    metricName,
    p10: toNumber(value.p10_value),
    p25: toNumber(value.p25_value),
    p50: toNumber(value.p50_value),
    p75: toNumber(value.p75_value),
    p90: toNumber(value.p90_value),
    mean: toNumber(value.mean_value),
    stdDev: toNumber(value.std_dev),
  };
}

export default function SimulationLab() {
  const ctx = usePlanningContext();
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const [volumeUncertainty, setVolumeUncertainty] = useState(15);
  const [priceVariability, setPriceVariability] = useState(5);
  const [costShock, setCostShock] = useState(10);
  const [iterations, setIterations] = useState(1000);

  useEffect(() => {
    if (!runId) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnalysisSimulationRunsById(runId)
      .then((result) => {
        if (cancelled) return;
        const value = asRecord(result.data);
        const resultRecord = asRecord(value.results);
        const nextResults = asArray(resultRecord.summaries)
          .map(normalizeSummary)
          .filter((item): item is SimulationSummary => item !== null);

        setResults(nextResults);
        const completedAt = toText(value.completedAt, '');
        setLastFetched(completedAt ? new Date(completedAt) : new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load simulation results');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  const handleRunSimulation = async () => {
    if (!ctx.scenarioId) return;

    setIsRunning(true);
    setError(null);

    try {
      const created = await createAnalysisSimulationRuns({
        baseScenarioId: ctx.scenarioId,
        label: `${ctx.scenarioName} Monte Carlo`,
        shocks: [
          { driver: 'volume', magnitudePct: volumeUncertainty },
          { driver: 'price', magnitudePct: priceVariability },
          { driver: 'cost', magnitudePct: costShock },
          { driver: 'iterations', value: iterations },
        ],
      });

      const nextRunId = toText(asRecord(created.data).runId, '');
      setRunId(nextRunId || null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Simulation run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const Histogram = ({ summary }: { summary: SimulationSummary }) => {
    const bins = [];
    for (let step = -3; step <= 3; step += 0.3) {
      const x = summary.mean + step * summary.stdDev;
      const y = Math.exp(-0.5 * Math.pow(step, 2)) / Math.max(summary.stdDev, 1);
      bins.push({ x, height: y * 100 });
    }

    const maxH = Math.max(...bins.map((bin) => bin.height), 1);

    return (
      <div className="relative h-48 w-full mt-4 flex items-end justify-between px-2 gap-1 border-b border-gray-100">
        {bins.map((bin, index) => (
          <div
            key={index}
            className="flex-1 bg-[#4A90E2] rounded-t-sm transition-all duration-700 hover:bg-[#1E5B9C]"
            style={{ height: `${(bin.height / maxH) * 100}%` }}
            title={formatMoney(bin.x)}
          />
        ))}
        <div className="absolute top-0 bottom-0 border-l border-red-400 border-dashed z-10" style={{ left: '10%' }}>
          <span className="absolute -top-4 -left-3 text-[9px] font-bold text-red-500">P10</span>
        </div>
        <div className="absolute top-0 bottom-0 border-l border-[#1B2A4A] z-10" style={{ left: '50%' }}>
          <span className="absolute -top-5 -left-4 text-[9px] font-bold text-[#1B2A4A]">P50</span>
        </div>
        <div className="absolute top-0 bottom-0 border-l border-emerald-400 border-dashed z-10" style={{ left: '90%' }}>
          <span className="absolute -top-4 -left-3 text-[9px] font-bold text-emerald-500">P90</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#1E5B9C]" />
              Simulation Lab & Monte Carlo Workbench
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              Probabilistic modeling — {ctx.scenarioName}
              <DataFreshness source={loading || isRunning ? 'loading' : results.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRunId(null);
                setResults([]);
                setError(null);
                setLastFetched(null);
                setVolumeUncertainty(15);
                setPriceVariability(5);
                setCostShock(10);
                setIterations(1000);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRunSimulation}
              disabled={isRunning || !ctx.scenarioId}
              className={`flex items-center gap-2 text-sm font-bold px-6 py-2 rounded-lg shadow-md transition ${isRunning || !ctx.scenarioId ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-[#1E5B9C] hover:bg-[#1B2A4A] text-white'}`}
            >
              {isRunning ? <Zap className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isRunning ? `Running ${iterations.toLocaleString()} Iterations...` : 'Execute Monte Carlo'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
              <Sliders className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">Variable Uncertainty</h3>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-semibold text-gray-700">Volume Uncertainty</label>
                  <span className="text-xs font-bold text-[#1E5B9C] bg-blue-50 px-2 py-0.5 rounded">±{volumeUncertainty}%</span>
                </div>
                <input type="range" min="0" max="40" step="5" value={volumeUncertainty} onChange={(event) => setVolumeUncertainty(parseInt(event.target.value, 10))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#1E5B9C]" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-semibold text-gray-700">Price Variability</label>
                  <span className="text-xs font-bold text-[#1A7A4A] bg-green-50 px-2 py-0.5 rounded">±{priceVariability}%</span>
                </div>
                <input type="range" min="0" max="20" step="1" value={priceVariability} onChange={(event) => setPriceVariability(parseInt(event.target.value, 10))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#1A7A4A]" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-semibold text-gray-700">Cost Shock Probability</label>
                  <span className="text-xs font-bold text-[#E67E22] bg-orange-50 px-2 py-0.5 rounded">{costShock}%</span>
                </div>
                <input type="range" min="0" max="50" step="5" value={costShock} onChange={(event) => setCostShock(parseInt(event.target.value, 10))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#E67E22]" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-semibold text-gray-700">Iterations</label>
                  <span className="text-xs font-bold text-[#1B2A4A] bg-slate-100 px-2 py-0.5 rounded">{iterations.toLocaleString()}</span>
                </div>
                <input type="range" min="500" max="5000" step="500" value={iterations} onChange={(event) => setIterations(parseInt(event.target.value, 10))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#1B2A4A]" />
              </div>
            </div>
          </div>

          <div className="bg-[#1B2A4A] rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-[#4A90E2]" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Run Profile</h4>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Scenario</span>
                <span className="font-bold">{ctx.scenarioName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Iterations</span>
                <span className="font-bold">{iterations.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Run id</span>
                <span className="font-mono text-[11px]">{runId ? runId.slice(0, 8) : 'pending'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-red-800">Simulation data could not be loaded</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          )}

          {!error && results.length === 0 && !loading && !isRunning && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
              Execute a simulation run to populate probability distributions for the selected scenario.
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {results.slice(0, 3).map((result) => (
                  <div key={result.metricName} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{result.metricName} (Mean)</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-xl font-bold text-gray-900">{formatMoney(result.mean)}</p>
                      <p className="text-[10px] font-bold text-[#E67E22]">σ {formatMoney(result.stdDev)}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-1">
                      {[
                        { label: 'P10', value: result.p10 },
                        { label: 'P50', value: result.p50 },
                        { label: 'P90', value: result.p90 },
                      ].map((percentile) => (
                        <div key={percentile.label} className="text-center bg-gray-50 rounded py-1.5">
                          <p className="text-[8px] text-gray-400 font-bold">{percentile.label}</p>
                          <p className="text-[10px] font-bold text-gray-700">{formatMoney(percentile.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {results.map((result) => (
                  <div key={result.metricName} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                        <BarChart className="w-4 h-4 text-gray-400" />
                        {result.metricName} Probability Distribution
                      </h4>
                    </div>
                    <Histogram summary={result} />
                    <div className="mt-4 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span>Downside</span>
                      <span>Median</span>
                      <span>Upside</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Simulation Summary Table</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['Metric', 'P10', 'P25', 'P50', 'P75', 'P90', 'Mean', 'Std Dev'].map((header) => (
                          <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((result, index) => (
                        <tr key={result.metricName} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                          <td className="px-4 py-3 font-semibold text-gray-800">{result.metricName}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.p10)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.p25)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-[#1E5B9C]">{formatMoney(result.p50)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.p75)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.p90)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.mean)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(result.stdDev)}</td>
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
    </div>
  );
}
