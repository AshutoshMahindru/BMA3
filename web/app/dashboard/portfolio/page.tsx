"use client";

import { useEffect, useState } from 'react';
import { Briefcase, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getAnalysisPortfolio } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { asArray, asRecord, formatMoney, formatPercent, severityTone, toNumber, toText } from '@/lib/phase5-utils';

interface PortfolioMarket {
  marketId: string;
  name: string;
  attractivenessScore: number;
  capitalAllocated: number;
  expectedReturn: number;
  rank: number;
}

function normalizeMarkets(raw: unknown): PortfolioMarket[] {
  const value = asRecord(raw);
  return asArray(value.markets).map((item) => {
    const row = asRecord(item);
    return {
      marketId: toText(row.marketId, ''),
      name: toText(row.name, 'Market'),
      attractivenessScore: toNumber(row.attractivenessScore),
      capitalAllocated: toNumber(row.capitalAllocated),
      expectedReturn: toNumber(row.expectedReturn),
      rank: toNumber(row.rank),
    };
  }).filter((item) => item.marketId);
}

function decisionForMarket(market: PortfolioMarket): { label: string; tone: string } {
  const score = market.attractivenessScore;
  if (score >= 75 && market.expectedReturn >= 0.15) {
    return { label: 'GO', tone: 'bg-green-100 text-green-700 border-green-200' };
  }
  if (score >= 60) {
    return { label: 'CONDITIONAL', tone: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (score >= 45) {
    return { label: 'HOLD', tone: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
  return { label: 'NO-GO', tone: 'bg-red-100 text-red-700 border-red-200' };
}

function riskLabel(score: number): string {
  if (score >= 75) return 'Low';
  if (score >= 60) return 'Medium';
  return 'High';
}

export default function PortfolioOptimization() {
  const ctx = usePlanningContext();
  const [markets, setMarkets] = useState<PortfolioMarket[]>([]);
  const [totalCapital, setTotalCapital] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setMarkets([]);
      setTotalCapital(0);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnalysisPortfolio({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined })
      .then((result) => {
        if (cancelled) return;
        const nextMarkets = normalizeMarkets(result.data);
        setMarkets(nextMarkets);
        setTotalCapital(toNumber(asRecord(result.data).totalCapital));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load portfolio optimization');
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

  const decisionCounts = markets.reduce<Record<string, number>>((acc, market) => {
    const label = decisionForMarket(market).label;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#1E5B9C]" />
          Portfolio Optimization
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — capital allocation and market decisions
          <DataFreshness source={loading ? 'loading' : markets.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load portfolio optimization outputs.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Portfolio data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && markets.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'GO', count: decisionCounts.GO || 0, color: 'border-l-[#1A7A4A] bg-green-50' },
                { label: 'CONDITIONAL', count: decisionCounts.CONDITIONAL || 0, color: 'border-l-[#C47A1E] bg-amber-50' },
                { label: 'HOLD', count: decisionCounts.HOLD || 0, color: 'border-l-slate-400 bg-slate-50' },
                { label: 'NO-GO', count: decisionCounts['NO-GO'] || 0, color: 'border-l-[#C0392B] bg-red-50' },
              ].map((item) => (
                <div key={item.label} className={`border-l-4 ${item.color} rounded-lg p-3 border border-gray-200`}>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-1">{item.count}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Market Portfolio Decision Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      {['Market', 'Attractiveness', 'Capital Allocated', 'Expected Return', 'Priority Rank', 'Risk Level', 'Decision'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {markets.map((market, index) => {
                      const decision = decisionForMarket(market);
                      const risk = riskLabel(market.attractivenessScore);
                      return (
                        <tr key={market.marketId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                          <td className="px-4 py-3 font-bold text-gray-800">{market.name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${decision.tone}`}>
                              {(market.attractivenessScore / 10).toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatMoney(market.capitalAllocated)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{formatPercent(market.expectedReturn)}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">#{market.rank}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityTone(risk)}`}>
                              {risk}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border ${decision.tone}`}>
                              {decision.label === 'GO' ? <CheckCircle2 className="w-4 h-4" /> : decision.label === 'NO-GO' ? <XCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                              {decision.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Capital Allocation Ladder</h3>
              <div className="space-y-3">
                {markets.map((market) => (
                  <div key={market.marketId}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-700">{market.name}</span>
                      <span className="font-mono text-gray-500">{formatMoney(market.capitalAllocated)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E5B9C] rounded-full"
                        style={{ width: `${totalCapital > 0 ? (market.capitalAllocated / totalCapital) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-4">Total capital allocated: {formatMoney(totalCapital)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
