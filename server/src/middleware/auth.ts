import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAuthToken } from '../utils/jwt';

export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[env.COOKIE_NAME];
  if (cookieToken) return cookieToken;
  return null;
}

/**
 * Requires a valid JWT (httpOnly cookie or Bearer token) and attaches the
 * authenticated user document to `req.user`.
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required. Please sign in.');

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Account no longer exists. Please sign in again.');

    req.user = user;
    next();
  },
);

/** Attaches the user when a valid token is present, but never rejects. */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyAuthToken(token);
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    } catch {
      // ignore invalid tokens for optional auth
    }
    next();
  },
);
