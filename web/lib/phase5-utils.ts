"use client";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toText(value: unknown, fallback = '—'): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return toText(value);

  return date.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(value: number, compact = false): string {
  const formatter = new Intl.NumberFormat('en-AE', {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  });

  return `AED ${formatter.format(value)}`;
}

export function formatPercent(value: number, digits = 1): string {
  const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percentValue.toFixed(digits)}%`;
}

export function confidenceScore(value: string): number {
  switch (value.trim().toLowerCase()) {
    case 'high':
      return 90;
    case 'medium':
      return 72;
    case 'low':
      return 45;
    case 'estimated':
      return 28;
    default:
      return 10;
  }
}

export function confidenceTone(value: string | number): string {
  const numeric = typeof value === 'number' ? value : confidenceScore(value);

  if (numeric >= 85) return 'bg-green-100 text-green-700 border-green-200';
  if (numeric >= 65) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (numeric >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

export function governanceTone(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'published') return 'bg-green-100 text-green-700 border-green-200';
  if (normalized === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized === 'under review' || normalized === 'under_review' || normalized === 'submitted') {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
  if (normalized === 'rejected' || normalized === 'archived') return 'bg-red-100 text-red-700 border-red-200';
  if (normalized === 'frozen') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

export function severityTone(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (normalized === 'warning' || normalized === 'major') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (normalized === 'medium' || normalized === 'moderate') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}
