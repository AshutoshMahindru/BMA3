"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S15: DRIVER EXPLAINABILITY CONSOLE
   Wireframe v4.0: EBITDA Bridge waterfall (10 drivers, prior→current),
   Driver Attribution table (10 rows, 5 cols), Formula Explorer (5 formulas)
   ══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Lightbulb, ArrowRight, ChevronDown, Zap, BookOpen, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import DataFreshness from '@/components/data-freshness';

/* ── Output Metric Selector ──────────────────────────────────────────── */
const metrics = ['EBITDA', 'Revenue', 'CM1', 'Gross Profit'];

/* ── EBITDA Bridge Waterfall Data ────────────────────────────────────── */
const bridgeData = [
  { label: 'Prior EBITDA', value: 83000, type: 'anchor' as const },
  { label: 'Volume Growth — JLT', value: 15200, type: 'positive' as const },
  { label: 'Volume Growth — Marina', value: 8400, type: 'positive' as const },
  { label: 'Price / Mix Optimization', value: 6800, type: 'positive' as const },
  { label: 'Commission Renegotiation', value: 4200, type: 'positive' as const },
  { label: 'New Kitchen (Downtown)', value: 3600, type: 'positive' as const },
  { label: 'COGS Inflation', value: -3800, type: 'negative' as const },
  { label: 'Labor Cost Increase', value: -4500, type: 'negative' as const },
  { label: 'Marketing Spend Increase', value: -2400, type: 'negative' as const },
  { label: 'Rent Escalation', value: -1500, type: 'negative' as const },
  { label: 'Current EBITDA', value: 109000, type: 'anchor' as const },
];

/* ── Driver Attribution Table ────────────────────────────────────────── */
const driverAttribution = [
  { driver: 'Order Volume — JLT', contribution: 'AED 15,200', direction: '▲', pctImpact: '+18.3%', rootAssumption: 'Base Orders: 145/day', confidence: 82 },
  { driver: 'Order Volume — Marina', contribution: 'AED 8,400', direction: '▲', pctImpact: '+10.1%', rootAssumption: 'Base Orders: 120/day', confidence: 78 },
  { driver: 'ASP / Mix Optimization', contribution: 'AED 6,800', direction: '▲', pctImpact: '+8.2%', rootAssumption: 'AOV: AED 62 (+6.9%)', confidence: 88 },
  { driver: 'Commission Rate', contribution: 'AED 4,200', direction: '▲', pctImpact: '+5.1%', rootAssumption: 'Talabat: 28% → 25%', confidence: 75 },
  { driver: 'New Kitchen — Downtown', contribution: 'AED 3,600', direction: '▲', pctImpact: '+4.3%', rootAssumption: '95 orders/day from Mo 6', confidence: 65 },
  { driver: 'COGS Inflation', contribution: '(AED 3,800)', direction: '▼', pctImpact: '-4.6%', rootAssumption: 'Food: +4.1%, Packaging: +8.7%', confidence: 85 },
  { driver: 'Labor Cost', contribution: '(AED 4,500)', direction: '▼', pctImpact: '-5.4%', rootAssumption: 'Chef +6.3%, FTE reduction -7.1%', confidence: 80 },
  { driver: 'Marketing Spend', contribution: '(AED 2,400)', direction: '▼', pctImpact: '-2.9%', rootAssumption: 'CAC: AED 35 (-16.7%)', confidence: 72 },
  { driver: 'Rent Escalation', contribution: '(AED 1,500)', direction: '▼', pctImpact: '-1.8%', rootAssumption: 'Contractual 5% annual', confidence: 95 },
  { driver: 'Net Impact', contribution: 'AED 26,000', direction: '▲', pctImpact: '+31.3%', rootAssumption: '—', confidence: 76 },
];

/* ── Formula Explorer ────────────────────────────────────────────────── */
const formulas = [
  { name: 'EBITDA', formula: 'Net Revenue − COGS − OPEX − Marketing − Labor', inputs: 'NR, COGS, OPEX, Marketing, Labor', output: 'AED 109,000' },
  { name: 'Net Revenue', formula: 'GOV × (1 − Discount%) × (1 − Commission%)', inputs: 'GOV, Discount Rate, Commission Rate', output: 'AED 281,000' },
  { name: 'CM1 (post-commission)', formula: 'NOV − (Platform Commission)', inputs: 'NOV, Commission Rate per Platform', output: 'AED 40.8 / order' },
  { name: 'CM2 (post-COGS)', formula: 'CM1 − Food COGS − Packaging', inputs: 'CM1, Food %, Packaging per order', output: 'AED 24.5 / order' },
  { name: 'Payback Period', formula: 'Kitchen CAPEX ÷ Monthly EBITDA Contribution', inputs: 'Build Cost, Monthly EBITDA', output: '18 months' },
];

export default function DriverExplainability() {
  const ctx = usePlanningContext();
  const [selectedMetric, setSelectedMetric] = useState('EBITDA');

  const maxBridgeValue = Math.max(...bridgeData.filter(d => d.type !== 'anchor').map(d => Math.abs(d.value)));
  const fmt = (v: number) => new Intl.NumberFormat('en-AE').format(Math.abs(v));

  return (
    <div className="flex-1 flex flex-col">

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#1E5B9C]" />
              Driver Explainability Console
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              {ctx.scopeLabel} — {ctx.scenarioLabel} — Month-over-Month Attribution
              <DataFreshness />
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Output Metric Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {metrics.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMetric(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedMetric === m
                      ? 'bg-[#1B2A4A] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {/* Export Buttons */}
            <button
              onClick={() => {
                const h = ['Driver', 'Contribution', 'Direction', '% Impact', 'Root Assumption', 'Confidence'];
                const r = driverAttribution.map(d => [d.driver, d.contribution, d.direction, d.pctImpact, d.rootAssumption, d.confidence + '%']);
                exportCSV(`Explainability_${ctx.scenarioLabel.replace(/ /g, '_')}`, h, r);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => {
                const h = ['Driver', 'Contribution', '% Impact', 'Root Assumption', 'Confidence'];
                const r = driverAttribution.map(d => [d.driver, d.contribution, d.pctImpact, d.rootAssumption, d.confidence + '%']);
                exportPDF(`Driver Explainability — ${ctx.scenarioLabel}`, h, r);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* ═══════ EBITDA BRIDGE WATERFALL ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#1E5B9C]" />
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              {selectedMetric} Bridge — Prior Period vs Current
            </h3>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {bridgeData.map((item, idx) => {
                const barWidth = item.type === 'anchor' ? 0 : (Math.abs(item.value) / maxBridgeValue) * 100;
                return (
                  <div key={idx} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                    item.type === 'anchor' ? 'bg-[#1B2A4A] text-white' :
                    item.type === 'positive' ? 'bg-green-50/50 hover:bg-green-50' :
                    'bg-red-50/50 hover:bg-red-50'
                  } transition`}>
                    <div className="w-48 shrink-0 text-xs font-semibold truncate">{item.label}</div>
                    <div className="flex-1 flex items-center h-6">
                      {item.type !== 'anchor' && (
                        <div
                          className={`h-5 rounded ${item.type === 'positive' ? 'bg-[#1A7A4A]' : 'bg-[#C0392B]'}`}
                          style={{ width: `${barWidth}%`, minWidth: '2px' }}
                        />
                      )}
                    </div>
                    <div className={`w-28 text-right font-mono text-sm font-bold shrink-0 ${
                      item.type === 'anchor' ? '' :
                      item.type === 'positive' ? 'text-[#1A7A4A]' : 'text-[#C0392B]'
                    }`}>
                      {item.type === 'anchor' ? `AED ${fmt(item.value)}` :
                       item.type === 'positive' ? `+AED ${fmt(item.value)}` : `(AED ${fmt(item.value)})`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ DRIVER ATTRIBUTION TABLE ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Driver Attribution Detail
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Driver', 'Contribution', 'Direction', '% Impact', 'Root Assumption', 'Confidence'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {driverAttribution.map((row, idx) => {
                  const isTotal = row.driver === 'Net Impact';
                  return (
                    <tr key={idx} className={`hover:bg-blue-50/30 transition ${
                      isTotal ? 'bg-blue-50 border-y-2 border-blue-300 font-bold' :
                      idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''
                    }`}>
                      <td className={`px-4 py-2.5 ${isTotal ? 'font-bold text-[#1B2A4A]' : 'font-semibold text-gray-800'}`}>{row.driver}</td>
                      <td className={`px-4 py-2.5 font-mono ${row.direction === '▲' ? 'text-[#1A7A4A] font-bold' : 'text-[#C0392B] font-bold'}`}>{row.contribution}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm ${row.direction === '▲' ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{row.direction}</span>
                      </td>
                      <td className={`px-4 py-2.5 font-mono font-bold ${row.pctImpact.startsWith('+') ? 'text-[#1A7A4A]' : 'text-[#C0392B]'}`}>{row.pctImpact}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.rootAssumption}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.confidence >= 80 ? 'bg-[#1A7A4A]' : row.confidence >= 60 ? 'bg-[#C47A1E]' : 'bg-[#C0392B]'}`}
                              style={{ width: `${row.confidence}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-500">{row.confidence}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ FORMULA EXPLORER ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#1E5B9C]" />
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Formula Explorer — Calculation Transparency
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Metric', 'Formula', 'Key Inputs', 'Current Output'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formulas.map((f, idx) => (
                  <tr key={idx} className={`hover:bg-blue-50/30 transition ${idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1B2A4A]">{f.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 text-[11px]">{f.formula}</td>
                    <td className="px-4 py-3 text-gray-600">{f.inputs}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#1B2A4A]">{f.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
