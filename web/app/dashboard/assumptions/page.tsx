"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2, Save, Play, Loader2, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, Clock, User, Shield,
  Plus, Trash2, Copy, Wifi, WifiOff,
} from 'lucide-react';
import { 
  upsertDemandDrivers, 
  fetchDemandDrivers,
  fetchWorkingCapitalPolicies,
  upsertWorkingCapitalPolicies,
  fetchPricePlans,
  upsertPricePlans,
  fetchLaborModels,
  upsertLaborModels,
  fetchMarketingPlans,
  upsertMarketingPlans,
  fetchCapexPlans,
  upsertCapexPlans,
  fetchOpexPlans,
  upsertOpexPlans,
  fetchFundingParameters,
  upsertFundingParameters,
  fetchRolloutPlans,
  upsertRolloutPlans,
  fetchUnitCostProfiles,
  upsertUnitCostProfiles,
  triggerCompute, 
  pollJob, 
  checkHealth 
} from '@/lib/api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { usePlanningContext } from '@/lib/planning-context';

ModuleRegistry.registerModules([AllCommunityModule]);
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

/* ══════════════════════════════════════════════════════════════════════════
   S06-S09: ASSUMPTIONS MANAGER — 8-Tab Editable Grid + Info Bar
   Each tab has its own AG Grid with editable columns.
   Save Draft → persists locally. Run Engine → upserts to API + computes.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Assumption Set Info Bar ─────────────────────────────────────────── */
const setInfo = {
  setId: 'AS-2025-03',
  version: 'v4 (Draft)',
  owner: 'Commercial Team',
  confidence: 76,
  confidenceLabel: 'Medium',
  lastModified: '29 Mar 2026',
  approvalStatus: 'Pending CFO',
};

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
  const router = useRouter();
  const ctx = usePlanningContext();
  const gridRef = useRef<AgGridReact>(null);
  const [activeTab, setActiveTab] = useState('demand');
  const [isSaving, setIsSaving] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking'|'live'|'offline'>('checking');
  const [isLoading, setIsLoading] = useState(false);

  /* Check API health on mount */
  useEffect(() => {
    checkHealth().then(({ data }) => {
      setApiStatus(data?.status === 'ok' ? 'live' : 'offline');
    }).catch(() => setApiStatus('offline'));
  }, []);

  /* ── Data Fetching & Mapping ─────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let result: any;
      const scenarioId = ctx.scenarioId || '';
      
      switch(activeTab) {
        case 'demand':
          result = await fetchDemandDrivers(scenarioId);
          if (result.data && result.data.length > 0) {
            setTabRows(prev => ({
              ...prev,
              demand: result.data.map((d: any) => ({
                id: d.id,
                name: `Orders — ${d.market_id} (${d.platform_id})`,
                current: d.base_orders,
                prior: 0,
                delta: '0%',
                confidence: d.confidence_pct || 80,
                owner: d.owner || 'Commercial',
                reviewDate: '15 Apr 2026'
              }))
            }));
          }
          break;
        case 'pricing':
          result = await fetchPricePlans(scenarioId);
          if (result.data && result.data.length > 0) {
            setTabRows(prev => ({
              ...prev,
              pricing: result.data.map((d: any) => ({
                id: d.id,
                name: `${d.plan_name} — ${d.product_family_id}`,
                current: `AED ${d.base_price}`,
                prior: 0,
                delta: '0%',
                confidence: 85,
                owner: 'Commercial',
                reviewDate: '15 Apr 2026'
              }))
            }));
          }
          break;
        case 'labor':
          result = await fetchLaborModels(scenarioId);
          if (result.data && result.data.length > 0) {
            setTabRows(prev => ({
              ...prev,
              labor: result.data.map((d: any) => ({
                id: d.id,
                name: `${d.role_name} — ${d.kitchen_id}`,
                current: `AED ${d.monthly_salary}`,
                prior: 0,
                delta: '0%',
                confidence: 90,
                owner: 'HR',
                reviewDate: '15 Apr 2026'
              }))
            }));
          }
          break;
        case 'marketing':
          result = await fetchMarketingPlans(scenarioId);
          if (result.data && result.data.length > 0) {
            setTabRows(prev => ({
              ...prev,
              marketing: result.data.map((d: any) => ({
                id: d.id,
                name: `${d.plan_name} (${d.channel})`,
                current: `${d.spend_pct_revenue}%`,
                prior: 0,
                delta: '0%',
                confidence: 75,
                owner: 'Marketing'
              }))
            }));
          }
          break;
        case 'capex':
          result = await fetchCapexPlans(scenarioId);
          if (result.data && result.data.length > 0) {
            setTabRows(prev => ({
              ...prev,
              capex: result.data.map((d: any) => ({
                id: d.id,
                name: `${d.plan_name} (${d.asset_category})`,
                current: `AED ${d.budget_per_kitchen}`,
                prior: 0,
                delta: '0%',
                confidence: 80,
                owner: 'Finance'
              }))
            }));
          }
          break;
        case 'funding':
          const { data: fundingData } = await fetchFundingParameters(scenarioId);
          if (fundingData) {
            const { equity_rounds, debt_facilities } = fundingData;
            setTabRows(prev => ({
              ...prev,
              funding: [
                ...(equity_rounds || []).map((r: any) => ({
                  id: r.id,
                  type: 'equity',
                  name: `Equity: ${r.round_name}`,
                  current: `AED ${r.amount_raised}`,
                  prior: 0,
                  confidence: 85,
                  evidence: r.lead_investor || '',
                  owner: 'CFO'
                })),
                ...(debt_facilities || []).map((r: any) => ({
                  id: r.id,
                  type: 'debt',
                  name: `Debt: ${r.lender_name}`,
                  current: `AED ${r.principal_amount}`,
                  prior: 0,
                  confidence: 80,
                  evidence: `${r.interest_rate_annual}%`,
                  owner: 'Treasury'
                }))
              ]
            }));
          }
          break;
        case 'wc':
          result = await fetchWorkingCapitalPolicies(scenarioId);
          if (result.data && result.data.length > 0) {
            const policy = result.data[0];
            setTabRows(prev => ({
              ...prev,
              wc: [
                { id: '1', name: 'Inventory Days', current: `${policy.inventory_days} days`, prior: '7 days', delta: '', confidence: 85, evidence: '', impact: '' },
                { id: '2', name: 'Receivable Days (Platforms)', current: `${policy.platform_settlement_days} days`, prior: '21 days', delta: '', confidence: 85, evidence: '', impact: '' },
                { id: '3', name: 'Payable Days (Suppliers)', current: `${policy.payable_days} days`, prior: '30 days', delta: '', confidence: 85, evidence: '', impact: '' },
                { id: '4', name: 'Prepaid Rent (Months)', current: `${policy.cash_buffer_months} months`, prior: '3 months', delta: '', confidence: 95, evidence: '', impact: '' },
              ]
            }));
          }
          break;
        default:
          setTabRows(prev => ({ ...prev, [activeTab]: [...tabSeedData[activeTab]] }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsDirty(false);
    }
  }, [activeTab, ctx.scenarioId, fetchFundingParameters]);

  /* Re-fetch on scenario or tab change */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
  }), []);

  const confidenceColor = setInfo.confidence >= 80 ? 'text-green-700 bg-green-50 border-green-200'
    : setInfo.confidence >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';

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
    setErrorMessage(null);
    try {
      const scenarioId = ctx.scenarioId || '';
      const currentData = tabRows[activeTab];

      let result: any;
      switch(activeTab) {
        case 'demand':
          const drivers = currentData.map(r => ({
            scenario_id: scenarioId,
            assumption_set_id: 'AS-2025-03',
            planning_period_id: 'p_2026_01',
            market_id: r.name.includes('JLT') ? 'm_dubai_jlt' : 'm_dubai_marina',
            platform_id: 'pl_talabat',
            product_family_id: 'pf_burgers',
            base_orders: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            confidence_pct: r.confidence
          }));
          result = await upsertDemandDrivers(drivers);
          break;
        case 'pricing':
          const pricePlans = {
            scenario_id: scenarioId,
            plans: currentData.map(r => ({
              plan_name: r.name.split(' — ')[0],
              product_family_id: 'pf_pizza',
              base_price: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            }))
          };
          result = await upsertPricePlans(pricePlans);
          break;
        case 'labor':
          const laborModels = {
            scenario_id: scenarioId,
            models: currentData.map(r => ({
              role_name: r.name.split(' — ')[0],
              kitchen_id: 'k_dubai_001',
              monthly_salary: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            }))
          };
          result = await upsertLaborModels(laborModels);
          break;
        case 'marketing':
          const marketingPlans = {
            scenario_id: scenarioId,
            plans: currentData.map(r => ({
              plan_name: r.name.split(' (')[0],
              channel: 'digital',
              spend_pct_revenue: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            }))
          };
          result = await upsertMarketingPlans(marketingPlans);
          break;
        case 'capex':
          const capexPlans = {
            scenario_id: scenarioId,
            plans: currentData.map(r => ({
              plan_name: r.name.split(' (')[0],
              asset_category: 'kitchen_equipment',
              budget_per_kitchen: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            }))
          };
          result = await upsertCapexPlans(capexPlans);
          break;
        case 'funding':
          const fundingParams = {
            scenario_id: scenarioId,
            equity_rounds: currentData.filter(r => r.type === 'equity').map(r => ({
              round_name: r.name.replace('Equity: ', ''),
              amount_raised: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
              lead_investor: r.evidence
            })),
            debt_facilities: currentData.filter(r => r.type === 'debt').map(r => ({
              lender_name: r.name.replace('Debt: ', ''),
              principal_amount: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
              interest_rate_annual: parseFloat(r.evidence) || 0
            }))
          };
          result = await upsertFundingParameters(fundingParams);
          break;
        case 'wc':
          const wcPolicy = {
            scenario_id: scenarioId,
            assumption_set_id: 'AS-2025-03',
            kitchen_id: 'k_dubai_001',
            inventory_days: parseInt(String(currentData.find(r => r.name === 'Inventory Days')?.current).replace(/[^0-9]/g, '')) || 0,
            payable_days: parseInt(String(currentData.find(r => r.name === 'Payable Days (Suppliers)')?.current).replace(/[^0-9]/g, '')) || 0,
            platform_settlement_days: parseInt(String(currentData.find(r => r.name === 'Receivable Days (Platforms)')?.current).replace(/[^0-9]/g, '')) || 0,
          };
          result = await upsertWorkingCapitalPolicies(wcPolicy);
          break;
        case 'cost':
          const costProfiles = {
            scenario_id: scenarioId,
            profiles: currentData.map(r => ({
              product_family_id: 'pf_pizza',
              raw_material_cost: parseFloat(String(r.current).replace(/[^0-9.]/g, '')) || 0,
            }))
          };
          result = await upsertUnitCostProfiles(costProfiles);
          break;
        default:
          console.warn('Save logic not implemented for tab:', activeTab);
      }

      if (result?.error) {
        setErrorMessage(`API Save failed: ${result.error}. Data updated locally.`);
      } else {
        setIsDirty(false);
      }
    } catch (err: any) {
      setErrorMessage(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, tabRows, ctx.scenarioId]);

  const handleRunEngine = useCallback(async () => {
    setIsComputing(true);
    setJobProgress(5);
    setErrorMessage(null);
    try {
      /* Step 1: Save assumptions */
      await handleSaveDraft();
      setJobProgress(20);

      /* Step 2: Trigger compute via typed API helper */
      const { data: computeData, error: computeError } = await triggerCompute({
        scenario_id: ctx.scenarioId || '',
        assumption_set_id: setInfo.setId,
        period_range_start: 'p_2026_01',
        period_range_end: 'p_2026_12',
      });

      if (computeError || !computeData?.job_id) throw new Error(computeError || 'No job_id returned');

      const jobId = computeData.job_id;
      setJobProgress(30);

      /* Step 3: Poll for job completion */
      const poll = setInterval(async () => {
        const { data: pollData } = await pollJob(jobId);
        if (!pollData) return; // silent retry
        if (pollData.status === 'COMPLETED') {
          clearInterval(poll);
          setJobProgress(100);
          ctx.markComputed();
          setTimeout(() => router.push('/dashboard/pnl'), 800);
        } else if (pollData.progress_pct) {
          setJobProgress(Math.max(30, pollData.progress_pct));
        } else if (pollData.status === 'FAILED') {
          clearInterval(poll);
          setErrorMessage('Engine computation failed. Check server logs.');
          setIsComputing(false);
        }
      }, 500);
    } catch (err: any) {
      /* Graceful degradation: simulate compute if API is offline */
      console.warn('API compute unavailable, simulating locally:', err.message);
      let progress = 20;
      const sim = setInterval(() => {
        progress += 15;
        setJobProgress(Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(sim);
          setTimeout(() => {
            setIsComputing(false);
            ctx.markComputed();
            router.push('/dashboard/pnl');
          }, 600);
        }
      }, 400);
    }
  }, [handleSaveDraft, router, ctx]);

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
            {/* API Status Indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
              apiStatus === 'live'     ? 'bg-green-500/20 text-green-200 border border-green-400/30' :
              apiStatus === 'offline' ? 'bg-red-500/20 text-red-200 border border-red-400/30' :
              'bg-gray-500/20 text-gray-300 border border-gray-400/30'
            }`}>
              {apiStatus === 'live' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {apiStatus === 'live' ? 'API Live' : apiStatus === 'offline' ? 'API Offline' : 'Checking…'}
            </div>
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
            <p className="text-sm text-gray-500 mt-0.5">
              Click any blue cell to edit · Add/delete rows below · Ctrl+C/V for copy/paste
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving || isComputing}
              className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition font-medium text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleRunEngine}
              disabled={isSaving || isComputing}
              className="px-4 py-1.5 rounded-md bg-[#1B2A4A] hover:bg-[#263B5E] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isComputing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              {isComputing ? `Computing ${jobProgress}%` : 'Run Engine'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-[1440px] mx-auto w-full px-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 flex-1">{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase">Dismiss</button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isComputing && (
        <div className="max-w-[1440px] mx-auto w-full px-6 pt-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-blue-100 w-full" />
            <div className="absolute top-0 left-0 h-1 bg-[#1B2A4A] transition-all duration-300" style={{ width: `${jobProgress}%` }} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-blue-700 font-medium flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Financial Engine Processing...
              </span>
              <span className="text-sm font-bold text-[#1B2A4A]">{jobProgress}%</span>
            </div>
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
            rowData={isLoading ? [] : currentRows}
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
