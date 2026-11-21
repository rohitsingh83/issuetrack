import { Router } from 'express';
import { dashboardHandler } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', requireAuth, asyncHandler(dashboardHandler));

export default router;
