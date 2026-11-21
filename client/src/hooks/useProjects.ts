import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';
import { useRealtime } from './useRealtime';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => (await api.projects.list()).data,
    staleTime: 30_000,
  });
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: async () => (await api.projects.get(projectId as string)).data,
    enabled: Boolean(projectId),
  });
}

export function useProjectStats(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.projectStats(projectId ?? 'none'),
    queryFn: async () => (await api.projects.stats(projectId as string)).data,
    enabled: Boolean(projectId),
  });
}

export function useProjectActivity(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.projectActivity(projectId ?? 'none'),
    queryFn: async () => (await api.projects.activity(projectId as string)).data,
    enabled: Boolean(projectId),
  });
}

export function useProjectLabels(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.projectLabels(projectId ?? 'none'),
    queryFn: async () => (await api.projects.labels(projectId as string)).data,
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { socket } = useRealtime();

  return useMutation({
    mutationFn: async (payload: { name: string; key: string; description?: string }) =>
      (await api.projects.create(payload)).data,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.setQueryData(queryKeys.project(project.id), project);
      socket?.emit('join:project', project.id);
      toast.success(`Project “${project.name}” created`);
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name?: string; description?: string }) =>
      (await api.projects.update(projectId, payload)).data,
    onSuccess: (project: Project) => {
      queryClient.setQueryData(queryKeys.project(projectId), project);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Project updated');
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.projects.remove(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Project deleted');
    },
  });
}
