"use client";

import { useState, useMemo } from 'react';
import { usePlanningContext } from '@/lib/planning-context';
import { Play, RotateCcw, BarChart, Activity, Sliders, Info, Zap, TrendingUp, DollarSign, Target, ChevronRight, CheckCircle2 } from 'lucide-react';
import DataFreshness from '@/components/data-freshness';
import { triggerSimulation, fetchSimulationResults } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

/* ── Types ── */
interface SimulationSummary {
  metric_name: string;
  p10_value: number;
  p25_value: number;
  p50_value: number;
  p75_value: number;
  p90_value: number;
  mean_value: number;
  std_dev: number;
}

/* ── Constants ── */
const FALLBACK_SUMMARIES: SimulationSummary[] = [
  { metric_name: 'EBITDA', p10_value: 850, p25_value: 920, p50_value: 1050, p75_value: 1180, p90_value: 1300, mean_value: 1065, std_dev: 180 },
  { metric_name: 'Net Revenue', p10_value: 4200, p25_value: 4500, p50_value: 4800, p75_value: 5100, p90_value: 5500, mean_value: 4850, std_dev: 500 },
];

export default function SimulationLab() {
  const ctx = usePlanningContext();
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  
  // Simulation Inputs
  const [volumeUncertainty, setVolumeUncertainty] = useState(15);
  const [priceVariability, setPriceVariability] = useState(5);
  const [costShock, setCostShock] = useState(10);
  const [iterations, setIterations] = useState(1000);

  const scenarioId = ctx.scenarioId || '';

  const { data: results, source, lastFetched, refetch } = useApiData<SimulationSummary[]>(
    () => runId ? fetchSimulationResults(runId) : Promise.resolve({ data: FALLBACK_SUMMARIES, error: null }),
    FALLBACK_SUMMARIES,
    [runId]
  );

  const handleRunSimulation = async () => {
    setIsRunning(true);
    const { data, error } = await triggerSimulation({
      scenario_id: scenarioId,
      simulator_type: 'monte_carlo',
      iterations,
      input_params: { volumeUncertainty, priceVariability, costShock }
    });

    if (data?.run_id) {
      setRunId(data.run_id);
    }
    setIsRunning(false);
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val);

  /* ── Chart Components (SVG based to avoid recharts dependency issues) ── */
  const Histogram = ({ summary }: { summary: SimulationSummary }) => {
    // Generate 20 bins for the normal distribution mock
    const bins = useMemo(() => {
        const { mean_value, std_dev } = summary;
        const b = [];
        for (let i = -3; i <= 3; i += 0.3) {
            const x = mean_value + i * std_dev;
            const y = Math.exp(-0.5 * Math.pow(i, 2)) / (std_dev * Math.sqrt(2 * Math.PI));
            b.push({ x, height: y * 50000 }); // Scaling factor for visual
        }
        return b;
    }, [summary]);

    const maxH = Math.max(...bins.map(b => b.height));

    return (
      <div className="relative h-48 w-full mt-4 flex items-end justify-between px-2 gap-1 border-b border-gray-100">
         {bins.map((bin, i) => (
            <div 
               key={i} 
               className="flex-1 bg-[#4A90E2] rounded-t-sm transition-all duration-700 hover:bg-[#1E5B9C] cursor-help group relative"
               style={{ height: `${(bin.height / maxH) * 100}%` }}
            >
               <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[9px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20">
                  Value: {fmt(bin.x)}K
               </div>
            </div>
         ))}
         {/* Statistic Markers */}
         <div className="absolute top-0 bottom-0 border-l border-red-400 border-dashed z-10" style={{ left: '10%' }}><span className="absolute -top-4 -left-3 text-[9px] font-bold text-red-500">P10</span></div>
         <div className="absolute top-0 bottom-0 border-l border-[#1B2A4A] z-10" style={{ left: '50%' }}><span className="absolute -top-5 -left-4 text-[9px] font-bold text-[#1B2A4A]">P50 (Median)</span></div>
         <div className="absolute top-0 bottom-0 border-l border-emerald-400 border-dashed z-10" style={{ left: '90%' }}><span className="absolute -top-4 -left-3 text-[9px] font-bold text-emerald-500">P90</span></div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#1E5B9C]" />
              Simulation Lab & Monte Carlo Workbench
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
              Probabilistic Modeling — {ctx.scenarioName}
              <DataFreshness source={source} lastFetched={lastFetched} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setRunId(null); setVolumeUncertainty(15); setPriceVariability(5); }}
              className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={handleRunSimulation}
              disabled={isRunning}
              className={`flex items-center gap-2 text-sm font-bold px-6 py-2 rounded-lg shadow-md transition ${
                isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1E5B9C] hover:bg-[#1B2A4A] text-white'
              }`}
            >
              {isRunning ? <Zap className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isRunning ? 'Running 1,000 Iterations...' : 'Execute Monte Carlo'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 grid grid-cols-12 gap-6">
        
        {/* Left: Configuration Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                <Sliders className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">Variable Uncertainty</h3>
             </div>
             
             <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                     <label className="text-xs font-semibold text-gray-700">Volume Uncertainty (SD%)</label>
                     <span className="text-xs font-bold text-[#1E5B9C] bg-blue-50 px-2 py-0.5 rounded">±{volumeUncertainty}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="30" step="1" 
                    value={volumeUncertainty} 
                    onChange={(e) => setVolumeUncertainty(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#1E5B9C]" 
                  />
                  <p className="text-[10px] text-gray-400 mt-2">Impacts Gross Orders and Delivery Logistic costs.</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                     <label className="text-xs font-semibold text-gray-700">AOV / Pricing Variability</label>
                     <span className="text-xs font-bold text-[#1E5B9C] bg-blue-50 px-2 py-0.5 rounded">±{priceVariability}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="15" step="0.5" 
                    value={priceVariability} 
                    onChange={(e) => setPriceVariability(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#1E5B9C]" 
                  />
                  <p className="text-[10px] text-gray-400 mt-2">Simulates promo fatigue and competitor pricing shocks.</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                     <label className="text-xs font-semibold text-gray-700">Cost Shock Probability</label>
                     <span className="text-xs font-bold text-[#E67E22] bg-orange-50 px-2 py-0.5 rounded">{costShock}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="50" step="5" 
                    value={costShock} 
                    onChange={(e) => setCostShock(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#E67E22]" 
                  />
                  <p className="text-[10px] text-gray-400 mt-2">Probability of a +20% spike in COGS/Labor.</p>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  <div className="bg-gray-50 rounded-lg p-4">
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                       <Target className="w-3 h-3" /> Distribution Engine
                     </p>
                     <select className="w-full bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 p-0">
                        <option>Normal (Gaussian)</option>
                        <option>Triangular</option>
                        <option>Log-Normal</option>
                     </select>
                  </div>
                </div>
             </div>
          </div>

          <div className="bg-[#1B2A4A] rounded-xl p-6 text-white shadow-lg">
             <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-[#4A90E2]" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-white">Confidence Targets</h4>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/10 pb-3">
                   <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-tight">EBITDA &gt; 1M AED</p>
                      <p className="text-xl font-bold">82% <span className="text-xs font-normal text-emerald-400">Confidence</span></p>
                   </div>
                   <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                </div>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-tight">Break-even Coverage</p>
                      <p className="text-xl font-bold">94% <span className="text-xs font-normal text-emerald-400">High</span></p>
                   </div>
                   <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                </div>
             </div>
          </div>
        </div>

        {/* Right: Results Dashboard */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
           {/* Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.slice(0, 3).map((res, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.metric_name} (Mean)</p>
                   <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-xl font-bold text-gray-900">AED {fmt(res.mean_value)}K</p>
                      <p className="text-[10px] font-bold text-[#E67E22]">σ ±{fmt(res.std_dev)}K</p>
                   </div>
                   <div className="mt-4 grid grid-cols-3 gap-1">
                      <div className="text-center bg-gray-50 rounded py-1.5">
                         <p className="text-[8px] text-gray-400 font-bold">P10</p>
                         <p className="text-[10px] font-bold text-gray-700">{fmt(res.p10_value)}K</p>
                      </div>
                      <div className="text-center bg-blue-50 rounded py-1.5 border border-blue-100">
                         <p className="text-[8px] text-[#1E5B9C] font-bold">P50</p>
                         <p className="text-[10px] font-bold text-[#1E5B9C]">{fmt(res.p50_value)}K</p>
                      </div>
                      <div className="text-center bg-gray-50 rounded py-1.5">
                         <p className="text-[8px] text-gray-400 font-bold">P90</p>
                         <p className="text-[10px] font-bold text-gray-700">{fmt(res.p90_value)}K</p>
                      </div>
                   </div>
                </div>
              ))}
           </div>

           {/* Histograms */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {results.map((res, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                        <BarChart className="w-4 h-4 text-gray-400" />
                        {res.metric_name} Probability Distribution
                      </h4>
                      <Info className="w-3.5 h-3.5 text-gray-300" />
                   </div>
                   <Histogram summary={res} />
                   <div className="mt-4 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span>Worse Case</span>
                      <span>Expected Outcome</span>
                      <span>Upside Potential</span>
                   </div>
                </div>
              ))}
           </div>

           {/* Sensitivity Matrix Preview (S18) */}
           <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                 <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                   <Zap className="w-4 h-4 text-[#E67E22]" />
                   EBITDA Sensitivity Matrix (Price vs Volume)
                 </h4>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Impact in AED &apos;000s</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-center">
                    <thead>
                       <tr>
                          <th className="bg-gray-50 border border-gray-100 p-2 text-[9px] font-bold text-gray-400 line-clamp-1">PRICE \ VOL</th>
                          {['-10%', '-5%', 'Base', '+5%', '+10%'].map(v => (
                            <th key={v} className="bg-gray-50 border border-gray-100 p-2 text-[10px] font-bold text-gray-700">{v}</th>
                          ))}
                       </tr>
                    </thead>
                    <tbody>
                       {['-10%', '-5%', 'Base', '+5%', '+10%'].map((p, pIdx) => (
                         <tr key={p}>
                            <td className="bg-gray-50 border border-gray-100 p-2 text-[10px] font-bold text-gray-700">{p}</td>
                            {[0.7, 0.85, 1.0, 1.15, 1.3].map((v, vIdx) => {
                               const val = 1050 * v * (1 - (pIdx - 2) * 0.1);
                               const heatmap = val > 1200 ? 'bg-emerald-100 text-emerald-800' : val < 800 ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800';
                               return (
                                 <td key={vIdx} className={`border border-gray-100 p-3 text-[11px] font-mono font-bold ${heatmap}`}>
                                    {fmt(val)}
                                 </td>
                               );
                            })}
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
