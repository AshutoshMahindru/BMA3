import { NextFunction, Request, Response } from 'express';
import { db } from '../db';
import { logger } from '../lib/logger';
import { uuidSchema } from '../routes/v1/_shared';

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function companyIdCandidate(req: Request): string | undefined {
  const fromParams =
    firstString(req.params.companyId)
    || firstString(req.params.company_id);
  const fromQuery =
    firstString(req.query.companyId)
    || firstString(req.query.company_id);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const fromBody =
    firstString(body.companyId)
    || firstString(body.company_id);

  return fromParams || fromQuery || fromBody || req.auth?.company_id;
}

export async function attachTenantContext(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.auth?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Tenant context is missing from the authenticated session',
        governance_status: 'draft',
        trace_id: traceId(req),
      },
    });
  }

  req.tenantId = tenantId;

  const candidateCompanyId = companyIdCandidate(req);
  if (!candidateCompanyId || !uuidSchema.safeParse(candidateCompanyId).success) {
    return next();
  }

  if (req.auth?.company_id && req.auth.company_id !== candidateCompanyId) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Authenticated company context does not match the requested company',
        governance_status: 'draft',
        trace_id: traceId(req),
      },
    });
  }

  try {
    const company = await db.query(
      `SELECT id, tenant_id
         FROM companies
        WHERE id::text = $1
          AND is_deleted = FALSE`,
      [candidateCompanyId],
    );

    if (Number(company.rowCount || 0) > 0) {
      const companyTenantId = String(company.rows[0].tenant_id);
      if (companyTenantId !== tenantId) {
        logger.warn(
          {
            method: req.method,
            url: req.originalUrl || req.url,
            tenantId,
            candidateCompanyId,
            companyTenantId,
            traceId: traceId(req),
          },
          'Rejected cross-tenant company access attempt',
        );
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Requested company does not belong to the authenticated tenant',
            governance_status: 'draft',
            trace_id: traceId(req),
          },
        });
      }

      req.companyId = candidateCompanyId;
      if (req.user) {
        req.user.companyId = candidateCompanyId;
        req.user.company_id = candidateCompanyId;
      }
      if (req.auth && !req.auth.company_id) {
        req.auth.company_id = candidateCompanyId;
      }
      if (req.claims && !req.claims.company_id) {
        req.claims.company_id = candidateCompanyId;
      }
    }
  } catch (error) {
    return next(error);
  }

  next();
}
