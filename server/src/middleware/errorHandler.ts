import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { isProd, isTest } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface ErrorBody {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found`));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyError = any;

/** Centralized error handler — never leaks stack traces or internals in production. */
export function errorHandler(
  err: AnyError,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) return next(err);

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'UPLOAD_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Please upload a smaller file.'
        : 'File upload failed';
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, [e.message]]),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Malformed identifier provided';
  } else if (err?.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    message =
      field === 'key'
        ? 'A project with that key already exists'
        : field === 'email'
          ? 'An account with that email already exists'
          : `A record with that ${field} already exists`;
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  }

  if (statusCode >= 500 && !isTest) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body: ErrorBody = {
    success: false,
    error: {
      message: statusCode >= 500 && (isProd || isTest) ? 'Something went wrong' : message,
      code,
      ...(details ? { details } : {}),
    },
  };

  res.status(statusCode).json(body);
}
