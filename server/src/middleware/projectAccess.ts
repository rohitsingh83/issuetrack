import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { hasRoleAtLeast, type ProjectRole } from '../constants/domain';
import { Issue } from '../models/Issue';
import { Project } from '../models/Project';
import { resolveProjectRole } from '../policies/permissions';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Loads `:projectId`, verifies the authenticated user is a member and attaches
 * `req.project` + `req.projectRole`. Any non-member receives 403 (404 would also
 * be defensible, but 403 matches the documented API contract).
 */
export function loadProject(minRole?: ProjectRole) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const { projectId } = req.params;
    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      throw ApiError.notFound('Project not found');
    }
    const project = await Project.findById(projectId);
    if (!project) throw ApiError.notFound('Project not found');

    if (!req.user) throw ApiError.unauthorized();
    const role = resolveProjectRole(project, String(req.user._id));
    if (!role) throw ApiError.forbidden('You are not a member of this project');

    if (minRole) {
      if (!hasRoleAtLeast(role, minRole)) {
        throw ApiError.forbidden(`This action requires the "${minRole}" role or higher`);
      }
    }

    req.project = project;
    req.projectRole = role;
    next();
  });
}

/**
 * Loads `:issueId` together with its project and verifies membership.
 */
export function loadIssue(minRole?: ProjectRole) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const { issueId } = req.params;
    if (!issueId || !mongoose.isValidObjectId(issueId)) throw ApiError.notFound('Issue not found');

    const issue = await Issue.findById(issueId);
    if (!issue) throw ApiError.notFound('Issue not found');

    if (!req.user) throw ApiError.unauthorized();
    const project = await Project.findById(issue.project);
    if (!project) throw ApiError.notFound('Project not found');

    const role = resolveProjectRole(project, String(req.user._id));
    if (!role) throw ApiError.forbidden('You are not a member of this project');

    if (minRole) {
      if (!hasRoleAtLeast(role, minRole)) {
        throw ApiError.forbidden(`This action requires the "${minRole}" role or higher`);
      }
    }

    req.issue = issue;
    req.project = project;
    req.projectRole = role;
    next();
  });
}

/** Asserts that a referenced user belongs to the project (used for assignee validation). */
export async function assertProjectMember(projectId: string, userId: string): Promise<void> {
  const project = await Project.findById(projectId);
  if (!project) throw ApiError.notFound('Project not found');
  const role = resolveProjectRole(project, userId);
  if (!role) throw ApiError.badRequest('Assignee must be a member of this project');
}
