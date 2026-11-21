import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';
import { cacheProject } from './useProjects';

export function useMembers(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.members(projectId ?? 'none'),
    queryFn: async () => (await api.projects.members.list(projectId as string)).data,
    enabled: Boolean(projectId),
  });
}

function syncProject(queryClient: ReturnType<typeof useQueryClient>, project: Project) {
  cacheProject(queryClient, project);
  queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects });
  queryClient.invalidateQueries({ queryKey: queryKeys.members(project.id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; role: string }) =>
      (await api.projects.members.add(projectId, payload)).data,
    onSuccess: (project) => {
      syncProject(queryClient, project);
      toast.success('Member added to the project');
    },
  });
}

export function useUpdateMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: string; role: string }) =>
      (await api.projects.members.updateRole(projectId, payload.userId, payload.role)).data,
    onSuccess: (project) => {
      syncProject(queryClient, project);
      toast.success('Role updated');
    },
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.projects.members.remove(projectId, userId)).data,
    onSuccess: (project) => {
      syncProject(queryClient, project);
      toast.success('Member removed');
    },
  });
}
