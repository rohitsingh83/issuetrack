import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Issue, IssueFilters, IssuePayload, IssueStatus, Paginated } from '@/types';

export function useIssues(filters: IssueFilters & { projectId?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.issues(filters.projectId ?? 'all', filters),
    queryFn: () => api.issues.list(filters),
    enabled,
    placeholderData: (previous) => previous as Paginated<Issue> | undefined,
  });
}

export function useBoardIssues(projectId?: string, filters: IssueFilters = {}) {
  return useQuery({
    queryKey: queryKeys.board(projectId ?? 'none', filters),
    queryFn: () => api.issues.board(projectId as string, filters),
    enabled: Boolean(projectId),
  });
}

export function useIssue(issueId?: string) {
  return useQuery({
    queryKey: queryKeys.issue(issueId ?? 'none'),
    queryFn: async () => (await api.issues.get(issueId as string)).data,
    enabled: Boolean(issueId),
  });
}

function patchIssueInCaches(queryClient: QueryClient, issue: Issue) {
  queryClient.setQueryData(queryKeys.issue(issue.id), issue);

  queryClient.setQueriesData<Paginated<Issue>>({ queryKey: ['issues'] }, (current) => {
    if (!current?.items) return current;
    return {
      ...current,
      items: current.items.map((item) => (item.id === issue.id ? { ...item, ...issue } : item)),
    };
  });

  queryClient.setQueriesData<Issue[]>({ queryKey: ['board'] }, (current) => {
    if (!Array.isArray(current)) return current;
    return current.map((item) => (item.id === issue.id ? { ...item, ...issue } : item));
  });
}

/**
 * Status changes are applied optimistically to every cached board/list so the
 * Kanban card moves instantly; failures roll the cache back.
 */
export function useUpdateIssueStatus(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      (await api.issues.updateStatus(issueId, status)).data,
    onMutate: async ({ issueId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.board(projectId, {}) });
      const previousBoards = queryClient.getQueriesData<Issue[]>({
        queryKey: ['board', projectId],
      });
      const previousIssue = queryClient.getQueryData<Issue>(queryKeys.issue(issueId));

      queryClient.setQueriesData<Issue[]>({ queryKey: ['board', projectId] }, (current) =>
        Array.isArray(current)
          ? current.map((issue) => (issue.id === issueId ? { ...issue, status } : issue))
          : current,
      );
      if (previousIssue) {
        queryClient.setQueryData(queryKeys.issue(issueId), { ...previousIssue, status });
      }
      return { previousBoards, previousIssue, issueId };
    },
    onError: (error: Error, _variables, context) => {
      context?.previousBoards?.forEach(([key, value]) => queryClient.setQueryData(key, value));
      if (context?.previousIssue) {
        queryClient.setQueryData(queryKeys.issue(context.issueId), context.previousIssue);
      }
      toast.error(error.message || 'Could not move the issue');
    },
    onSuccess: (issue) => {
      patchIssueInCaches(queryClient, issue);
      queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(issue.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useCreateIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: IssuePayload) => (await api.issues.create(projectId, payload)).data,
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectActivity(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(`${issue.issueKey} created`);
    },
  });
}

export function useUpdateIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ issueId, payload }: { issueId: string; payload: Partial<IssuePayload> }) =>
      (await api.issues.update(issueId, payload)).data,
    onSuccess: (issue) => {
      patchIssueInCaches(queryClient, issue);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(issue.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success(`${issue.issueKey} updated`);
    },
  });
}

export function useDeleteIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => api.issues.remove(issueId),
    onSuccess: (_data, issueId) => {
      queryClient.removeQueries({ queryKey: queryKeys.issue(issueId) });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Issue deleted');
    },
  });
}
