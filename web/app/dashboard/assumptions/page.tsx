"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Settings2, Save, Play, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, Clock, User, Shield,
  Plus, Trash2, Copy,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { usePlanningContext } from '@/lib/planning-context';
import {
  getAssumptionsSets,
  getAssumptionsDemand,
  getAssumptionsCost,
  getAssumptionsFunding,
  getAssumptionsWorkingCapital,
  upsertAssumptionsDemandBulk,
  upsertAssumptionsCostBulk,
  upsertAssumptionsFundingBulk,
  upsertAssumptionsWorkingCapitalBulk,
  createComputeRuns,
} from '@/lib/api-client';
import DataFreshness from '@/components/data-freshness';
import type { DataSource } from '@/lib/data-source';

ModuleRegistry.registerModules([AllCommunityModule]);
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

/* ══════════════════════════════════════════════════════════════════════════
   S06-S09: ASSUMPTIONS MANAGER — 8-Tab Editable Grid + Info Bar
   Each tab has its own AG Grid with editable columns.
   Pre-refactor stabilization mode: local editing only until canonical
   assumption bindings and compute orchestration are migrated.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Assumption Set Info Bar ─────────────────────────────────────────── */
interface AssumptionPanelInfo {
  setId: string;
  version: string;
  owner: string;
  confidence: number;
  confidenceLabel: string;
  lastModified: string;
  approvalStatus: string;
}

const defaultSetInfo: AssumptionPanelInfo = {
  setId: 'Preview only',
  version: 'Canonical migration pending',
  owner: 'Pre-refactor shell',
  confidence: 0,
  confidenceLabel: 'Preview',
  lastModified: 'Local session only',
  approvalStatus: 'Preview only',
};

function formatPanelDate(value: string | null | undefined) {
  if (!value) return 'Local session only';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Local session only';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/* ── 8-Tab definitions with column schemas & seed data ────────────── */
const subTabs = [
  { key: 'demand',    label: 'Demand' },
  { key: 'pricing',   label: 'Pricing' },
  { key: 'cost',      label: 'Cost' },
  { key: 'labor',     label: 'Labor' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'capex',     label: 'CAPEX' },
  { key: 'funding',   label: 'Funding' },
  { key: 'wc',        label: 'Working Capital' },
];

/* Column definitions per tab */
const tabColumns: Record<string, any[]> = {
  demand: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
    { field: 'reviewDate', headerName: 'Review Date', editable: true, minWidth: 130 },
  ],
  pricing: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
    { field: 'reviewDate', headerName: 'Review Date', editable: true, minWidth: 130 },
  ],
  cost: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
  ],
  labor: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
    { field: 'reviewDate', headerName: 'Review Date', editable: true, minWidth: 130 },
  ],
  marketing: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
  ],
  capex: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
  ],
  funding: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'evidence', headerName: 'Evidence', editable: true, minWidth: 160 },
    { field: 'owner', headerName: 'Owner', editable: true, minWidth: 120 },
  ],
  wc: [
    { field: 'name', headerName: 'Assumption', pinned: 'left', minWidth: 220, editable: false, cellStyle: { fontWeight: '600', color: '#1e293b' } },
    { field: 'current', headerName: 'Current Value', editable: true, minWidth: 140 },
    { field: 'prior', headerName: 'Prior Value', editable: false, minWidth: 130, cellStyle: { color: '#94a3b8' } },
    { field: 'delta', headerName: 'Δ Delta', editable: false, minWidth: 110 },
    { field: 'confidence', headerName: 'Confidence %', editable: true, filter: 'agNumberColumnFilter', minWidth: 120,
      cellStyle: (p: any) => ({ color: p.value >= 80 ? '#1A7A4A' : p.value >= 60 ? '#C47A1E' : '#C0392B', fontWeight: '700' }) },
    { field: 'evidence', headerName: 'Evidence', editable: true, minWidth: 160 },
    { field: 'impact', headerName: 'WC Impact', editable: true, minWidth: 140 },
  ],
};

/* Row seed data per tab */
const tabSeedData: Record<string, any[]> = {
  demand: [
    { id: '1', name: 'Daily Order Volume — JLT', current: '145 orders', prior: '130 orders', delta: '+11.5%', confidence: 82, owner: 'Commercial', reviewDate: '15 Apr 2026' },
    { id: '2', name: 'Daily Order Volume — Marina', current: '120 orders', prior: '115 orders', delta: '+4.3%', confidence: 78, owner: 'Commercial', reviewDate: '15 Apr 2026' },
    { id: '3', name: 'Daily Order Volume — Downtown', current: '95 orders', prior: '80 orders', delta: '+18.8%', confidence: 65, owner: 'Strategy', reviewDate: '20 Apr 2026' },
    { id: '4', name: 'Avg Basket Size (AOV)', current: 'AED 62', prior: 'AED 58', delta: '+6.9%', confidence: 88, owner: 'Commercial', reviewDate: '10 Apr 2026' },
    { id: '5', name: 'Growth Rate — Mature Markets', current: '5.0%', prior: '4.5%', delta: '+0.5pp', confidence: 80, owner: 'Strategy', reviewDate: '30 Apr 2026' },
    { id: '6', name: 'Growth Rate — New Markets', current: '15.0%', prior: '12.0%', delta: '+3.0pp', confidence: 55, owner: 'Strategy', reviewDate: '30 Apr 2026' },
    { id: '7', name: 'Seasonality Index — Q2 (Ramadan)', current: '0.82', prior: '0.85', delta: '-3.5%', confidence: 90, owner: 'Commercial', reviewDate: '01 May 2026' },
    { id: '8', name: 'Seasonality Index — Q4 (Peak)', current: '1.25', prior: '1.20', delta: '+4.2%', confidence: 92, owner: 'Commercial', reviewDate: '01 May 2026' },
    { id: '9', name: 'Platform Penetration — Talabat', current: '45%', prior: '42%', delta: '+3.0pp', confidence: 85, owner: 'Partnerships', reviewDate: '15 Apr 2026' },
    { id: '10', name: 'Customer Retention Rate', current: '68%', prior: '65%', delta: '+3.0pp', confidence: 72, owner: 'CX', reviewDate: '22 Apr 2026' },
  ],
  pricing: [
    { id: '1', name: 'Average Selling Price', current: 'AED 62', prior: 'AED 58', delta: '+6.9%', confidence: 88, owner: 'Pricing', reviewDate: '10 Apr 2026' },
    { id: '2', name: 'Discount Rate (Promo)', current: '8.5%', prior: '9.0%', delta: '-0.5pp', confidence: 80, owner: 'Marketing', reviewDate: '15 Apr 2026' },
    { id: '3', name: 'Commission Rate — Talabat', current: '28%', prior: '30%', delta: '-2.0pp', confidence: 75, owner: 'Partnerships', reviewDate: '20 Apr 2026' },
    { id: '4', name: 'Commission Rate — Deliveroo', current: '25%', prior: '25%', delta: '0.0pp', confidence: 90, owner: 'Partnerships', reviewDate: '20 Apr 2026' },
    { id: '5', name: 'Own-Channel Revenue Mix', current: '12%', prior: '8%', delta: '+4.0pp', confidence: 60, owner: 'Digital', reviewDate: '25 Apr 2026' },
    { id: '6', name: 'Price Elasticity Factor', current: '-0.35', prior: '-0.40', delta: '+0.05', confidence: 55, owner: 'Strategy', reviewDate: '30 Apr 2026' },
  ],
  cost: [
    { id: '1', name: 'Food COGS per Order', current: 'AED 14.20', prior: 'AED 14.80', delta: '-4.1%', confidence: 85 },
    { id: '2', name: 'Packaging Cost per Order', current: 'AED 2.10', prior: 'AED 2.30', delta: '-8.7%', confidence: 90 },
    { id: '3', name: 'Delivery Cost per Order', current: 'AED 5.50', prior: 'AED 5.80', delta: '-5.2%', confidence: 78 },
    { id: '4', name: 'Kitchen Rent (Monthly)', current: 'AED 15,000', prior: 'AED 15,000', delta: '0.0%', confidence: 95 },
    { id: '5', name: 'Utilities per Kitchen', current: 'AED 3,200', prior: 'AED 3,000', delta: '+6.7%', confidence: 80 },
    { id: '6', name: 'Equipment Maintenance', current: 'AED 1,800', prior: 'AED 1,500', delta: '+20.0%', confidence: 70 },
    { id: '7', name: 'Insurance per Kitchen', current: 'AED 800', prior: 'AED 750', delta: '+6.7%', confidence: 92 },
    { id: '8', name: 'Technology / SaaS Spend', current: 'AED 4,500', prior: 'AED 4,000', delta: '+12.5%', confidence: 85 },
    { id: '9', name: 'Waste / Shrinkage Rate', current: '3.5%', prior: '4.0%', delta: '-0.5pp', confidence: 72 },
    { id: '10', name: 'Payment Processing Fee', current: '1.8%', prior: '2.0%', delta: '-0.2pp', confidence: 88 },
    { id: '11', name: 'Royalty / Brand Fee', current: '5.0%', prior: '5.0%', delta: '0.0%', confidence: 95 },
    { id: '12', name: 'Contingency Buffer', current: '2.0%', prior: '2.5%', delta: '-0.5pp', confidence: 80 },
  ],
  labor: [
    { id: '1', name: 'Head Chef Salary', current: 'AED 8,500', prior: 'AED 8,000', delta: '+6.3%', confidence: 90, owner: 'HR', reviewDate: '15 Apr 2026' },
    { id: '2', name: 'Line Cook Salary (avg)', current: 'AED 4,200', prior: 'AED 4,000', delta: '+5.0%', confidence: 88, owner: 'HR', reviewDate: '15 Apr 2026' },
    { id: '3', name: 'Staff per Kitchen (FTE)', current: '6.5', prior: '7.0', delta: '-7.1%', confidence: 75, owner: 'Ops', reviewDate: '20 Apr 2026' },
    { id: '4', name: 'Staff Turnover Rate', current: '35%', prior: '40%', delta: '-5.0pp', confidence: 65, owner: 'HR', reviewDate: '25 Apr 2026' },
    { id: '5', name: 'Training Cost per Hire', current: 'AED 2,500', prior: 'AED 2,200', delta: '+13.6%', confidence: 70, owner: 'HR', reviewDate: '25 Apr 2026' },
    { id: '6', name: 'Overtime Premium', current: '25%', prior: '25%', delta: '0.0pp', confidence: 95, owner: 'HR', reviewDate: '30 Apr 2026' },
  ],
  marketing: [
    { id: '1', name: 'CAC — Acquisition Cost', current: 'AED 35', prior: 'AED 42', delta: '-16.7%', confidence: 72, owner: 'Marketing' },
    { id: '2', name: 'Marketing Spend (% Rev)', current: '8.0%', prior: '9.5%', delta: '-1.5pp', confidence: 78, owner: 'Marketing' },
    { id: '3', name: 'Promo Discount Rate', current: '8.5%', prior: '9.0%', delta: '-0.5pp', confidence: 80, owner: 'Marketing' },
    { id: '4', name: 'Reactivation Spend / User', current: 'AED 12', prior: 'AED 15', delta: '-20.0%', confidence: 68, owner: 'CRM' },
    { id: '5', name: 'Brand Awareness Budget', current: 'AED 25K/mo', prior: 'AED 20K/mo', delta: '+25.0%', confidence: 65, owner: 'Marketing' },
  ],
  capex: [
    { id: '1', name: 'Kitchen Build-Out Cost', current: 'AED 350K', prior: 'AED 380K', delta: '-7.9%', confidence: 82, owner: 'Projects' },
    { id: '2', name: 'Equipment per Kitchen', current: 'AED 120K', prior: 'AED 110K', delta: '+9.1%', confidence: 85, owner: 'Projects' },
    { id: '3', name: 'Technology Infrastructure', current: 'AED 80K', prior: 'AED 75K', delta: '+6.7%', confidence: 78, owner: 'IT' },
    { id: '4', name: 'Depreciation Period', current: '5 years', prior: '5 years', delta: '0.0%', confidence: 95, owner: 'Finance' },
    { id: '5', name: 'Maintenance CAPEX (Annual)', current: '3% of Assets', prior: '2.5% of Assets', delta: '+0.5pp', confidence: 80, owner: 'Finance' },
  ],
  funding: [
    { id: '1', name: 'Seed Round Size', current: 'AED 2.5M', prior: 'AED 2.0M', delta: '+25.0%', confidence: 85, evidence: 'Term Sheet Signed', owner: 'CFO' },
    { id: '2', name: 'Series A Target', current: 'AED 8.0M', prior: 'AED 7.5M', delta: '+6.7%', confidence: 60, evidence: 'Investor Pipeline', owner: 'CFO' },
    { id: '3', name: 'Revenue-Based Financing', current: 'AED 1.2M', prior: 'AED 1.0M', delta: '+20.0%', confidence: 70, evidence: 'Bank Indicative', owner: 'Treasury' },
    { id: '4', name: 'Debt Facility Rate', current: '9.5%', prior: '10.0%', delta: '-0.5pp', confidence: 75, evidence: 'Bank Quote', owner: 'Treasury' },
    { id: '5', name: 'Pre-Money Valuation', current: 'AED 12M', prior: 'AED 10M', delta: '+20.0%', confidence: 55, evidence: 'Comparable Analysis', owner: 'CFO' },
    { id: '6', name: 'Dilution Target (Seed)', current: '18%', prior: '20%', delta: '-2.0pp', confidence: 70, evidence: 'Board Mandate', owner: 'CFO' },
  ],
  wc: [
    { id: '1', name: 'Inventory Days', current: '5 days', prior: '7 days', delta: '-28.6%', confidence: 82, evidence: 'Supplier Terms', impact: 'AED 45K release' },
    { id: '2', name: 'Receivable Days (Platforms)', current: '14 days', prior: '21 days', delta: '-33.3%', confidence: 75, evidence: 'Contract Update', impact: 'AED 120K release' },
    { id: '3', name: 'Payable Days (Suppliers)', current: '30 days', prior: '28 days', delta: '+7.1%', confidence: 80, evidence: 'Supplier Agreement', impact: 'AED 35K benefit' },
    { id: '4', name: 'Prepaid Rent (Months)', current: '3 months', prior: '3 months', delta: '0.0%', confidence: 95, evidence: 'Lease Terms', impact: 'Neutral' },
    { id: '5', name: 'Security Deposits', current: 'AED 45K/kitchen', prior: 'AED 40K/kitchen', delta: '+12.5%', confidence: 90, evidence: 'Landlord Req', impact: 'AED 25K outflow' },
    { id: '6', name: 'Cash Buffer Target', current: '2.0× Burn', prior: '1.5× Burn', delta: '+33.3%', confidence: 85, evidence: 'Board Policy', impact: 'AED 180K lock-up' },
    { id: '7', name: 'Platform Settlement Lag', current: '7 days', prior: '10 days', delta: '-30.0%', confidence: 78, evidence: 'Platform Contract', impact: 'AED 60K release' },
    { id: '8', name: 'Tax Accrual Rate', current: '0%', prior: '0%', delta: '0.0%', confidence: 98, evidence: 'UAE Tax Policy', impact: 'Nil — Free Zone' },
  ],
};

/* ── EBITDA Sensitivity tornado ───────────────────────────────────────── */
const sensitivityDrivers = [
  { name: 'Daily Order Volume', upside: 45000, downside: -38000 },
  { name: 'Average Selling Price', upside: 32000, downside: -28000 },
  { name: 'Food COGS Rate', upside: 22000, downside: -25000 },
  { name: 'Marketing Spend', upside: 18000, downside: -15000 },
  { name: 'Labor Cost', upside: 12000, downside: -14000 },
];
const maxSensitivity = Math.max(...sensitivityDrivers.map(d => Math.max(Math.abs(d.upside), Math.abs(d.downside))));
const fmtSens = (v: number) => (v >= 0 ? '+' : '') + new Intl.NumberFormat('en-AE').format(v);

/* ══════════════════════════════════════════════════════════════════════ */
export default function AssumptionsManager() {
  const ctx = usePlanningContext();
  const gridRef = useRef<AgGridReact>(null);
  const [activeTab, setActiveTab] = useState('demand');
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'warning' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [setInfo, setSetInfo] = useState<AssumptionPanelInfo>(defaultSetInfo);
  const [dataSource, setDataSource] = useState<DataSource>('static');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  /* Per-tab row state — persists across tab switches */
  const [tabRows, setTabRows] = useState<Record<string, any[]>>(() => {
    const initial: Record<string, any[]> = {};
    for (const key of Object.keys(tabSeedData)) {
      initial[key] = [...tabSeedData[key]];
    }
    return initial;
  });

  const currentRows = tabRows[activeTab] || [];
  const currentCols = tabColumns[activeTab] || [];
  const selectedScenario = ctx.scenarios.find((scenario) => scenario.scenarioId === ctx.scenarioId);

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
  }), []);

  const confidenceColor = setInfo.confidenceLabel === 'Preview'
    ? 'text-slate-700 bg-slate-50 border-slate-200'
    : setInfo.confidence >= 80
      ? 'text-green-700 bg-green-50 border-green-200'
      : setInfo.confidence >= 60
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200';

  useEffect(() => {
    let cancelled = false;

    if (!ctx.companyId || !ctx.scenarioId) {
      setSetInfo(defaultSetInfo);
      return () => {
        cancelled = true;
      };
    }

    getAssumptionsSets({
      companyId: ctx.companyId,
      scenarioId: ctx.scenarioId,
      versionId: selectedScenario?.latestVersionId,
      limit: 1,
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        const activeSet = data?.[0];

        setSetInfo({
          setId: activeSet?.assumptionSetId || 'Preview only',
          version: selectedScenario?.latestVersionId
            ? `Version ${selectedScenario.latestVersionId.slice(0, 8)}`
            : 'Version unavailable',
          owner: ctx.companyName || 'Pre-refactor shell',
          confidence: activeSet ? 100 : 0,
          confidenceLabel: activeSet ? 'Tracked' : 'Preview',
          lastModified: formatPanelDate(activeSet?.createdAt),
          approvalStatus: activeSet?.status || 'Preview only',
        });

        if (error) {
          setBanner({
            tone: 'warning',
            text: 'Canonical assumption-set metadata is only partially wired. This workspace remains preview-only until the assumptions refactor starts.',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSetInfo(defaultSetInfo);
          setBanner({
            tone: 'warning',
            text: 'Assumption-set metadata could not be loaded. This workspace is still available for local draft exploration only.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.companyId, ctx.companyName, ctx.scenarioId, selectedScenario?.latestVersionId]);

  /* Load canonical assumption data from API when context changes */
  useEffect(() => {
    let cancelled = false;

    async function loadCanonicalAssumptions() {
      if (!ctx.companyId) return;

      const params = {
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
        versionId: selectedScenario?.latestVersionId || undefined,
      };

      const [demandRes, costRes, fundingRes, wcRes] = await Promise.all([
        getAssumptionsDemand(params),
        getAssumptionsCost(params),
        getAssumptionsFunding(params),
        getAssumptionsWorkingCapital(params),
      ]);

      if (cancelled) return;

      const nextRows: Record<string, any[]> = {};
      for (const key of Object.keys(tabSeedData)) {
        nextRows[key] = [...tabSeedData[key]];
      }

      let hasApiData = false;

      function mapAssumptionRows(apiData: any[] | null, tabKey: string) {
        if (apiData && Array.isArray(apiData) && apiData.length > 0) {
          hasApiData = true;
          nextRows[tabKey] = apiData.map((item: any, idx: number) => ({
            id: item.fieldId || String(idx + 1),
            name: item.name || `Field ${idx + 1}`,
            current: String(item.value ?? ''),
            prior: '',
            delta: '',
            confidence: typeof item.confidence === 'number' ? item.confidence : (item.confidence === 'high' ? 85 : item.confidence === 'medium' ? 65 : 45),
            owner: item.source || '',
            reviewDate: '',
            evidence: '',
            impact: '',
          }));
        }
      }

      mapAssumptionRows(demandRes.data, 'demand');
      mapAssumptionRows(costRes.data, 'cost');
      mapAssumptionRows(fundingRes.data, 'funding');
      mapAssumptionRows(wcRes.data, 'wc');

      setTabRows(nextRows);
      setIsDirty(false);
      setDataSource(hasApiData ? 'api' : 'static');
      if (hasApiData) setLastFetched(new Date());
    }

    loadCanonicalAssumptions().catch(() => {
      if (!cancelled) {
        const nextRows: Record<string, any[]> = {};
        for (const key of Object.keys(tabSeedData)) {
          nextRows[key] = [...tabSeedData[key]];
        }
        setTabRows(nextRows);
        setIsDirty(false);
        setDataSource('static');
      }
    });

    return () => { cancelled = true; };
  }, [ctx.companyId, ctx.scenarioId, selectedScenario?.latestVersionId]);

  /* ── Row management ─────────────────────────────────────────────────── */
  const addRow = useCallback(() => {
    setTabRows(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], {
        id: String(Date.now()),
        name: '(New Assumption)',
        current: '',
        prior: '',
        delta: '',
        confidence: 50,
        owner: '',
        reviewDate: '',
        evidence: '',
        impact: '',
      }],
    }));
    setIsDirty(true);
  }, [activeTab]);

  const deleteSelected = useCallback(() => {
    if (!gridRef.current?.api) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    const ids = new Set(selected.map((r: any) => r.id));
    setTabRows(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((r: any) => !ids.has(r.id)),
    }));
    setIsDirty(true);
  }, [activeTab]);

  const duplicateSelected = useCallback(() => {
    if (!gridRef.current?.api) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    const dupes = selected.map((r: any) => ({ ...r, id: String(Date.now() + Math.random()), name: r.name + ' (Copy)' }));
    setTabRows(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], ...dupes],
    }));
    setIsDirty(true);
  }, [activeTab]);

  const onCellValueChanged = useCallback(() => {
    setIsDirty(true);
    /* Sync grid state back to tabRows */
    if (gridRef.current?.api) {
      const rows: any[] = [];
      gridRef.current.api.forEachNode(node => rows.push(node.data));
      setTabRows(prev => ({ ...prev, [activeTab]: rows }));
    }
  }, [activeTab]);

  /* ── Save & Compute ─────────────────────────────────────────────────── */
  const handleSaveDraft = useCallback(async () => {
    setIsSaving(true);
    setBanner(null);
    try {
      if (!ctx.companyId || !ctx.scenarioId) {
        setBanner({ tone: 'warning', text: 'Select a company and scenario to save assumptions.' });
        return;
      }

      const buildPayload = (tabKey: string) => {
        const rows = tabRows[tabKey] || [];
        return {
          companyId: ctx.companyId!,
          scenarioId: ctx.scenarioId,
          fields: rows.map((r: any) => ({
            name: r.name,
            value: parseFloat(String(r.current).replace(/[^0-9.-]/g, '')) || 0,
            unit: 'AED',
            confidence: r.confidence >= 80 ? 'high' : r.confidence >= 60 ? 'medium' : 'low',
          })),
        };
      };

      await Promise.allSettled([
        upsertAssumptionsDemandBulk(buildPayload('demand')),
        upsertAssumptionsCostBulk(buildPayload('cost')),
        upsertAssumptionsFundingBulk(buildPayload('funding')),
        upsertAssumptionsWorkingCapitalBulk(buildPayload('wc')),
      ]);

      setIsDirty(false);
      setDataSource('api');
      setLastFetched(new Date());
    } catch (err: any) {
      setBanner({
        tone: 'error',
        text: `Save failed: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [ctx.companyId, ctx.scenarioId, tabRows]);

  const handleRunEngine = useCallback(async () => {
    if (!ctx.companyId || !ctx.scenarioId) {
      setBanner({ tone: 'warning', text: 'Select a company and scenario to run the compute engine.' });
      return;
    }
    const versionId = selectedScenario?.latestVersionId;
    if (!versionId) {
      setBanner({ tone: 'warning', text: 'Select a scenario with an active version before running the compute engine.' });
      return;
    }
    setBanner(null);
    try {
      const result = await createComputeRuns({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId,
        versionId,
      });
      if (result.data) {
        setBanner({ tone: 'warning', text: `Compute run started: ${result.data.computeRunId} (status: ${result.data.status}). Check the finance screens for updated outputs.` });
      } else {
        setBanner({ tone: 'warning', text: result.error || 'Compute engine returned no result. The orchestration pipeline may still be initializing.' });
      }
    } catch (err: any) {
      setBanner({ tone: 'error', text: `Compute run failed: ${err.message}` });
    }
  }, [ctx.companyId, ctx.scenarioId, selectedScenario?.latestVersionId]);

  return (
    <div className="flex-1 flex flex-col">

      {/* ═══════ ASSUMPTION SET INFO BAR ═══════ */}
      <div className="bg-[#1B2A4A] text-white">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-bold tracking-wider text-blue-200">SET:</span>
              <span className="text-sm font-bold">{setInfo.setId}</span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Version:</span>
              <span className="text-xs font-semibold bg-white/10 px-2 py-0.5 rounded">{setInfo.version}</span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-xs font-medium">{setInfo.owner}</span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-bold ${confidenceColor}`}>
              <span>{setInfo.confidence}%</span>
              <span className="font-medium">— {setInfo.confidenceLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Modified:</span>
              <span className="text-xs font-medium">{setInfo.lastModified}</span>
            </div>
            {isDirty && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30">
                ● UNSAVED CHANGES
              </span>
            )}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
              setInfo.approvalStatus.includes('Pending') ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30' : 'bg-green-500/20 text-green-200 border border-green-400/30'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {setInfo.approvalStatus}
            </div>
            {dataSource !== 'api' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-slate-500/20 text-slate-200 border border-slate-400/30">
                <AlertCircle className="w-3.5 h-3.5" />
                Local Data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ 8-TAB SUB-NAVIGATION ═══════ */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-30">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex items-center gap-0.5 overflow-x-auto py-0">
            {subTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#1B2A4A] text-[#1B2A4A] bg-blue-50/50'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ PAGE HEADER & ACTIONS ═══════ */}
      <div className="px-6 pt-5 pb-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[#1E5B9C]" />
              {subTabs.find(t => t.key === activeTab)?.label} Assumptions
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
              Assumption Manager — {dataSource === 'api' ? 'Live data from canonical API' : 'Local seed data (API unavailable)'}
              <DataFreshness source={dataSource} lastFetched={lastFetched ? new Date(lastFetched) : null} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition font-medium text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleRunEngine}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-md bg-[#1B2A4A] hover:bg-[#263B5E] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Run Compute Engine
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {banner && (
        <div className="max-w-[1440px] mx-auto w-full px-6">
          <div className={`rounded-lg p-3 flex items-start gap-3 ${
            banner.tone === 'error' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
              banner.tone === 'error' ? 'text-red-500' : 'text-amber-500'
            }`} />
            <p className={`text-xs flex-1 ${
              banner.tone === 'error' ? 'text-red-700' : 'text-amber-800'
            }`}>{banner.text}</p>
            <button
              onClick={() => setBanner(null)}
              className={`text-[10px] font-bold uppercase ${
                banner.tone === 'error'
                  ? 'text-red-400 hover:text-red-600'
                  : 'text-amber-500 hover:text-amber-700'
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ═══════ GRID TOOLBAR + AG GRID ═══════ */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-4 flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={addRow} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition">
              <Plus className="w-3 h-3" /> Add Row
            </button>
            <button onClick={duplicateSelected} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition">
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button onClick={deleteSelected} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
          <span className="text-[10px] text-gray-400 font-medium">
            {currentRows.length} rows · {subTabs.find(t => t.key === activeTab)?.label} tab
            {isDirty && ' · ● unsaved'}
          </span>
        </div>

        {/* AG Grid */}
        <div className="ag-theme-alpine w-full flex-1 border border-gray-200 rounded-b-xl overflow-hidden shadow-sm" style={{ minHeight: '380px' }}>
          <style jsx global>{`
            .ag-theme-alpine {
              --ag-border-color: #e5e7eb;
              --ag-header-background-color: #D6E4F7;
              --ag-header-foreground-color: #1B2A4A;
              --ag-odd-row-background-color: #fafbfc;
              --ag-row-hover-color: #ecfeff;
              --ag-selected-row-background-color: #e0f2fe;
              --ag-range-selection-border-color: #1B2A4A;
              --ag-range-selection-background-color: rgba(27, 42, 74, 0.06);
              --ag-font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
              --ag-font-size: 12px;
              --ag-checkbox-checked-color: #1B2A4A;
            }
            .ag-theme-alpine .ag-header-cell-label {
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-size: 0.65rem;
              color: #1B2A4A;
            }
            .ag-theme-alpine .ag-cell-editable {
              cursor: text;
            }
            .ag-theme-alpine .ag-cell-editable:hover {
              background: rgba(27, 42, 74, 0.04);
            }
          `}</style>

          <AgGridReact
            ref={gridRef}
            key={`${activeTab}-${ctx.scenarioId}`}
            rowData={currentRows}
            columnDefs={currentCols}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            animateRows={true}
            domLayout="autoHeight"
            getRowId={(params) => params.data.id}
            onCellValueChanged={onCellValueChanged}
            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Refetching assumptions...</span>'}
          />
        </div>

        {/* ═══════ EBITDA SENSITIVITY TORNADO ═══════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mt-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#1E5B9C]" />
            Top-5 EBITDA Sensitivity — Impact Preview
          </h3>
          <div className="space-y-3">
            {sensitivityDrivers.map((driver, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-36 text-right text-xs font-semibold text-gray-700 shrink-0 truncate">{driver.name}</div>
                <div className="flex-1 flex items-center h-7">
                  <div className="flex-1 flex justify-end">
                    <div className="h-6 bg-[#C0392B] rounded-l-md flex items-center justify-start px-1.5"
                      style={{ width: `${(Math.abs(driver.downside) / maxSensitivity) * 100}%` }}>
                      <span className="text-[9px] font-bold text-white whitespace-nowrap">{fmtSens(driver.downside)}</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-gray-400 shrink-0" />
                  <div className="flex-1">
                    <div className="h-6 bg-[#1A7A4A] rounded-r-md flex items-center justify-end px-1.5"
                      style={{ width: `${(Math.abs(driver.upside) / maxSensitivity) * 100}%` }}>
                      <span className="text-[9px] font-bold text-white whitespace-nowrap">{fmtSens(driver.upside)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
              <div className="w-36" />
              <div className="flex-1 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>← Downside Risk (AED)</span>
                <span>Upside Potential (AED) →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
