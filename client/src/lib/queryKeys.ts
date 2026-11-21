import type { IssueFilters } from '@/types';

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  projectStats: (projectId: string) => ['project', projectId, 'stats'] as const,
  projectActivity: (projectId: string) => ['project', projectId, 'activity'] as const,
  projectLabels: (projectId: string) => ['project', projectId, 'labels'] as const,
  members: (projectId: string) => ['project', projectId, 'members'] as const,
  issues: (scope: string, filters: IssueFilters) => ['issues', scope, filters] as const,
  board: (projectId: string, filters: IssueFilters) => ['board', projectId, filters] as const,
  issue: (issueId: string) => ['issue', issueId] as const,
  comments: (issueId: string) => ['issue', issueId, 'comments'] as const,
  activity: (issueId: string) => ['issue', issueId, 'activity'] as const,
};

export type QueryKey = readonly unknown[];
