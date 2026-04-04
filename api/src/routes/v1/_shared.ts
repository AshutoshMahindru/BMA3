import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid identifier format');
export const idSchema = uuidSchema;

export function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

export function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    governanceState: 'draft',
    ...(extra || {}),
  };
}

export function errorPayload(
  req: Request,
  code: string,
  message: string,
  options?: {
    governance_status?: string;
    details?: unknown;
  },
) {
  return {
    error: {
      code,
      message,
      governance_status: options?.governance_status || 'draft',
      trace_id: traceId(req),
      ...(options?.details !== undefined ? { details: options.details } : {}),
    },
  };
}

export function sendError(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  options?: {
    governance_status?: string;
    details?: unknown;
  },
) {
  return res.status(status).json(errorPayload(req, code, message, options));
}

export function paginate(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(query.offset ?? '0'), 10) || 0, 0);
  return { limit, offset };
}

export function safeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function confidenceStateFromLevel(level?: string): { state: string; numericScore: number } {
  const normalized = String(level || 'unknown').trim().toLowerCase();
  switch (normalized) {
    case 'high':
      return { state: 'high', numericScore: 90 };
    case 'medium':
      return { state: 'medium', numericScore: 70 };
    case 'low':
      return { state: 'low', numericScore: 45 };
    case 'estimated':
      return { state: 'estimated', numericScore: 30 };
    default:
      return { state: 'unknown', numericScore: 10 };
  }
}

export function confidenceStateFromNumeric(score: number | null | undefined): string {
  const numeric = safeNumber(score);
  if (numeric >= 85) return 'high';
  if (numeric >= 65) return 'medium';
  if (numeric >= 40) return 'low';
  if (numeric >= 20) return 'estimated';
  return 'unknown';
}

export function governanceStateFromVersion(row: any): string {
  if (!row) return 'draft';
  if (row.governanceState) return String(row.governanceState);
  if (row.published_at || row.publishedAt || row.status === 'published') return 'published';
  if (row.is_frozen || row.frozen_at || row.frozenAt) return 'frozen';
  if (row.status === 'approved') return 'approved';
  if (row.status === 'rejected') return 'rejected';
  if (row.status === 'submitted' || row.status === 'under_review' || row.status === 'in_review') return 'under_review';
  return String(row.status || 'draft');
}

export function stableUuidFromText(value: string): string {
  const hash = crypto.createHash('md5').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
