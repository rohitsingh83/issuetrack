export const PROJECT_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Higher index = more privileges. */
export const ROLE_WEIGHT: Record<ProjectRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export const ISSUE_TYPES = ['bug', 'task', 'story'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_STATUSES = ['todo', 'in-progress', 'done'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const PRIORITY_WEIGHT: Record<IssuePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const ACTIVITY_ACTIONS = [
  'project.created',
  'project.updated',
  'project.member.added',
  'project.member.removed',
  'project.member.role_changed',
  'issue.created',
  'issue.updated',
  'issue.status_changed',
  'issue.assigned',
  'issue.unassigned',
  'issue.priority_changed',
  'issue.deleted',
  'comment.added',
  'comment.updated',
  'comment.deleted',
  'attachment.added',
  'attachment.deleted',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export function hasRoleAtLeast(role: ProjectRole | undefined, min: ProjectRole): boolean {
  if (!role) return false;
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[min];
}
