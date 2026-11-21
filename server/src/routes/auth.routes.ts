import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { clerkLoginSchema, loginSchema, registerSchema } from '../validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);
router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);
router.post(
  '/clerk',
  authRateLimiter,
  validate({ body: clerkLoginSchema }),
  asyncHandler(authController.clerkLogin),
);
router.get('/providers', asyncHandler(authController.providers));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
