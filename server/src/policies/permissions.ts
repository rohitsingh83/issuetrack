import { hasRoleAtLeast, type ProjectRole } from '../constants/domain';
import type { IIssue } from '../models/Issue';
import type { IProject } from '../models/Project';

export function resolveProjectRole(
  project: Pick<IProject, 'owner' | 'members'>,
  userId: string,
): ProjectRole | undefined {
  const ownerId = String(project.owner);
  if (ownerId === userId) return 'owner';
  const membership = project.members.find((m) => String(m.user) === userId);
  if (!membership) return undefined;
  // Defensive: owner is always owner even if a stale member row says otherwise.
  return membership.role === 'owner' ? 'owner' : membership.role;
}

export function isProjectMember(role?: ProjectRole): boolean {
  return Boolean(role);
}

export function canManageMembers(role?: ProjectRole): boolean {
  return hasRoleAtLeast(role, 'admin');
}

export function canEditProject(role?: ProjectRole): boolean {
  return hasRoleAtLeast(role, 'admin');
}

export function canDeleteProject(role?: ProjectRole): boolean {
  return role === 'owner';
}

export function canCreateIssue(role?: ProjectRole): boolean {
  return hasRoleAtLeast(role, 'member');
}

export function canComment(role?: ProjectRole): boolean {
  return hasRoleAtLeast(role, 'member');
}

/** Viewers are read-only. Members may edit issues they reported or are assigned to. */
export function canEditIssue(
  role: ProjectRole | undefined,
  issue: Pick<IIssue, 'reporter' | 'assignee'>,
  userId: string,
): boolean {
  if (hasRoleAtLeast(role, 'admin')) return true;
  if (role !== 'member') return false;
  return String(issue.reporter) === userId || String(issue.assignee) === userId;
}

/** Admins/owners may delete any issue; members may delete issues they reported. */
export function canDeleteIssue(
  role: ProjectRole | undefined,
  issue: Pick<IIssue, 'reporter'>,
  userId: string,
): boolean {
  if (hasRoleAtLeast(role, 'admin')) return true;
  if (role !== 'member') return false;
  return String(issue.reporter) === userId;
}

export function canManageAttachments(
  role: ProjectRole | undefined,
  issue: Pick<IIssue, 'reporter' | 'assignee'>,
  userId: string,
): boolean {
  return canEditIssue(role, issue, userId);
}
