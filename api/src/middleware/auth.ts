import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

export type AuthClaims = {
  sub: string;
  tenant_id: string;
  company_id?: string;
  roles: string[];
  email?: string;
  raw?: Record<string, unknown>;
};

const DEV_AUTH_TOKEN = process.env.DEV_AUTH_TOKEN || 'dev-local-token';
const DEV_TENANT_ID = process.env.DEV_TENANT_ID || '10000000-0000-4000-8000-000000000001';
const DEV_COMPANY_ID = process.env.DEV_COMPANY_ID;

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function sendUnauthorized(res: Response, req: Request, message = 'User not authenticated') {
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message,
      governance_status: 'draft',
      trace_id: traceId(req),
    },
  });
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function parseBearerToken(header?: string | string[]): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeClaims(payload: Record<string, unknown>): AuthClaims | null {
  const tenantId =
    asString(payload.tenant_id)
    || asString(payload.tenantId)
    || asString(payload['https://bma3/tenant_id']);
  if (!tenantId) {
    return null;
  }

  const companyId =
    asString(payload.company_id)
    || asString(payload.companyId)
    || asString(payload['https://bma3/company_id']);
  const rolesValue = payload.roles;
  const roles = Array.isArray(rolesValue)
    ? rolesValue.filter((role): role is string => typeof role === 'string' && role.length > 0)
    : asString(rolesValue)
      ? [String(rolesValue)]
      : [];

  return {
    sub: asString(payload.sub) || asString(payload.user_id) || 'anonymous',
    tenant_id: tenantId,
    ...(companyId ? { company_id: companyId } : {}),
    roles,
    ...(asString(payload.email) ? { email: String(payload.email) } : {}),
    raw: payload,
  };
}

function verifyHs256Signature(token: string, secret: string): boolean {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(encodedSignature);
  return expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function decodeJwtClaims(token: string): AuthClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const secret = process.env.AUTH_JWT_SECRET;

    if (secret) {
      if (String(header.alg || '') !== 'HS256') {
        return null;
      }
      if (!verifyHs256Signature(token, secret)) {
        return null;
      }
    }

    return normalizeClaims(payload);
  } catch {
    return null;
  }
}

function attachClaims(req: Request, claims: AuthClaims) {
  req.auth = claims;
  req.claims = claims;
  req.user = {
    sub: claims.sub,
    tenantId: claims.tenant_id,
    tenant_id: claims.tenant_id,
    ...(claims.company_id ? { companyId: claims.company_id, company_id: claims.company_id } : {}),
    roles: claims.roles,
    ...(claims.email ? { email: claims.email } : {}),
  };
  req.tenantId = claims.tenant_id;
  if (claims.company_id) {
    req.companyId = claims.company_id;
  }
}

export function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return sendUnauthorized(res, req);
  }

  if (token === DEV_AUTH_TOKEN) {
    attachClaims(req, {
      sub: 'dev-user',
      tenant_id: DEV_TENANT_ID,
      ...(DEV_COMPANY_ID ? { company_id: DEV_COMPANY_ID } : {}),
      roles: ['planner', 'admin'],
    });
    return next();
  }

  const claims = decodeJwtClaims(token);
  if (!claims) {
    logger.warn(
      {
        method: req.method,
        url: req.originalUrl || req.url,
        traceId: traceId(req),
      },
      'Rejected request with invalid bearer token',
    );
    return sendUnauthorized(res, req, 'Bearer token is invalid');
  }

  attachClaims(req, claims);
  next();
}
