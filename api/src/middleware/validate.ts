/**
 * Zod validation middleware for Express routes.
 * Generated as part of Wave 1 foundation — see WAVE_STATUS.md.
 *
 * Usage:
 *   import { validate } from '../../middleware/validate';
 *   import { CompanyInsert } from '../../schemas/companies';
 *
 *   router.post('/', validate(CompanyInsert), async (req, res, next) => {
 *     // req.body is validated and typed
 *   });
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Returns Express middleware that validates req.body against a Zod schema.
 * On success: replaces req.body with the parsed (coerced/stripped) value.
 * On failure: responds with 400 + structured validation errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request body validation failed',
          details: errors,
          trace_id: (req.headers['x-trace-id'] as string) || 'no-trace-id',
        },
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates query parameters against a Zod schema.
 * Same pattern as validate() but reads from req.query.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Query parameter validation failed',
          details: errors,
          trace_id: (req.headers['x-trace-id'] as string) || 'no-trace-id',
        },
      });
    }
    // Merge parsed query back (coerced types)
    Object.assign(req.query, result.data);
    next();
  };
}

/**
 * Validates path parameters against a Zod schema.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = formatZodError(result.error);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Path parameter validation failed',
          details: errors,
          trace_id: (req.headers['x-trace-id'] as string) || 'no-trace-id',
        },
      });
    }
    Object.assign(req.params, result.data);
    next();
  };
}

/** Format Zod errors into a clean array of field-level messages */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
