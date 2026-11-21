import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import * as issueController from '../controllers/issue.controller';
import { requireAuth } from '../middleware/auth';
import { loadProject } from '../middleware/projectAccess';
import { validate } from '../middleware/validate';
import {
  addMemberSchema,
  createIssueSchema,
  createProjectSchema,
  issueQuerySchema,
  objectIdParamSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from '../validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

// Projects
router.get('/', asyncHandler(projectController.listProjects));
router.post(
  '/',
  validate({ body: createProjectSchema }),
  asyncHandler(projectController.createProjectHandler),
);

router.get(
  '/:projectId',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.getProject),
);
router.patch(
  '/:projectId',
  validate({ params: objectIdParamSchema, body: updateProjectSchema }),
  loadProject(),
  asyncHandler(projectController.updateProjectHandler),
);
router.delete(
  '/:projectId',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.deleteProjectHandler),
);
router.get(
  '/:projectId/stats',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.projectStatsHandler),
);
router.get(
  '/:projectId/activity',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.projectActivityHandler),
);
router.get(
  '/:projectId/labels',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.projectLabelsHandler),
);

// Members
router.get(
  '/:projectId/members',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.listMembers),
);
router.post(
  '/:projectId/members',
  validate({ params: objectIdParamSchema, body: addMemberSchema }),
  loadProject('admin'),
  asyncHandler(projectController.addMemberHandler),
);
router.patch(
  '/:projectId/members/:userId',
  validate({ params: objectIdParamSchema, body: updateMemberRoleSchema }),
  loadProject('admin'),
  asyncHandler(projectController.updateMemberRoleHandler),
);
router.delete(
  '/:projectId/members/:userId',
  validate({ params: objectIdParamSchema }),
  loadProject(),
  asyncHandler(projectController.removeMemberHandler),
);

// Issues scoped to a project
router.get(
  '/:projectId/issues',
  validate({ params: objectIdParamSchema, query: issueQuerySchema }),
  loadProject(),
  asyncHandler(issueController.listProjectIssues),
);
router.get(
  '/:projectId/issues/board',
  validate({ params: objectIdParamSchema, query: issueQuerySchema }),
  loadProject(),
  asyncHandler(issueController.boardIssuesHandler),
);
router.post(
  '/:projectId/issues',
  validate({ params: objectIdParamSchema, body: createIssueSchema }),
  loadProject('member'),
  asyncHandler(issueController.createIssueHandler),
);

export default router;
