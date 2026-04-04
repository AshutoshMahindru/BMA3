"use client";

import { Clock, Wifi, WifiOff } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';
import type { DataSource } from '@/lib/use-api-data';

/* ══════════════════════════════════════════════════════════════════════════
   DATA FRESHNESS BADGE
   Shows data source (API / Static) and last computed timestamp.
   ══════════════════════════════════════════════════════════════════════ */

interface Props {
  source?: DataSource;
  lastFetched?: Date | null;
}

export default function DataFreshness({ source, lastFetched }: Props = {}) {
  const ctx = usePlanningContext();

  // ── Source Indicator ──
  const SourceBadge = () => {
    if (!source || source === 'loading') return null;

    if (source === 'api') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1E5B9C] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
          <Wifi className="w-3 h-3" /> Live
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
        <WifiOff className="w-3 h-3" /> Static
      </span>
    );
  };

  // ── Timestamp ──
  const TimeBadge = () => {
    const timestamp = lastFetched || (null);
    if (!timestamp) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md">
          <Clock className="w-3 h-3" />
          Not yet computed
        </span>
      );
    }

    const diff = Date.now() - timestamp.getTime();
    const mins = Math.floor(diff / 60000);
    const label = mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;

    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1A7A4A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">
        <Clock className="w-3 h-3" />
        Last computed: {label}
      </span>
    );
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <SourceBadge />
      <TimeBadge />
    </span>
  );
}
