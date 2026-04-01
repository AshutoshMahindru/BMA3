"use client";

import { Clock } from 'lucide-react';
import { usePlanningContext } from '@/lib/planning-context';

/* ══════════════════════════════════════════════════════════════════════════
   DATA FRESHNESS BADGE
   Shows "Last computed: X min ago" on financial screens.
   Reads ctx.lastComputed from PlanningContext.
   ══════════════════════════════════════════════════════════════════════ */

export default function DataFreshness() {
  const ctx = usePlanningContext();

  if (!ctx.lastComputed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md">
        <Clock className="w-3 h-3" />
        Not yet computed
      </span>
    );
  }

  const diff = Date.now() - new Date(ctx.lastComputed).getTime();
  const mins = Math.floor(diff / 60000);
  const label = mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1A7A4A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-md">
      <Clock className="w-3 h-3" />
      Last computed: {label}
    </span>
  );
}
