import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Issue } from '@/types';

export function useComments(issueId?: string) {
  return useQuery({
    queryKey: queryKeys.comments(issueId ?? 'none'),
    queryFn: async () => (await api.issues.comments.list(issueId as string)).data,
    enabled: Boolean(issueId),
  });
}

export function useIssueActivity(issueId?: string) {
  return useQuery({
    queryKey: queryKeys.activity(issueId ?? 'none'),
    queryFn: async () => (await api.issues.activity(issueId as string)).data,
    enabled: Boolean(issueId),
  });
}

export function useCreateComment(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) =>
      (await api.issues.comments.create(issueId, content)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(issueId) });
      toast.success('Comment added');
    },
  });
}

export function useUpdateComment(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) =>
      (await api.issues.comments.update(issueId, commentId, content)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(issueId) });
      toast.success('Comment updated');
    },
  });
}

export function useDeleteComment(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.issues.comments.remove(issueId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(issueId) });
      toast.success('Comment deleted');
    },
  });
}

export function useUploadAttachments(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => (await api.issues.attachments.upload(issueId, files)).data,
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(issueId) });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      toast.success(filesLabel(issue.attachments.length));
    },
  });
}

function filesLabel(_count: number): string {
  return 'Attachment uploaded';
}

export function useDeleteAttachment(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) =>
      (await api.issues.attachments.remove(issueId, attachmentId)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(issueId) });
      toast.success('Attachment removed');
    },
  });
}
