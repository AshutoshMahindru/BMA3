"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert, Target } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import { getAnalysisRisk } from '@/lib/api-client';
import { exportCSV } from '@/lib/export';
import { asArray, asRecord, formatMoney, formatPercent, severityTone, titleCase, toNumber, toText } from '@/lib/phase5-utils';

interface RiskItem {
  riskId: string;
  title: string;
  severity: string;
  likelihood: string;
  financialImpact: number;
  stage: string;
  probabilityPct: number;
}

const PROB_LABELS = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Critical'];

function normalizeRiskItem(item: unknown): RiskItem | null {
  const value = asRecord(item);
  const riskId = toText(value.riskId, '');
  const title = toText(value.title, '');

  if (!riskId || !title) return null;

  return {
    riskId,
    title,
    severity: toText(value.severity, 'low'),
    likelihood: toText(value.likelihood, 'unknown'),
    financialImpact: toNumber(value.financialImpact),
    stage: toText(value.stage, 'analysis'),
    probabilityPct: toNumber(value.probabilityPct),
  };
}

export default function RiskDashboard() {
  const ctx = usePlanningContext();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [aggregateScore, setAggregateScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setRisks([]);
      setAggregateScore(0);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnalysisRisk({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId || undefined,
    })
      .then((result) => {
        if (cancelled) return;

        const value = asRecord(result.data);
        const nextRisks = asArray(value.riskItems)
          .map(normalizeRiskItem)
          .filter((item): item is RiskItem => item !== null);

        setRisks(nextRisks);
        setAggregateScore(toNumber(value.aggregateScore));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load risk dashboard');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId]);

  const heatmapData = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [] as RiskItem[]));

  risks.forEach((risk) => {
    let pIdx = 4;
    if (risk.probabilityPct >= 0.8) pIdx = 0;
    else if (risk.probabilityPct >= 0.6) pIdx = 1;
    else if (risk.probabilityPct >= 0.4) pIdx = 2;
    else if (risk.probabilityPct >= 0.2) pIdx = 3;

    let iIdx = 0;
    if (risk.financialImpact >= 1000000) iIdx = 4;
    else if (risk.financialImpact >= 400000) iIdx = 3;
    else if (risk.financialImpact >= 150000) iIdx = 2;
    else if (risk.financialImpact >= 50000) iIdx = 1;

    heatmapData[pIdx][iIdx].push(risk);
  });

  const primaryRisk = risks[0] || null;
  const severityCounts = risks.reduce<Record<string, number>>((acc, risk) => {
    const key = risk.severity.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#1E5B9C]" />
              Risk & Uncertainty Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              {ctx.companyName} — {ctx.scenarioName}
              <DataFreshness source={loading ? 'loading' : risks.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
            </p>
          </div>
          <button
            onClick={() => exportCSV(
              `Risk_Register_${ctx.scenarioName.replace(/\s+/g, '_')}`,
              ['Risk ID', 'Title', 'Severity', 'Likelihood', 'Probability %', 'Financial Impact', 'Stage'],
              risks.map((risk) => [risk.riskId, risk.title, risk.severity, risk.likelihood, formatPercent(risk.probabilityPct), risk.financialImpact, risk.stage]),
            )}
            className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition"
          >
            Export Register
          </button>
        </div>
      </div>

      <div className="px-6 pb-8 grid grid-cols-12 gap-6">
        {!ctx.companyId && (
          <div className="col-span-12 bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load the risk register.
          </div>
        )}

        {error && (
          <div className="col-span-12 bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Risk data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && risks.length > 0 && (
          <>
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#1E5B9C]" />
                    5 × 5 Risk Heatmap
                  </h3>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-[80px_repeat(5,1fr)] grid-rows-[repeat(5,130px)_40px] gap-2">
                    {PROB_LABELS.map((label) => (
                      <div key={label} className="col-start-1 flex items-center justify-end pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
                        {label}
                      </div>
                    ))}

                    {heatmapData.map((row, pIdx) => row.map((cellRisks, iIdx) => {
                      const score = (5 - pIdx) * (iIdx + 1);
                      const bgColor = score >= 15 ? 'bg-red-50 border-red-200' : score >= 8 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100';

                      return (
                        <div key={`${pIdx}-${iIdx}`} className={`rounded-lg border-2 border-dashed flex flex-col gap-1 p-2 overflow-y-auto transition ${bgColor}`}>
                          {cellRisks.map((risk) => (
                            <div key={risk.riskId} className={`px-2 py-1.5 rounded border text-[9px] font-bold shadow-sm ${severityTone(risk.severity)}`}>
                              {risk.title}
                            </div>
                          ))}
                        </div>
                      );
                    }))}

                    <div className="col-start-1" />
                    {IMPACT_LABELS.map((label) => (
                      <div key={label} className="flex items-center justify-center pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Consolidated Risk Register</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#D6E4F7]">
                        {['Risk', 'Likelihood', 'Probability', 'Financial Impact', 'Severity', 'Stage'].map((header) => (
                          <th key={header} className="px-5 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {risks.map((risk, index) => (
                        <tr key={risk.riskId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                          <td className="px-5 py-4">
                            <p className="font-bold text-gray-900">{risk.title}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{risk.riskId}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                              {titleCase(risk.likelihood)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold text-gray-700">
                            {formatPercent(risk.probabilityPct)}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold text-gray-700">
                            {formatMoney(risk.financialImpact)}
                          </td>
                          <td className="px-5 py-4">
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${severityTone(risk.severity)}`}>
                              {risk.severity.toLowerCase() === 'critical' ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                              {titleCase(risk.severity)}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-600">{titleCase(risk.stage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-[#1B2A4A] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <ShieldAlert className="absolute top-[-10px] right-[-10px] w-24 h-24 text-white/5" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A90E2] mb-1">Impact Summary</h4>
                <p className="text-2xl font-bold">{formatMoney(aggregateScore)}</p>
                <p className="text-[10px] text-white/60 mt-1 uppercase font-bold tracking-tight">Aggregate modeled exposure</p>

                {primaryRisk && (
                  <div className="mt-8 bg-white/10 rounded-lg p-4 border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase text-[#4A90E2]">Primary Threat</span>
                      <span className="text-[10px] font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded">{titleCase(primaryRisk.severity)}</span>
                    </div>
                    <p className="text-xs font-bold leading-relaxed">{primaryRisk.title}</p>
                    <p className="text-[9px] text-white/50 mt-1">
                      Exposure estimated at {formatMoney(primaryRisk.financialImpact)} with {formatPercent(primaryRisk.probabilityPct)} probability.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Severity Mix</h4>
                <div className="space-y-4">
                  {Object.entries(severityCounts).map(([severity, count]) => (
                    <div key={severity}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-gray-700">{titleCase(severity)}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{count} risks</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className={`${severity.includes('critical') ? 'bg-red-500' : severity.includes('major') ? 'bg-amber-500' : 'bg-emerald-500'} h-full`} style={{ width: `${(count / risks.length) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
