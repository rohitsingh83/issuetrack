import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as issueService from '../services/issue.service';
import * as activityService from '../services/activity.service';
import { canCreateIssue, canDeleteIssue, canEditIssue } from '../policies/permissions';
import { Project } from '../models/Project';
import { Issue } from '../models/Issue';
import { serializeIssue } from '../serializers';
import type { IssueQueryInput } from '../validators';
import { ApiError } from '../utils/ApiError';
import { validated } from '../middleware/validate';
import { paginated, sendCreated, sendSuccess } from '../utils/response';

type IssueBody = issueService.IssueWriteInput;

/** GET /api/projects/:projectId/issues — filtered, sorted, paginated list. */
export async function listProjectIssues(req: Request, res: Response) {
  const query = validated<IssueQueryInput>(req.validated.query);
  const result = await issueService.listIssues(query, {
    projectIds: [String(req.project!._id)],
    projectFilter: String(req.project!._id),
    userId: String(req.user!._id),
  });
  return paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
}

export async function createIssueHandler(req: Request, res: Response) {
  if (!canCreateIssue(req.projectRole)) {
    throw ApiError.forbidden('Viewers cannot create issues');
  }
  const body = validated<IssueBody>(req.validated.body);
  const issue = await issueService.createIssue(req.project!, String(req.user!._id), body);
  return sendCreated(res, issue);
}

/** GET /api/projects/:projectId/issues/board */
export async function boardIssuesHandler(req: Request, res: Response) {
  const query = validated<IssueQueryInput>(req.validated.query);
  const result = await issueService.listBoardIssues(req.project!, query, String(req.user!._id));
  return sendSuccess(res, result.items, 200, { total: result.total });
}

/** GET /api/issues — cross-project list scoped to the caller's memberships. */
export async function listAllIssues(req: Request, res: Response) {
  const query = validated<IssueQueryInput>(req.validated.query);
  const userId = String(req.user!._id);
  const projects = await Project.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).select('_id');
  const projectIds = projects.map((p) => String(p._id));

  if (query.project && !projectIds.includes(query.project)) {
    throw ApiError.forbidden('You are not a member of that project');
  }

  const result = await issueService.listIssues(query, {
    projectIds,
    ...(query.project ? { projectFilter: query.project } : {}),
    userId,
  });
  return paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
}

export async function getIssueHandler(req: Request, res: Response) {
  const issue = await issueService.getIssueById(String(req.issue!._id));
  return sendSuccess(res, issue);
}

export async function updateIssueHandler(req: Request, res: Response) {
  const body = validated<IssueBody>(req.validated.body);
  if (!canEditIssue(req.projectRole, req.issue!, String(req.user!._id))) {
    throw ApiError.forbidden('You can only edit issues you reported or are assigned to');
  }
  const issue = await issueService.updateIssue({
    actorId: String(req.user!._id),
    project: req.project!,
    issue: req.issue!,
    input: body,
  });
  return sendSuccess(res, issue);
}

/** PATCH /api/issues/:issueId/status — dedicated endpoint used by the Kanban board. */
export async function updateStatusHandler(req: Request, res: Response) {
  const body = validated<{ status: 'todo' | 'in-progress' | 'done' }>(req.validated.body);
  if (!canEditIssue(req.projectRole, req.issue!, String(req.user!._id))) {
    throw ApiError.forbidden(
      'You can only change the status of issues you reported or are assigned to',
    );
  }
  const issue = await issueService.updateIssue({
    actorId: String(req.user!._id),
    project: req.project!,
    issue: req.issue!,
    input: { status: body.status },
  });
  return sendSuccess(res, issue);
}

export async function assignIssueHandler(req: Request, res: Response) {
  const body = validated<{ assignee: string | null }>(req.validated.body);
  if (!canEditIssue(req.projectRole, req.issue!, String(req.user!._id))) {
    throw ApiError.forbidden('You are not allowed to reassign this issue');
  }
  const issue = await issueService.updateIssue({
    actorId: String(req.user!._id),
    project: req.project!,
    issue: req.issue!,
    input: { assignee: body.assignee },
  });
  return sendSuccess(res, issue);
}

export async function deleteIssueHandler(req: Request, res: Response) {
  if (!canDeleteIssue(req.projectRole, req.issue!, String(req.user!._id))) {
    throw ApiError.forbidden('You do not have permission to delete this issue');
  }
  await issueService.deleteIssue(req.project!, req.issue!, String(req.user!._id));
  return sendSuccess(res, { message: 'Issue deleted' });
}

export async function issueActivityHandler(req: Request, res: Response) {
  const activity = await activityService.listIssueActivity(String(req.issue!._id));
  return sendSuccess(res, activity);
}

/** GET /api/issues/:issueId/meta — lightweight payload with permissions for the UI. */
export async function issueMetaHandler(req: Request, res: Response) {
  const userId = String(req.user!._id);
  return sendSuccess(res, {
    role: req.projectRole,
    permissions: {
      canEdit: canEditIssue(req.projectRole, req.issue!, userId),
      canDelete: canDeleteIssue(req.projectRole, req.issue!, userId),
      canCreateIssue: canCreateIssue(req.projectRole),
    },
  });
}

/** Internal helper reused by tests and the seed script. */
export async function findIssueByKeyOrId(value: string) {
  if (mongoose.isValidObjectId(value)) return Issue.findById(value);
  const [key] = value.split('-');
  const number = Number(value.split('-')[1]);
  if (!key || Number.isNaN(number)) return null;
  return Issue.findOne({ issueKey: `${key.toUpperCase()}-${number}` });
}

export { serializeIssue };
