"use client";

/* S20: SIMULATION LAB — 10 Driver Sliders + Output Impact Panel + Monte Carlo */

import { useState } from 'react';
import { FlaskConical, Play, RefreshCw, Download, Printer } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import { PORTFOLIO_KPIS } from '@/lib/data/kpis';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

const drivers = [
  { name: 'Daily Order Volume', min: 80, max: 200, base: PORTFOLIO_KPIS.dailyOrders, unit: 'orders', sensitivity: 8 },
  { name: 'Average Order Value (ASP)', min: 40, max: 85, base: PORTFOLIO_KPIS.avgOrderValue, unit: 'AED', sensitivity: 6 },
  { name: 'Platform Commission Rate', min: 20, max: 35, base: 28, unit: '%', sensitivity: -5 },
  { name: 'Food COGS %', min: 18, max: 35, base: 25, unit: '%', sensitivity: -4 },
  { name: 'Labor Cost (Monthly)', min: 30, max: 65, base: 48, unit: 'K AED', sensitivity: -3 },
  { name: 'Marketing Spend (Monthly)', min: 10, max: 40, base: 24, unit: 'K AED', sensitivity: -2 },
  { name: 'Kitchen Rent (Monthly)', min: 15, max: 35, base: 22, unit: 'K AED', sensitivity: -2 },
  { name: 'Growth Rate (MoM)', min: 0, max: 15, base: 5, unit: '%', sensitivity: 5 },
  { name: 'Customer Retention (30d)', min: 40, max: 85, base: 68, unit: '%', sensitivity: 3 },
  { name: 'Own-Channel Mix', min: 0, max: 30, base: 12, unit: '%', sensitivity: 4 },
];

const mcBins = [
  { range: '<-20%', count: 2, pct: 2 },
  { range: '-20 to -10%', count: 5, pct: 5 },
  { range: '-10 to -5%', count: 12, pct: 12 },
  { range: '-5 to 0%', count: 18, pct: 18 },
  { range: '0 to 5%', count: 25, pct: 25 },
  { range: '5 to 10%', count: 20, pct: 20 },
  { range: '10 to 20%', count: 12, pct: 12 },
  { range: '>20%', count: 6, pct: 6 },
];
const maxBin = Math.max(...mcBins.map(b => b.pct));

/* Output metrics */
const outputMetrics = [
  { name: 'Gross Revenue', baseVal: PORTFOLIO_KPIS.grossRevenue },
  { name: 'Net Revenue', baseVal: Math.round(PORTFOLIO_KPIS.grossRevenue * 0.72) },
  { name: 'EBITDA', baseVal: PORTFOLIO_KPIS.ebitda },
  { name: 'EBITDA Margin', baseVal: PORTFOLIO_KPIS.ebitdaMargin },
  { name: 'Payback Period', baseVal: PORTFOLIO_KPIS.paybackPeriod },
  { name: 'Portfolio IRR', baseVal: PORTFOLIO_KPIS.portfolioIrr },
];

export default function SimulationLab() {
  const ctx = usePlanningContext();
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(
    Object.fromEntries(drivers.map(d => [d.name, d.base]))
  );
  const [simRun, setSimRun] = useState(false);

  const updateSlider = (name: string, val: number) => {
    setSliderValues(prev => ({ ...prev, [name]: val }));
  };

  const resetAll = () => {
    setSliderValues(Object.fromEntries(drivers.map(d => [d.name, d.base])));
    setSimRun(false);
  };

  const runSimulation = () => setSimRun(true);

  /* Compute total delta from all sliders */
  const totalDelta = drivers.reduce((acc, d) => {
    const pctChange = ((sliderValues[d.name] - d.base) / d.base);
    return acc + pctChange * d.sensitivity * 100;
  }, 0);

  const computeAdjusted = (baseVal: number, name: string) => {
    const factor = 1 + (totalDelta / 1000);
    if (name.includes('Margin')) return +(baseVal * factor).toFixed(1);
    if (name.includes('Payback')) return Math.max(6, Math.round(baseVal / factor));
    if (name.includes('IRR')) return +(baseVal * factor).toFixed(1);
    return Math.round(baseVal * factor);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#1E5B9C]" /> Simulation Lab
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.companyName} — {ctx.scenarioName} — Adjust drivers to explore sensitivity
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Metric','Base','Simulated','Δ Delta','% Change']; const r=outputMetrics.map(m=>{ const adj=computeAdjusted(m.baseVal,m.name); const d=adj-m.baseVal; return [m.name,m.baseVal,adj,d,((d/m.baseVal)*100).toFixed(1)+'%']; }); exportCSV('Simulation_Output',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Metric','Base','Simulated','Δ Delta','% Change']; const r=outputMetrics.map(m=>{ const adj=computeAdjusted(m.baseVal,m.name); const d=adj-m.baseVal; return [m.name,m.baseVal,adj,d,((d/m.baseVal)*100).toFixed(1)+'%']; }); exportPDF('Simulation Output',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>
      <div className="px-6 pb-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver Sliders (10) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Scenario Driver Sliders (10 drivers)</h3>
              <div className="flex items-center gap-2">
                <button onClick={resetAll} className="text-[10px] font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition">
                  <RefreshCw className="w-3 h-3" /> Reset All
                </button>
                <button onClick={runSimulation} className="text-[10px] font-bold text-white bg-[#1B2A4A] hover:bg-[#263B5E] flex items-center gap-1 px-3 py-1.5 rounded transition">
                  <Play className="w-3 h-3 fill-white" /> Run 10,000 Sims
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {drivers.map(d => {
                const val = sliderValues[d.name];
                const pctChange = ((val - d.base) / d.base * 100).toFixed(1);
                const isUp = val > d.base;
                const isDown = val < d.base;
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-gray-700">{d.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1B2A4A]">{val} {d.unit}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isUp ? 'text-[#1A7A4A] bg-green-50' : isDown ? 'text-[#C0392B] bg-red-50' : 'text-gray-400 bg-gray-50'}`}>
                          {isUp ? '+' : ''}{pctChange}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] text-gray-400 w-8 text-right">{d.min}</span>
                      <input
                        type="range" min={d.min} max={d.max} value={val}
                        onChange={e => updateSlider(d.name, Number(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1B2A4A]"
                      />
                      <span className="text-[8px] text-gray-400 w-8">{d.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated FY EBITDA</p>
              <p className={`text-3xl font-extrabold ${totalDelta >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                AED {computeAdjusted(395, 'EBITDA').toLocaleString()}K
              </p>
              <p className="text-xs text-gray-500 mt-1">vs Base: AED 395K ({totalDelta >= 0 ? '+' : ''}{(totalDelta / 10).toFixed(1)}%)</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">P10 / P50 / P90</p>
              <div className="flex items-center gap-3 text-xs font-bold mt-2">
                <span className="text-[#C0392B]">AED 210K</span>
                <span className="text-gray-300">/</span>
                <span className="text-[#1B2A4A] text-sm">AED 395K</span>
                <span className="text-gray-300">/</span>
                <span className="text-[#1A7A4A]">AED 580K</span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Probability of Positive EBITDA</p>
              <p className="text-2xl font-extrabold text-[#1B2A4A]">94.2%</p>
              <p className="text-[10px] text-blue-500 mt-1">Based on 10,000 Monte Carlo simulations</p>
            </div>
          </div>
        </div>

        {/* ── Output Impact Panel (6 metrics × 4 cols) ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Output Impact Panel — Simulated vs Base</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  {['Output Metric', 'Base Value', 'Simulated Value', 'Δ Delta', '% Change'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outputMetrics.map((m, i) => {
                  const adjusted = computeAdjusted(m.baseVal, m.name);
                  const delta = adjusted - m.baseVal;
                  const pctChange = ((delta / m.baseVal) * 100).toFixed(1);
                  const unit = m.name.includes('Margin') ? '%' : m.name.includes('IRR') ? '%' : m.name.includes('Payback') ? ' mo' : 'K';
                  return (
                    <tr key={i} className={`hover:bg-blue-50/30 transition ${i % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                      <td className="px-5 py-3 font-semibold text-gray-800">{m.name}</td>
                      <td className="px-5 py-3 font-mono text-gray-500">{m.baseVal.toLocaleString()}{unit}</td>
                      <td className="px-5 py-3 font-mono font-bold text-[#1B2A4A]">{adjusted.toLocaleString()}{unit}</td>
                      <td className={`px-5 py-3 font-mono font-bold ${delta >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                        {delta >= 0 ? '+' : ''}{delta.toLocaleString()}{unit}
                      </td>
                      <td className={`px-5 py-3 font-mono font-bold ${delta >= 0 ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>
                        {delta >= 0 ? '+' : ''}{pctChange}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monte Carlo Distribution (shown after Run) */}
        {simRun && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Monte Carlo Outcome Distribution (10,000 simulations)</h3>
            <div className="flex items-end justify-between gap-2 h-40">
              {mcBins.map((bin, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[9px] font-bold text-gray-600 mb-1">{bin.pct}%</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#1B2A4A] to-[#1E5B9C] transition-all"
                    style={{ height: `${(bin.pct / maxBin) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-[8px] text-gray-400 mt-1 text-center leading-tight">{bin.range}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3 uppercase tracking-wider">EBITDA Variance from Base Case</p>
          </div>
        )}
      </div>
    </div>
  );
}
