import type { AuthClaims } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
      claims?: AuthClaims;
      user?: {
        sub: string;
        tenantId: string;
        tenant_id: string;
        companyId?: string;
        company_id?: string;
        roles: string[];
        email?: string;
      };
      tenantId?: string;
      companyId?: string;
    }
  }
}

export {};
