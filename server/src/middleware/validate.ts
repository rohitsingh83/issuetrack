import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Validates and coerces request input with Zod. Parsed values are exposed on
 * `req.validated` so controllers work with typed, sanitized data.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.validated = req.validated ?? {};
    const errors: Record<string, string[]> = {};

    (['params', 'query', 'body'] as const).forEach((key) => {
      const schema = schemas[key];
      if (!schema) return;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const path = [key === 'body' ? '' : key, ...issue.path.map(String)]
            .filter(Boolean)
            .join('.')
            .replace(/^body\./, '');
          const field = path || key;
          errors[field] = [...(errors[field] ?? []), issue.message];
        });
      } else {
        req.validated[key] = result.data;
      }
    });

    if (Object.keys(errors).length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    next();
  };
}

/** Type helper so controllers can read validated data with a cast. */
export function validated<T>(value: unknown): T {
  return value as T;
}
