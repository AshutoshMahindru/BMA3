"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Layers3, Network, RefreshCw } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import DataFreshness from '@/components/data-freshness';
import {
  getReferenceCategories,
  getReferenceChannels,
  getReferenceFormats,
  getReferenceGeographies,
  getReferenceOperatingModels,
  getReferencePortfolioHierarchy,
  getScopeCategories,
  getScopeChannels,
  getScopeFormats,
  getScopeGeographies,
  getScopeOperatingModels,
  getScopePortfolioNodes,
  getScopeReviewSummary,
} from '@/lib/api-client';

type NormalizedNode = {
  nodeId: string;
  name: string;
  parentId: string | null;
  level: number;
  detail: string;
};

type FamilyConfig = {
  label: string;
  blurb: string;
  href: string;
  loadScope: (companyId: string, scenarioId?: string) => Promise<NormalizedNode[]>;
  loadReference: (companyId: string) => Promise<NormalizedNode[]>;
};

const FAMILY_CONFIG: Record<string, FamilyConfig> = {
  formats: {
    label: 'Formats',
    blurb: 'Store and fulfillment format taxonomy used for scope bundles.',
    href: '/dashboard/scope/formats',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopeFormats({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: `Level ${row.level || 0}`,
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferenceFormats({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: `Reference level ${row.level || 0}`,
      }));
    },
  },
  categories: {
    label: 'Categories',
    blurb: 'Menu category hierarchy available to the active planning context.',
    href: '/dashboard/scope/categories',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopeCategories({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: `Level ${row.level || 0}`,
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferenceCategories({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: `Reference level ${row.level || 0}`,
      }));
    },
  },
  portfolio: {
    label: 'Portfolio',
    blurb: 'Portfolio hierarchy nodes that define brands, kitchens, and product-group scope.',
    href: '/dashboard/scope/portfolio',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopePortfolioNodes({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: row.nodeType || 'portfolio',
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferencePortfolioHierarchy({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: row.nodeType || 'portfolio',
      }));
    },
  },
  channels: {
    label: 'Channels',
    blurb: 'Order channel taxonomy for dine-in, direct, marketplace, and hybrid demand paths.',
    href: '/dashboard/scope/channels',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopeChannels({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: null,
        level: 0,
        detail: row.channelType || 'channel',
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferenceChannels({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: null,
        level: 0,
        detail: row.channelType || 'channel',
      }));
    },
  },
  'operating-models': {
    label: 'Operating Models',
    blurb: 'Operating model nodes used to group central-kitchen, spoke, and hybrid operations.',
    href: '/dashboard/scope/operating-models',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopeOperatingModels({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: null,
        level: 0,
        detail: row.modelType || 'operating_model',
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferenceOperatingModels({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: null,
        level: 0,
        detail: row.modelType || 'operating_model',
      }));
    },
  },
  geography: {
    label: 'Geography',
    blurb: 'Live geography hierarchy supporting the current planning scope and reference coverage.',
    href: '/dashboard/scope/geography',
    loadScope: async (companyId, scenarioId) => {
      const result = await getScopeGeographies({ companyId, scenarioId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: row.isoCode || 'geo',
      }));
    },
    loadReference: async (companyId) => {
      const result = await getReferenceGeographies({ companyId, limit: 200 });
      return (result.data || []).map((row) => ({
        nodeId: row.nodeId,
        name: row.name,
        parentId: row.parentId || null,
        level: row.level || 0,
        detail: row.isoCode || 'geo',
      }));
    },
  },
};

export default function ScopeDimensionEditorPage({ params }: { params: { family: string } }) {
  const ctx = usePlanningContext();
  const config = FAMILY_CONFIG[params.family];
  const [scopeRows, setScopeRows] = useState<NormalizedNode[]>([]);
  const [referenceRows, setReferenceRows] = useState<NormalizedNode[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config || !ctx.companyId) {
      setScopeRows([]);
      setReferenceRows([]);
      setSummary({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      config.loadScope(ctx.companyId, ctx.scenarioId || undefined),
      config.loadReference(ctx.companyId),
      getScopeReviewSummary({
        companyId: ctx.companyId,
        scenarioId: ctx.scenarioId || undefined,
      }),
    ])
      .then(([scope, reference, summaryResult]) => {
        if (cancelled) return;
        setScopeRows(scope);
        setReferenceRows(reference);
        setSummary((summaryResult.data?.dimensionBreakdown as Record<string, number>) || {});
        setLastFetched(new Date());
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load scope editor');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, ctx.companyId, ctx.scenarioId]);

  const breakdownValue = useMemo(() => {
    const entries = Object.entries(summary);
    return entries.length > 0 ? entries : [];
  }, [summary]);

  if (!config) {
    return (
      <div className="px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">Unknown scope family</h1>
          <p className="mt-2 text-sm text-red-700">Choose one of the canonical scope editor routes from the index.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#1E5B9C]">Scope</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">{config.label} Dimension Editor</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-3xl">{config.blurb}</p>
          <div className="mt-3">
            <DataFreshness source={loading ? 'loading' : ctx.companyId ? 'api' : undefined} lastFetched={lastFetched} />
          </div>
        </div>

        <Link
          href="/dashboard/scope"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]"
        >
          <RefreshCw className="w-4 h-4" />
          All Editors
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FAMILY_CONFIG).map(([key, family]) => (
          <Link
            key={key}
            href={family.href}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] border transition ${
              key === params.family
                ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1E5B9C]/30 hover:text-[#1E5B9C]'
            }`}
          >
            {family.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Scope Nodes</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{scopeRows.length}</p>
          <p className="mt-2 text-sm text-gray-500">Nodes currently available to the live planning context.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Reference Nodes</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{referenceRows.length}</p>
          <p className="mt-2 text-sm text-gray-500">Canonical reference inventory for comparison and drift checks.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Dimension Coverage</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{summary[params.family] || summary[`${params.family}s`] || 0}</p>
          <p className="mt-2 text-sm text-gray-500">Active bundle items recorded for this dimension family.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Scope editor could not be loaded</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 bg-gray-50">
            <Layers3 className="w-4 h-4 text-[#1E5B9C]" />
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-[0.16em]">Live Scope Nodes</h2>
              <p className="text-xs text-gray-500 mt-1">Backed by the canonical `/scope/*` endpoints.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D6E4F7]">
                  {['Name', 'Level', 'Parent', 'Detail'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#1B2A4A]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scopeRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      No live nodes were returned for the current planning context.
                    </td>
                  </tr>
                )}
                {scopeRows.map((row, index) => (
                  <tr key={row.nodeId} className={index % 2 === 1 ? 'bg-[#F8FAFC]' : ''}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.level}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{row.parentId || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 bg-gray-50">
              <Network className="w-4 h-4 text-[#1E5B9C]" />
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-[0.16em]">Reference Inventory</h2>
                <p className="text-xs text-gray-500 mt-1">Canonical `/reference/*` nodes for drift review.</p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
              {referenceRows.length === 0 && (
                <div className="px-5 py-8 text-sm text-gray-400">No reference nodes were returned for this company.</div>
              )}
              {referenceRows.slice(0, 20).map((row) => (
                <div key={row.nodeId} className="px-5 py-3">
                  <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-900">Scope Review Summary</h2>
            <div className="mt-4 space-y-3">
              {breakdownValue.length === 0 && (
                <p className="text-sm text-gray-400">No active bundle breakdown is available yet.</p>
              )}
              {breakdownValue.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{key}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
