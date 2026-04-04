"use client";

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getAnalysisAlerts,
  getAnalysisPortfolio,
  getAnalysisRisk,
  getConfidenceSummary,
} from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import {
  asArray,
  asRecord,
  formatDateTime,
  formatMoney,
  severityTone,
  titleCase,
  toNumber,
  toText,
} from '@/lib/phase5-utils';

interface AlertItem {
  alertId: string;
  severity: string;
  message: string;
  suggestedAction: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

interface PortfolioMarket {
  marketId: string;
  name: string;
  attractivenessScore: number;
}

function normalizeAlerts(raw: unknown): AlertItem[] {
  return asArray(raw).map((item) => {
    const row = asRecord(item);
    const linkedEntity = asRecord(row.linkedEntity);
    return {
      alertId: toText(row.alertId, ''),
      severity: toText(row.severity, 'info'),
      message: toText(row.message, ''),
      suggestedAction: toText(row.suggestedAction, ''),
      entityType: toText(linkedEntity.entityType, 'entity'),
      entityId: toText(linkedEntity.entityId, ''),
      createdAt: toText(row.createdAt, ''),
    };
  }).filter((item) => item.alertId);
}

function normalizePortfolio(raw: unknown): PortfolioMarket[] {
  const value = asRecord(raw);
  return asArray(value.markets).map((item) => {
    const row = asRecord(item);
    return {
      marketId: toText(row.marketId, ''),
      name: toText(row.name, 'Market'),
      attractivenessScore: toNumber(row.attractivenessScore),
    };
  }).filter((item) => item.marketId);
}

export default function TriggerDashboard() {
  const ctx = usePlanningContext();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readinessChecklist, setReadinessChecklist] = useState<Array<{ criteria: string; met: boolean; detail: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!ctx.companyId) {
      setAlerts([]);
      setReadinessChecklist([]);
      setLastFetched(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalysisAlerts({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined, limit: 12 }),
      getConfidenceSummary({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
      getAnalysisPortfolio({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
      getAnalysisRisk({ companyId: ctx.companyId, scenarioId: ctx.scenarioId || undefined }),
    ])
      .then(([alertsResult, confidenceResult, portfolioResult, riskResult]) => {
        if (cancelled) return;

        const nextAlerts = normalizeAlerts(alertsResult.data);
        const confidence = asRecord(confidenceResult.data);
        const portfolioMarkets = normalizePortfolio(portfolioResult.data);
        const risk = asRecord(riskResult.data);

        const criticalAlerts = nextAlerts.filter((alert) => alert.severity.toLowerCase() === 'critical').length;
        const lowConfidenceItems = asArray(confidence.lowConfidenceItems).length;
        const evidenceCount = toNumber(confidence.evidenceCount);
        const aggregateRisk = toNumber(risk.aggregateScore);
        const highAttractivenessMarkets = portfolioMarkets.filter((market) => market.attractivenessScore >= 70).length;

        setAlerts(nextAlerts);
        setReadinessChecklist([
          {
            criteria: 'No critical alerts blocking execution',
            met: criticalAlerts === 0,
            detail: criticalAlerts === 0 ? 'All active alerts are warning/info severity.' : `${criticalAlerts} critical alerts remain open.`,
          },
          {
            criteria: 'Confidence gaps are contained',
            met: lowConfidenceItems <= 3,
            detail: `${lowConfidenceItems} low-confidence entities in the current planning scope.`,
          },
          {
            criteria: 'Evidence base exists for governed planning',
            met: evidenceCount > 0,
            detail: `${evidenceCount} evidence items linked into the model.`,
          },
          {
            criteria: 'Portfolio ranking is available',
            met: portfolioMarkets.length > 0,
            detail: portfolioMarkets.length > 0 ? `${portfolioMarkets.length} ranked markets returned.` : 'No ranked markets available yet.',
          },
          {
            criteria: 'At least one high-attractiveness market exists',
            met: highAttractivenessMarkets > 0,
            detail: `${highAttractivenessMarkets} markets at 70+ attractiveness score.`,
          },
          {
            criteria: 'Aggregate risk remains below escalation band',
            met: aggregateRisk < 1000000,
            detail: `Current modeled aggregate risk: ${formatMoney(aggregateRisk)}.`,
          },
        ]);
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load triggers');
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

  const passCount = readinessChecklist.filter((item) => item.met).length;
  const totalCount = readinessChecklist.length;
  const readinessScore = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1E5B9C]" />
          Trigger & Alert Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          {ctx.companyName} — live alerts and readiness signals
          <DataFreshness source={loading ? 'loading' : alerts.length > 0 || readinessChecklist.length > 0 ? 'api' : undefined} lastFetched={lastFetched} />
        </p>
      </div>
      <div className="px-6 pb-8 space-y-6">
        {!ctx.companyId && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-sm text-gray-400 shadow-sm">
            Select a company to load alerts and readiness checks.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">Alerts could not be loaded</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!error && (alerts.length > 0 || readinessChecklist.length > 0) && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Active Monitoring Alerts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D6E4F7]">
                      {['Severity', 'Message', 'Entity', 'Suggested Action', 'Created'].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alerts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                          No active alerts were returned for this planning scope.
                        </td>
                      </tr>
                    )}
                    {alerts.map((alert, index) => (
                      <tr key={alert.alertId} className={index % 2 === 1 ? 'bg-[#F4F5F7]' : ''}>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityTone(alert.severity)}`}>
                            {titleCase(alert.severity)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{alert.message}</td>
                        <td className="px-4 py-3 text-gray-500">{titleCase(alert.entityType)} · {alert.entityId}</td>
                        <td className="px-4 py-3 text-gray-600">{alert.suggestedAction}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDateTime(alert.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Expansion Readiness Checklist</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {readinessChecklist.map((item, index) => (
                    <div key={index} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition">
                      {item.met ? (
                        <CheckCircle2 className="w-5 h-5 text-[#1A7A4A] shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-[#C0392B] shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800">{item.criteria}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{item.detail}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.met ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Readiness Score</p>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={readinessScore >= 80 ? '#1A7A4A' : readinessScore >= 60 ? '#C47A1E' : '#C0392B'}
                      strokeWidth="8"
                      strokeDasharray={`${(readinessScore / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-extrabold ${readinessScore >= 80 ? 'text-[#1A7A4A]' : readinessScore >= 60 ? 'text-[#C47A1E]' : 'text-[#C0392B]'}`}>{readinessScore}%</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">{passCount}/{totalCount} criteria</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">{readinessScore >= 80 ? 'Ready to proceed' : 'Blockers remain'}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
