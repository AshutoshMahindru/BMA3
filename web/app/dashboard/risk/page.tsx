"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { ShieldAlert, AlertTriangle, MoreHorizontal, Info, Target, TrendingUp, Download } from 'lucide-react';
import DataFreshness from '@/components/data-freshness';
import { getAnalysisRisk } from '@/lib/api-client';
import type { DataSource } from '@/lib/data-source';
import { exportCSV } from '@/lib/export';

/* ── Types ── */
interface RiskItem {
  risk_id: string;
  name: string;
  category: string;
  mitigation_plan: string;
  probability_pct: number;
  financial_impact_estimate: number;
  base_likelihood: string;
  base_impact: string;
  scenario_risk_id?: string;
}

/* ── Constants ── */
const PROB_LABELS = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Critical'];

const FALLBACK_RISKS: RiskItem[] = [
  { risk_id: 'R1', name: 'Platform Fee Hike (>25%)', category: 'Platform', mitigation_plan: 'Channel diversification', probability_pct: 0.75, financial_impact_estimate: 450000, base_likelihood: 'high', base_impact: 'major' },
  { risk_id: 'R2', name: 'Demand Slump (Competitor)', category: 'Market', mitigation_plan: 'Loyalty program', probability_pct: 0.45, financial_impact_estimate: 380000, base_likelihood: 'medium', base_impact: 'major' },
  { risk_id: 'R3', name: 'Food Cost Inflation', category: 'Supply Chain', mitigation_plan: 'Fixed contracts', probability_pct: 0.82, financial_impact_estimate: 250000, base_likelihood: 'high', base_impact: 'moderate' },
  { risk_id: 'R4', name: 'Series A Funding Delay', category: 'Funding', mitigation_plan: 'Bridge debt', probability_pct: 0.20, financial_impact_estimate: 1200000, base_likelihood: 'low', base_impact: 'critical' },
];

function normalizeRiskItem(item: unknown): RiskItem | null {
  if (!item || typeof item !== 'object') return null;

  const value = item as Record<string, unknown>;
  const riskId = typeof value.risk_id === 'string' ? value.risk_id : '';
  const name = typeof value.name === 'string' ? value.name : '';

  if (!riskId || !name) {
    return null;
  }

  return {
    risk_id: riskId,
    name,
    category: typeof value.category === 'string' ? value.category : 'Unknown',
    mitigation_plan: typeof value.mitigation_plan === 'string' ? value.mitigation_plan : 'Mitigation plan pending',
    probability_pct: Number(value.probability_pct || 0),
    financial_impact_estimate: Number(value.financial_impact_estimate || 0),
    base_likelihood: typeof value.base_likelihood === 'string' ? value.base_likelihood : 'unknown',
    base_impact: typeof value.base_impact === 'string' ? value.base_impact : 'unknown',
    scenario_risk_id: typeof value.scenario_risk_id === 'string' ? value.scenario_risk_id : undefined,
  };
}

export default function RiskDashboard() {
  const ctx = usePlanningContext();
  const [risks, setRisks] = useState<RiskItem[]>(FALLBACK_RISKS);
  const [source, setSource] = useState<DataSource>('loading');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRiskRegister() {
      if (!ctx.companyId) {
        setRisks(FALLBACK_RISKS);
        setSource('static');
        setLastFetched(null);
        return;
      }

      setSource('loading');
      const result = await getAnalysisRisk({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
      });

      if (cancelled) return;

      const rawItems = Array.isArray(result.data?.riskItems) ? result.data.riskItems : [];
      const normalizedItems = rawItems
        .map(normalizeRiskItem)
        .filter((item): item is RiskItem => item !== null);

      if (normalizedItems.length > 0) {
        setRisks(normalizedItems);
        setSource('api');
        setLastFetched(new Date());
        return;
      }

      setRisks(FALLBACK_RISKS);
      setSource('static');
      setLastFetched(null);
    }

    loadRiskRegister().catch(() => {
      if (cancelled) return;
      setRisks(FALLBACK_RISKS);
      setSource('static');
      setLastFetched(null);
    });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.scenarioId]);

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val);
  const primaryRisk = risks[0] ?? FALLBACK_RISKS[0];

  /* ── Heatmap Calculation ── */
  const heatmapData = useMemo(() => {
    const grid = Array(5).fill(0).map(() => Array(5).fill(0).map(() => [] as RiskItem[]));
    
    risks.forEach(risk => {
      // Map probability % to index (0-4: 0.8+=VH, 0.6+=H, 0.4+=M, 0.2+=L, else VL)
      let pIdx = 4;
      if (risk.probability_pct >= 0.8) pIdx = 0;
      else if (risk.probability_pct >= 0.6) pIdx = 1;
      else if (risk.probability_pct >= 0.4) pIdx = 2;
      else if (risk.probability_pct >= 0.2) pIdx = 3;

      // Map impact AED to index (0-4: 1M+=C, 400K+=Major, 150K+=Mod, 50K+=Minor, else Neg)
      let iIdx = 0;
      const imp = risk.financial_impact_estimate;
      if (imp >= 1000000) iIdx = 4;
      else if (imp >= 400000) iIdx = 3;
      else if (imp >= 150000) iIdx = 2;
      else if (imp >= 50000) iIdx = 1;

      grid[pIdx][iIdx].push(risk);
    });
    return grid;
  }, [risks]);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#1E5B9C]" />
              Risk & Uncertainty Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              {ctx.companyName} — {ctx.scenarioName} 
              <DataFreshness source={source} lastFetched={lastFetched ? new Date(lastFetched) : null} />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
               onClick={() => exportCSV(`FPE_Risk_Register_${ctx.scenarioName}`, ['ID', 'Risk', 'Category', 'Prob %', 'Impact AED'], risks.map(r => [r.risk_id, r.name, r.category, String(r.probability_pct), String(r.financial_impact_estimate)]))}
               className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" /> Export Register
            </button>
            <button className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#1B2A4A] px-4 py-2 rounded-lg hover:bg-[#263B5E] shadow-sm transition">
              <TrendingUp className="w-3.5 h-3.5" /> Run Simulation
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 grid grid-cols-12 gap-6">
        
        {/* Risk Heatmap (Left Column) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-[#1E5B9C]" />
                5 × 5 Risk Heatmap (Probability × Financial Impact)
              </h3>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/> High Criticality</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"/> Moderate</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Acceptable</div>
              </div>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-[80px_repeat(5,1fr)] grid-rows-[repeat(5,130px)_40px] gap-2">
                {/* Probability Y-Axis Labels */}
                {PROB_LABELS.map((label, i) => (
                  <div key={label} className="col-start-1 flex items-center justify-end pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right line-clamp-2">
                    {label}
                  </div>
                ))}

                {/* Heatmap Cells */}
                {heatmapData.map((row, pIdx) => (
                  row.map((cellRisks, iIdx) => {
                    // Criticality color logic: High (top right), Low (bottom left)
                    const score = (5 - pIdx) * (iIdx + 1);
                    const bgColor = score >= 15 ? 'bg-red-50 border-red-200' : 
                                   score >= 8 ? 'bg-amber-50 border-amber-200' : 
                                   'bg-emerald-50 border-emerald-100';
                    
                    return (
                      <div key={`${pIdx}-${iIdx}`} className={`rounded-lg border-2 border-dashed flex flex-col gap-1 p-2 overflow-y-auto transition hover:shadow-md ${bgColor}`}>
                         {cellRisks.map(r => (
                           <div key={r.risk_id} className={`px-2 py-1.5 rounded border text-[9px] font-bold shadow-sm ${
                             score >= 15 ? 'bg-red-600 text-white border-red-700' :
                             score >= 8 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                             'bg-emerald-600 text-white border-emerald-700'
                           }`}>
                             {r.name}
                           </div>
                         ))}
                      </div>
                    );
                  })
                ))}

                {/* Impact X-Axis Labels */}
                <div className="col-start-1" /> {/* Spacer */}
                {IMPACT_LABELS.map(label => (
                  <div key={label} className="flex items-center justify-center pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Register Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Consolidated Risk Register
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-5 py-3 font-bold uppercase tracking-wider">Risk / ID</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-right">Prob %</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-right">Impact (AED)</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider">Mitigation Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {risks.map((r, i) => {
                  const score = r.probability_pct * r.financial_impact_estimate;
                  const severity = score > 500000 ? 'Critical' : score > 200000 ? 'Major' : 'Moderate';
                  const color = severity === 'Critical' ? 'text-red-600 bg-red-50' : severity === 'Major' ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50';

                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition cursor-pointer">
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{r.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{r.risk_id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-gray-700">
                        {(r.probability_pct * 100).toFixed(0)}%
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-gray-700">
                        AED {fmt(r.financial_impact_estimate)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${color}`}>
                            {severity === 'Critical' ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                            {r.mitigation_plan}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Intelligence Sidebar (Right Column) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#1B2A4A] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
             <ShieldAlert className="absolute top-[-10px] right-[-10px] w-24 h-24 text-white/5" />
             <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A90E2] mb-1">Impact Summary</h4>
             <p className="text-2xl font-bold">AED {fmt(risks.reduce((a, b) => a + (b.probability_pct * b.financial_impact_estimate), 0))}</p>
             <p className="text-[10px] text-white/60 mt-1 uppercase font-bold tracking-tight">Probabilistic Value at Risk (VaR)</p>
             
             <div className="mt-8 space-y-4">
                <div className="bg-white/10 rounded-lg p-4 border border-white/10 hover:bg-white/15 transition cursor-pointer">
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase text-[#4A90E2]">Primary Threat</span>
                      <span className="text-[10px] font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded">High Probability</span>
                   </div>
                   <p className="text-xs font-bold leading-relaxed">{primaryRisk.name}</p>
                   <p className="text-[9px] text-white/50 mt-1">Impact estimated at AED {fmt(primaryRisk.financial_impact_estimate)}</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4 border border-white/10 hover:bg-white/15 transition cursor-pointer">
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase text-[#4A90E2]">Mitigation Progress</span>
                      <span className="text-[10px] font-bold text-emerald-400">72% Coverage</span>
                   </div>
                   <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: '72%' }} />
                   </div>
                   <p className="text-[9px] text-white/50 mt-2">18 of 25 active risks mapped to specific mitigation plans.</p>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Risk Velocity</h4>
             <div className="space-y-4">
                {[
                  { label: 'Regulatory', speed: 'Low', color: 'bg-emerald-500' },
                  { label: 'Platform Fees', speed: 'High', color: 'bg-red-500' },
                  { label: 'Supply Chain', speed: 'Medium', color: 'bg-amber-500' },
                ].map(v => (
                  <div key={v.label}>
                    <div className="flex justify-between items-center mb-1.5">
                       <span className="text-xs font-bold text-gray-700">{v.label}</span>
                       <span className="text-[10px] font-bold text-gray-400 uppercase">{v.speed} Velocity</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                       <div className={`${v.color} h-full`} style={{ width: v.speed === 'High' ? '90%' : v.speed === 'Medium' ? '50%' : '20%' }} />
                    </div>
                  </div>
                ))}
             </div>
             <p className="text-[9px] text-gray-400 mt-6 leading-relaxed italic border-t border-gray-50 pt-4">
                * Risk Velocity measures the speed at which a risk can materialize after its primary trigger is detected.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
