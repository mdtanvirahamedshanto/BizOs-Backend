import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@/utils/errors';

/**
 * Zod validation middleware factory.
 * Validates request body, query, or params against a Zod schema.
 *
 * Usage:
 *   router.post('/products', validate(createProductSchema), controller.create);
 *   router.get('/products', validate(listProductsSchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = formatZodErrors(result.error);
      next(new ValidationError('Validation failed', details));
      return;
    }

    // Replace the raw input with the validated & transformed data
    req[source] = result.data;
    next();
  };
}

/**
 * Format Zod errors into a consistent array of field-level details.
 */
function formatZodErrors(error: ZodError): Record<string, unknown>[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
