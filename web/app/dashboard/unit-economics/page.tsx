"use client";

import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   S14: UNIT ECONOMICS CONSOLE
   Wireframe v4.0: Per-order waterfall (GOV→EBITDA: 11 line items),
   Kitchen Ranking table (5 kitchens, 7 columns), Payback Curve chart
   ══════════════════════════════════════════════════════════════════════ */

import { Calculator, TrendingUp, TrendingDown, ArrowDown, Download, Printer } from 'lucide-react';
import { exportCSV, exportPDF } from '@/lib/export';
import { PORTFOLIO_KPIS } from '@/lib/data/kpis';
import DataFreshness from '@/components/data-freshness';

/* ── Per-Order Economics Waterfall ────────────────────────────────────── */
type WaterfallRow = { label: string; value: number; cumulative: number; type: 'revenue' | 'cost' | 'margin'; marginLabel?: string };

const waterfall: WaterfallRow[] = [
  { label: 'Gross Order Value (GOV)', value: PORTFOLIO_KPIS.avgOrderValue, cumulative: PORTFOLIO_KPIS.avgOrderValue, type: 'revenue' },
  { label: 'Less: Discounts & Promos', value: -5.3, cumulative: 56.7, type: 'cost' },
  { label: 'Net Order Value (NOV)', value: 56.7, cumulative: 56.7, type: 'margin', marginLabel: 'CM0' },
  { label: 'Less: Platform Commission', value: -15.9, cumulative: 40.8, type: 'cost' },
  { label: 'Net Revenue (NR)', value: 40.8, cumulative: 40.8, type: 'margin', marginLabel: 'CM1' },
  { label: 'Less: Food COGS', value: -14.2, cumulative: 26.6, type: 'cost' },
  { label: 'Less: Packaging', value: -2.1, cumulative: 24.5, type: 'cost' },
  { label: 'Gross Profit', value: 24.5, cumulative: 24.5, type: 'margin', marginLabel: 'CM2' },
  { label: 'Less: Marketing / CAC', value: -3.2, cumulative: 21.3, type: 'cost' },
  { label: 'CM3 (Post-Marketing)', value: 21.3, cumulative: 21.3, type: 'margin', marginLabel: 'CM3' },
  { label: 'Less: Fixed OPEX Allocation', value: -8.5, cumulative: PORTFOLIO_KPIS.ebitdaPerOrder, type: 'cost' },
  { label: 'EBITDA per Order', value: PORTFOLIO_KPIS.ebitdaPerOrder, cumulative: PORTFOLIO_KPIS.ebitdaPerOrder, type: 'margin', marginLabel: 'CM4' },
];

const maxWaterfall = Math.max(...waterfall.map(w => Math.abs(w.value)));

/* ── Kitchen Ranking Table ───────────────────────────────────────────── */
const kitchenRanking = [
  { kitchen: 'JLT North Kitchen', orders: 4350, aov: 'AED 64', cm2: 'AED 26.2', cm2Pct: '42.2%', ebitdaPerOrder: 'AED 14.5', payback: '14 mo', rank: 1 },
  { kitchen: 'Marina Kitchen', orders: 3800, aov: 'AED 61', cm2: 'AED 24.8', cm2Pct: '40.7%', ebitdaPerOrder: 'AED 12.8', payback: '16 mo', rank: 2 },
  { kitchen: 'Downtown Kitchen', orders: 2900, aov: 'AED 68', cm2: 'AED 28.4', cm2Pct: '41.8%', ebitdaPerOrder: 'AED 11.2', payback: '20 mo', rank: 3 },
  { kitchen: 'JBR Kitchen', orders: 2200, aov: 'AED 58', cm2: 'AED 22.1', cm2Pct: '38.1%', ebitdaPerOrder: 'AED 9.8', payback: '22 mo', rank: 4 },
  { kitchen: 'Abu Dhabi Kitchen', orders: 1800, aov: 'AED 55', cm2: 'AED 20.5', cm2Pct: '37.3%', ebitdaPerOrder: 'AED 7.2', payback: '28 mo', rank: 5 },
];

/* ── Payback Curve Data ──────────────────────────────────────────────── */
const paybackCurve = [
  { month: 0, cumCF: -470 }, { month: 3, cumCF: -380 }, { month: 6, cumCF: -260 },
  { month: 9, cumCF: -120 }, { month: 12, cumCF: 30 }, { month: 15, cumCF: 210 },
  { month: 18, cumCF: 420 }, { month: 21, cumCF: 660 }, { month: 24, cumCF: 920 },
];

export default function UnitEconomicsConsole() {
  const ctx = usePlanningContext();
  const fmtAed = (v: number) => `AED ${Math.abs(v).toFixed(1)}`;

  return (
    <div className="flex-1 flex flex-col">

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1E5B9C]" />
            Unit Economics Console
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
            {ctx.scopeLabel} — {ctx.scenarioLabel} — Per-Order Breakdown
            <DataFreshness />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const h=['Line Item','AED/Order','% of GOV']; const r=waterfall.map(x=>[x.label,x.value,(x.value/62*100).toFixed(1)+'%']); exportCSV('UnitEconomics',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => { const h=['Line Item','AED/Order','% of GOV']; const r=waterfall.map(x=>[x.label,x.value,(x.value/62*100).toFixed(1)+'%']); exportPDF('Unit Economics',h,r); }} className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#1B2A4A] px-3 py-2 rounded-lg hover:bg-[#263B5E] transition shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">

        {/* ═══════ PER-ORDER ECONOMICS WATERFALL ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              Per-Order Economics Waterfall (GOV → EBITDA)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1B2A4A] text-white">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider w-[260px] border-r border-white/10">Line Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider w-[100px]">AED / Order</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider w-[80px]">% of GOV</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider w-[80px]">Margin</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Visual</th>
                </tr>
              </thead>
              <tbody>
                {waterfall.map((row, idx) => {
                  const pctOfGOV = ((row.value / 62) * 100);
                  const barWidth = (Math.abs(row.value) / maxWaterfall) * 100;
                  const isMargin = row.type === 'margin';
                  const isCost = row.type === 'cost';
                  return (
                    <tr key={idx} className={`transition hover:bg-blue-50/30 ${
                      isMargin ? 'bg-blue-50/50 border-y border-blue-200' :
                      idx % 2 === 0 ? '' : 'bg-[#F4F5F7]'
                    }`}>
                      <td className={`px-5 py-3 border-r border-gray-100 ${isMargin ? 'font-bold text-[#1B2A4A]' : isCost ? 'pl-10 text-gray-600' : 'font-semibold text-gray-800'}`}>
                        {row.label}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${isMargin ? 'font-bold text-[#1B2A4A]' : isCost ? 'text-[#C0392B]' : 'text-gray-800 font-semibold'}`}>
                        {isCost ? `(${fmtAed(row.value)})` : fmtAed(row.value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        {Math.abs(pctOfGOV).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.marginLabel && (
                          <span className="text-[10px] font-bold text-white bg-[#1E5B9C] px-2 py-0.5 rounded">
                            {row.marginLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 flex items-center">
                          <div
                            className={`h-3 rounded ${isMargin ? 'bg-[#1E5B9C]' : isCost ? 'bg-[#C0392B]/60' : 'bg-[#1A7A4A]'}`}
                            style={{ width: `${barWidth}%`, maxWidth: '200px' }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ═══════ KITCHEN RANKING TABLE ═══════ */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Kitchen Ranking — Unit Economics
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D6E4F7]">
                    {['#', 'Kitchen', 'Monthly Orders', 'AOV', 'CM2/Order', 'CM2 %', 'EBITDA/Order', 'Payback'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-[#1B2A4A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kitchenRanking.map((k, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50/30 transition ${idx % 2 === 1 ? 'bg-[#F4F5F7]' : ''}`}>
                      <td className="px-3 py-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          k.rank === 1 ? 'bg-yellow-500' : k.rank === 2 ? 'bg-gray-400' : k.rank === 3 ? 'bg-amber-600' : 'bg-gray-300'
                        }`}>{k.rank}</span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{k.kitchen}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{k.orders.toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{k.aov}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#1A7A4A]">{k.cm2}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{k.cm2Pct}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#1B2A4A]">{k.ebitdaPerOrder}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          parseInt(k.payback) <= 18 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {k.payback}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════ PAYBACK CURVE ═══════ */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Payback Curve — Portfolio Average</h3>
            <svg viewBox="0 0 240 200" className="w-full h-auto">
              {/* Grid */}
              {[40, 80, 120, 160].map(y => (
                <line key={y} x1="30" y1={y} x2="230" y2={y} stroke="#f1f5f9" strokeWidth="1" />
              ))}
              {/* Zero line */}
              <line x1="30" y1="120" x2="230" y2="120" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
              <text x="0" y="124" fontSize="7" fill="#94a3b8">AED 0</text>
              <text x="0" y="44" fontSize="7" fill="#94a3b8">+920K</text>
              <text x="0" y="164" fontSize="7" fill="#94a3b8">-470K</text>

              {/* Payback curve path */}
              <polyline
                points={paybackCurve.map(p => {
                  const x = 30 + (p.month / 24) * 200;
                  const y = 120 - (p.cumCF / 920) * 80;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke="#1E5B9C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />

              {/* Area fill below curve */}
              <polygon
                points={`30,120 ${paybackCurve.map(p => {
                  const x = 30 + (p.month / 24) * 200;
                  const y = 120 - (p.cumCF / 920) * 80;
                  return `${x},${y}`;
                }).join(' ')} 230,120`}
                fill="url(#paybackGrad)" opacity="0.3"
              />
              <defs>
                <linearGradient id="paybackGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E5B9C" />
                  <stop offset="100%" stopColor="#1E5B9C" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Breakeven marker */}
              <circle cx={30 + (11/24) * 200} cy={120 - (0/920)*80} r="4" fill="#1A7A4A" stroke="white" strokeWidth="2" />
              <text x={30 + (11/24) * 200} y="138" fontSize="7" fill="#1A7A4A" textAnchor="middle" fontWeight="bold">Month 11</text>
              <text x={30 + (11/24) * 200} y="148" fontSize="6" fill="#1A7A4A" textAnchor="middle">Breakeven</text>

              {/* X-axis labels */}
              {[0, 6, 12, 18, 24].map(m => (
                <text key={m} x={30 + (m / 24) * 200} y="190" fontSize="7" fill="#94a3b8" textAnchor="middle">Mo {m}</text>
              ))}
            </svg>
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">Portfolio payback achieved in <span className="font-bold text-[#1A7A4A]">~11 months</span></p>
              <p className="text-[10px] text-gray-400 mt-0.5">vs. 18-month target — 39% ahead of plan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
