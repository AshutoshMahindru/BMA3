"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, BarChart3, Settings2, DollarSign,
  MapPin, Shield, FileCheck, Bell, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Wifi, WifiOff,
} from 'lucide-react';
import {
  PlanningContextProvider, usePlanningContext,
  scopeLabels, timePeriodLabels, scenarioLabels,
  type Scope, type TimePeriod, type ScenarioKey,
} from '@/lib/planning-context';

/* ──────────────────────────────────────────────────────────────────────────
   NAVIGATION STRUCTURE — 7 top-level tabs, each maps to wireframe screens
   S01=Overview, S02-S05=Executive, S06-S10=Assumptions,
   S11-S15=Financials, S16-S18=Markets, S19-S22=Risk, S23-S24=Governance
   ────────────────────────────────────────────────────────────────────── */
const navGroups = [
  { key: 'overview',    label: 'Overview',       icon: LayoutDashboard, href: '/dashboard' },
  { key: 'executive',   label: 'Executive',      icon: BarChart3,       href: '/dashboard/executive',
    children: [
      { label: 'Executive Cockpit',     href: '/dashboard/executive' },
      { label: 'Scenario Comparison',   href: '/dashboard/scenario' },
      { label: 'Cash & Funding',        href: '/dashboard/cash' },
      { label: 'Capital Strategy',      href: '/dashboard/capital' },
    ]
  },
  { key: 'assumptions', label: 'Assumptions',    icon: Settings2,       href: '/dashboard/assumptions',
    children: [
      { label: 'Demand Assumptions',    href: '/dashboard/assumptions' },
      { label: 'Confidence Tracker',    href: '/dashboard/confidence' },
    ]
  },
  { key: 'financials',  label: 'Financials',     icon: DollarSign,      href: '/dashboard/pnl',
    children: [
      { label: 'P&L Console',           href: '/dashboard/pnl' },
      { label: 'Cash Flow Console',     href: '/dashboard/cashflow' },
      { label: 'Balance Sheet',         href: '/dashboard/balance-sheet' },
      { label: 'Unit Economics',        href: '/dashboard/unit-economics' },
      { label: 'Driver Explainability', href: '/dashboard/explainability' },
    ]
  },
  { key: 'markets',     label: 'Markets',        icon: MapPin,          href: '/dashboard/markets',
    children: [
      { label: 'Rollout Planner',       href: '/dashboard/markets' },
      { label: 'Attractiveness Scoring', href: '/dashboard/attractiveness' },
      { label: 'Portfolio Optimization', href: '/dashboard/portfolio' },
    ]
  },
  { key: 'risk',        label: 'Risk & Sim',     icon: Shield,          href: '/dashboard/risk',
    children: [
      { label: 'Risk Dashboard',        href: '/dashboard/risk' },
      { label: 'Simulation Lab',        href: '/dashboard/simulation' },
      { label: 'Triggers & Alerts',     href: '/dashboard/triggers' },
    ]
  },
  { key: 'governance',  label: 'Governance',     icon: FileCheck,       href: '/dashboard/governance',
    children: [
      { label: 'Governance Dashboard',  href: '/dashboard/governance' },
      { label: 'Version Manager',       href: '/dashboard/versions' },
      { label: 'Decision Memory',       href: '/dashboard/decisions' },
    ]
  },
];

/* ── Sidebar scenario pill config ─────────────────────────────────────── */
const scenarioPills: { id: ScenarioKey; label: string; color: string }[] = [
  { id: 'base',   label: 'Base Case',   color: 'bg-blue-600' },
  { id: 'bull',   label: 'Bull Case',   color: 'bg-green-600' },
  { id: 'bear',   label: 'Bear Case',   color: 'bg-amber-600' },
  { id: 'stress', label: 'Stress Test', color: 'bg-red-600' },
];

const scopeOptions: { value: Scope; label: string }[] = [
  { value: 'portfolio', label: 'UAE Portfolio' },
  { value: 'dubai',     label: 'Dubai > All' },
  { value: 'jlt',       label: 'Dubai > JLT Cluster' },
  { value: 'jlt-north', label: 'Dubai > JLT North' },
  { value: 'uae',       label: 'Abu Dhabi' },
];

const timeOptions: { value: TimePeriod; label: string }[] = [
  { value: 'annual',     label: '2025 Annual' },
  { value: 'quarterly',  label: '2025 Q1-Q4' },
  { value: 'monthly',    label: 'Monthly View' },
  { value: 'multi-year', label: '2025-2027 (3 Year)' },
];

/* ═══════════════════════════════════════════════════════════════════════
   INNER LAYOUT — reads from PlanningContext
   ═══════════════════════════════════════════════════════════════════ */
function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const ctx = usePlanningContext();

  /* Determine which top-level tab is active */
  const getActiveGroup = () => {
    for (const g of navGroups) {
      if (g.children) {
        for (const c of g.children) {
          if (pathname === c.href) return g.key;
        }
      }
      if (pathname === g.href) return g.key;
    }
    return 'overview';
  };
  const activeGroup = getActiveGroup();

  /* Breadcrumbs */
  const breadcrumbSegments = pathname.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ═══════ GLOBAL TOP NAV ═══════ */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4">
          <div className="flex items-center h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-6 shrink-0">
              <div className="bg-[#1a2744] text-white font-bold px-2.5 py-1 rounded text-xs tracking-wider">FPE</div>
              <span className="text-gray-300 font-light">|</span>
              <span className="text-xs font-semibold text-gray-600 tracking-tight hidden md:inline">Financial Performance Engine</span>
            </div>

            {/* 7-Tab Nav */}
            <div className="flex items-center gap-0.5 flex-1">
              {navGroups.map(group => {
                const isActive = activeGroup === group.key;
                const Icon = group.icon;
                const hasDropdown = group.children && group.children.length > 0;

                return (
                  <div key={group.key} className="relative"
                    onMouseEnter={() => hasDropdown && setOpenDropdown(group.key)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <Link
                      href={group.href}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-[#f0fdfa] text-[#1a2744] border border-[#1a2744]/20 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">{group.label}</span>
                      {hasDropdown && <ChevronDown className="w-3 h-3 opacity-50" />}
                    </Link>

                    {/* Dropdown */}
                    {hasDropdown && openDropdown === group.key && (
                      <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
                        {group.children!.map(child => (
                          <Link key={child.href} href={child.href}
                            className={`block px-4 py-2 text-xs font-medium transition ${
                              pathname === child.href
                                ? 'text-[#1a2744] bg-gray-50 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right side: context pills + user */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden xl:flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2.5 py-1 border border-gray-200">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Scenario:</span>
                  <span className="text-[11px] font-semibold text-gray-700">{ctx.scenarioName}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2.5 py-1 border border-gray-200">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Period:</span>
                  <span className="text-[11px] font-semibold text-gray-700">{ctx.timePeriodLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2.5 py-1 border border-gray-200">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Scope:</span>
                  <span className="text-[11px] font-semibold text-gray-700">{ctx.companyName}</span>
                </div>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-700 transition relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-[#1a2744] text-white text-xs font-bold flex items-center justify-center">JS</div>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════ CONTENT AREA WITH SIDEBAR ═══════ */}
      <div className="flex flex-1">
        {/* ── Left Sidebar ── */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'} bg-white border-r border-gray-200 transition-all duration-200 shrink-0 hidden md:block`}>
          {sidebarOpen && (
            <div className="p-4 space-y-5">
              {/* Sidebar Toggle */}
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                <PanelLeftClose className="w-4 h-4" />
              </button>

              {/* Scope */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">Scope</h4>
                <select
                  value={ctx.scope}
                  onChange={e => ctx.setScope(e.target.value as Scope)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-md px-2.5 py-2 cursor-pointer hover:bg-white transition"
                >
                  {scopeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Time Period */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">Time Period</h4>
                <select
                  value={ctx.periodLabel}
                  onChange={e => ctx.setPeriodRange(e.target.value, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-md px-2.5 py-2 cursor-pointer hover:bg-white transition"
                >
                  {timeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Scenario */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">Scenario</h4>
                <div className="space-y-1.5">
                  {scenarioPills.map(s => (
                    <button key={s.id} onClick={() => ctx.setScenarioId(s.id)}
                      className={`w-full text-left text-xs font-medium px-3 py-2 rounded-md transition ${
                        ctx.scenarioId === s.id
                          ? `${s.color} text-white shadow-sm`
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assumption Set Status */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">Assumption Set</h4>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
                  <p className="text-[10px] font-bold text-gray-700">AS-2025-03</p>
                  <p className="text-[10px] text-gray-500">v4 (Draft) · {ctx.scenarioName}</p>
                  <p className="text-[10px] text-gray-400">Confidence: <span className="font-bold text-[#C47A1E]">76% Medium</span></p>
                  <p className="text-[10px] text-gray-400">Status: <span className="font-bold text-blue-600">Pending CFO</span></p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Sidebar re-open toggle (when collapsed) */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)}
            className="hidden md:flex items-start pt-4 pl-2 pr-1 text-gray-300 hover:text-gray-600 transition">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Breadcrumbs */}
          <div className="bg-white border-b border-gray-100 px-6 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
              <Link href="/" className="hover:text-[#1a2744] transition-colors">Home</Link>
              {breadcrumbSegments.map((seg, idx) => {
                const path = '/' + breadcrumbSegments.slice(0, idx + 1).join('/');
                const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
                const isLast = idx === breadcrumbSegments.length - 1;
                return (
                  <span key={path} className="flex items-center gap-1.5">
                    <span className="text-gray-300">/</span>
                    {isLast ? (
                      <span className="text-gray-700 font-semibold">{label}</span>
                    ) : (
                      <Link href={path} className="hover:text-[#1a2744] transition-colors">{label}</Link>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Page Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   OUTER LAYOUT — wraps inner with PlanningContextProvider
   ═══════════════════════════════════════════════════════════════════ */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanningContextProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PlanningContextProvider>
  );
}
