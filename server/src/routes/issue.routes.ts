import { Router } from 'express';
import * as issueController from '../controllers/issue.controller';
import * as collaborationController from '../controllers/collaboration.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { loadIssue } from '../middleware/projectAccess';
import { upload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  commentCreateSchema,
  commentUpdateSchema,
  issueAttachmentParamSchema,
  issueCommentParamSchema,
  issueParamSchema,
  issueQuerySchema,
  updateIssueSchema,
  updateStatusSchema,
} from '../validators';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public (token-protected) attachment stream — must be registered before requireAuth.
router.get(
  '/:issueId/attachments/:attachmentId',
  validate({ params: issueAttachmentParamSchema }),
  optionalAuth,
  asyncHandler(collaborationController.downloadAttachmentHandler),
);

router.use(requireAuth);

router.get('/', validate({ query: issueQuerySchema }), asyncHandler(issueController.listAllIssues));

router.get(
  '/:issueId',
  validate({ params: issueParamSchema }),
  loadIssue(),
  asyncHandler(issueController.getIssueHandler),
);
router.patch(
  '/:issueId',
  validate({ params: issueParamSchema, body: updateIssueSchema }),
  loadIssue(),
  asyncHandler(issueController.updateIssueHandler),
);
router.delete(
  '/:issueId',
  validate({ params: issueParamSchema }),
  loadIssue(),
  asyncHandler(issueController.deleteIssueHandler),
);
router.patch(
  '/:issueId/status',
  validate({ params: issueParamSchema, body: updateStatusSchema }),
  loadIssue(),
  asyncHandler(issueController.updateStatusHandler),
);
router.patch(
  '/:issueId/assignee',
  validate({
    params: issueParamSchema,
    body: z.object({
      assignee: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .nullable(),
    }),
  }),
  loadIssue(),
  asyncHandler(issueController.assignIssueHandler),
);

// Comments
router.get(
  '/:issueId/comments',
  validate({ params: issueParamSchema }),
  loadIssue(),
  asyncHandler(collaborationController.listCommentsHandler),
);
router.post(
  '/:issueId/comments',
  validate({ params: issueParamSchema, body: commentCreateSchema }),
  loadIssue(),
  asyncHandler(collaborationController.createCommentHandler),
);
router.patch(
  '/:issueId/comments/:commentId',
  validate({ params: issueCommentParamSchema, body: commentUpdateSchema }),
  loadIssue(),
  asyncHandler(collaborationController.updateCommentHandler),
);
router.delete(
  '/:issueId/comments/:commentId',
  validate({ params: issueCommentParamSchema }),
  loadIssue(),
  asyncHandler(collaborationController.deleteCommentHandler),
);

// Attachments
router.post(
  '/:issueId/attachments',
  validate({ params: issueParamSchema }),
  loadIssue(),
  upload.array('files', 5),
  asyncHandler(collaborationController.uploadAttachmentsHandler),
);
router.delete(
  '/:issueId/attachments/:attachmentId',
  validate({ params: issueAttachmentParamSchema }),
  loadIssue(),
  asyncHandler(collaborationController.deleteAttachmentHandler),
);

// Activity timeline
router.get(
  '/:issueId/activity',
  validate({ params: issueParamSchema }),
  loadIssue(),
  asyncHandler(issueController.issueActivityHandler),
);

export default router;
