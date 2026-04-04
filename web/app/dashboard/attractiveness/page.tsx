"use client";

import { useEffect, useState } from 'react';
import { Star, Target } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { getAnalysisPortfolio } from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import { asArray, asRecord, formatMoney, formatPercent, toNumber, toText } from '@/lib/phase5-utils';

interface MarketScore {
  marketId: string;
  name: string;
  attractivenessScore: number;
  capitalAllocated: number;
  expectedReturn: number;
  rank: number;
}

function normalizeMarkets(raw: unknown): MarketScore[] {
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

export default function MarketAttractiveness() {
  const ctx = usePlanningContext();
  const [markets, setMarkets] = useState<MarketScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setMarkets([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnalysisPortfolio({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined })
      .then((result) => {
        if (cancelled) return;
        setMarkets(normalizeMarkets(result.data));
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load attractiveness scores');
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

  const maxCapital = Math.max(...markets.map((market) => market.capitalAllocated), 1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Target className="w-5 h-5 text-[#1E5B9C]" />
          Market Attractiveness Scoring
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — live market ranking
          <DataFreshness source={loading ? 'loading' : markets.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load attractiveness scores.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Attractiveness data could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && markets.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Live Ranking Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1B2A4A] text-white">
                      {['Market', 'Composite Score', 'Capital Allocated', 'Expected Return', 'Priority Rank'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market, index) => (
                      <tr key={market.marketId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-2.5 font-bold text-gray-800 flex items-center gap-1.5">
                          {index < 3 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                          {market.name}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${market.attractivenessScore >= 75 ? 'bg-[#1A7A4A] text-white' : market.attractivenessScore >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {(market.attractivenessScore / 10).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{formatMoney(market.capitalAllocated)}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{formatPercent(market.expectedReturn)}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">#{market.rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {markets.slice(0, 3).map((market, index) => (
                <div key={market.marketId} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <h4 className="text-sm font-bold text-gray-800">#{index + 1} {market.name}</h4>
                    <span className="text-xs font-bold text-[#1A7A4A] bg-green-50 px-2 py-0.5 rounded ml-auto">
                      {(market.attractivenessScore / 10).toFixed(1)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>Composite score</span>
                        <span>{market.attractivenessScore.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1E5B9C]" style={{ width: `${market.attractivenessScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>Capital weight</span>
                        <span>{formatMoney(market.capitalAllocated)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1A7A4A]" style={{ width: `${(market.capitalAllocated / maxCapital) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>Expected return</span>
                      <span className="font-bold text-gray-700">{formatPercent(market.expectedReturn)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
