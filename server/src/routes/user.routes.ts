import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);
router.get('/me', asyncHandler(userController.getMe));
router.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(userController.updateMe));
router.get('/lookup', asyncHandler(userController.lookup));
router.get('/search', asyncHandler(userController.search));

export default router;
