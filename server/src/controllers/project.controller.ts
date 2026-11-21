import type { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import * as activityService from '../services/activity.service';
import { listProjectLabels } from '../services/issue.service';
import { canDeleteProject, canEditProject, canManageMembers } from '../policies/permissions';
import { serializeProject } from '../serializers';
import { ApiError } from '../utils/ApiError';
import { validated } from '../middleware/validate';
import { sendCreated, sendSuccess } from '../utils/response';

export async function listProjects(req: Request, res: Response) {
  const projects = await projectService.listProjectsForUser(String(req.user!._id));
  return sendSuccess(res, projects);
}

export async function createProjectHandler(req: Request, res: Response) {
  const body = validated<{ name: string; key: string; description?: string }>(req.validated.body);
  const project = await projectService.createProject(String(req.user!._id), body);
  return sendCreated(res, project);
}

export async function getProject(req: Request, res: Response) {
  const project = await projectService.getProjectOrThrow(String(req.project!._id));
  return sendSuccess(res, serializeProject(project, req.projectRole));
}

export async function updateProjectHandler(req: Request, res: Response) {
  if (!canEditProject(req.projectRole)) {
    throw ApiError.forbidden('Only project admins and owners can edit project details');
  }
  const body = validated<{ name?: string; description?: string }>(req.validated.body);
  const project = await projectService.updateProject(req.project!, String(req.user!._id), body);
  return sendSuccess(res, project);
}

export async function deleteProjectHandler(req: Request, res: Response) {
  if (!canDeleteProject(req.projectRole)) {
    throw ApiError.forbidden('Only the project owner can delete this project');
  }
  await projectService.deleteProject(req.project!, String(req.user!._id));
  return sendSuccess(res, { message: 'Project deleted' });
}

export async function projectStatsHandler(req: Request, res: Response) {
  const stats = await projectService.projectStats(String(req.project!._id));
  return sendSuccess(res, stats);
}

export async function projectActivityHandler(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit ?? 30) || 30, 100);
  const activity = await activityService.listProjectActivity(String(req.project!._id), limit);
  return sendSuccess(res, activity);
}

export async function projectLabelsHandler(req: Request, res: Response) {
  const labels = await listProjectLabels(String(req.project!._id));
  return sendSuccess(res, labels);
}

export async function listMembers(req: Request, res: Response) {
  const project = await projectService.getProjectOrThrow(String(req.project!._id));
  const dto = serializeProject(project, req.projectRole);
  return sendSuccess(res, {
    members: dto.members,
    owner: dto.owner,
    canManage: canManageMembers(req.projectRole),
  });
}

export async function addMemberHandler(req: Request, res: Response) {
  if (!canManageMembers(req.projectRole)) {
    throw ApiError.forbidden('Only project admins and owners can manage members');
  }
  const body = validated<{ email: string; role: 'admin' | 'member' | 'viewer' }>(
    req.validated.body,
  );
  const project = await projectService.addMember(req.project!, String(req.user!._id), body);
  return sendCreated(res, project);
}

export async function updateMemberRoleHandler(req: Request, res: Response) {
  if (!canManageMembers(req.projectRole)) {
    throw ApiError.forbidden('Only project admins and owners can manage members');
  }
  const body = validated<{ role: 'owner' | 'admin' | 'member' | 'viewer' }>(req.validated.body);
  const project = await projectService.updateMemberRole(
    req.project!,
    String(req.user!._id),
    String(req.params.userId),
    body.role,
  );
  return sendSuccess(res, project);
}

export async function removeMemberHandler(req: Request, res: Response) {
  const isSelf = String(req.params.userId) === String(req.user!._id);
  if (!canManageMembers(req.projectRole) && !isSelf) {
    throw ApiError.forbidden('Only project admins and owners can remove members');
  }
  const project = await projectService.removeMember(
    req.project!,
    String(req.user!._id),
    String(req.params.userId),
  );
  return sendSuccess(res, project);
}
