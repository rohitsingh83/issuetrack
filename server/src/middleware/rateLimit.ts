import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';

const skip = () => isTest;

/** Strict limiter for credential endpoints (login/register). */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again later.',
      code: 'TOO_MANY_REQUESTS',
    },
  },
});

/** General API limiter. */
export const apiRateLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: { message: 'Too many requests. Please slow down.', code: 'TOO_MANY_REQUESTS' },
  },
});
