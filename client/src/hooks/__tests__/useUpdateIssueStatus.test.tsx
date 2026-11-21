import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpdateIssueStatus } from '@/hooks/useIssues';
import { queryKeys } from '@/lib/queryKeys';
import { makeIssue } from '@/test/utils';
import type { Issue } from '@/types';

const mocks = vi.hoisted(() => ({ updateStatus: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      issues: { ...actual.api.issues, updateStatus: mocks.updateStatus },
    },
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 60));

function setup(issues: Issue[]) {
  // A non-zero gcTime is required: inactive queries with gcTime 0 are collected
  // before the optimistic update can be observed.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  queryClient.setQueryData(queryKeys.board('project-1', {}), issues);

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const { result } = renderHook(() => useUpdateIssueStatus('project-1'), { wrapper: Wrapper });
  return { result, queryClient };
}

describe('useUpdateIssueStatus', () => {
  it('optimistically moves the card and keeps the server response', async () => {
    const issue = makeIssue({ id: 'issue-1', status: 'todo' });
    mocks.updateStatus.mockResolvedValue({ data: { ...issue, status: 'done' } });

    const { result, queryClient } = setup([issue]);

    await act(async () => {
      await result.current.mutateAsync({ issueId: 'issue-1', status: 'done' });
    });
    await flush();

    expect(result.current.isSuccess).toBe(true);
    expect(mocks.updateStatus).toHaveBeenCalledWith('issue-1', 'done');
    const board = queryClient.getQueryData<Issue[]>(queryKeys.board('project-1', {}));
    expect(board?.[0].status).toBe('done');
  });

  it('rolls back the optimistic update when the API rejects', async () => {
    const issue = makeIssue({ id: 'issue-1', status: 'todo' });
    mocks.updateStatus.mockImplementation(async () => {
      throw new Error('Forbidden');
    });

    const { result, queryClient } = setup([issue]);

    await act(async () => {
      await result.current
        .mutateAsync({ issueId: 'issue-1', status: 'done' })
        .catch(() => undefined);
    });
    await flush();

    expect(result.current.isError).toBe(true);
    const board = queryClient.getQueryData<Issue[]>(queryKeys.board('project-1', {}));
    expect(board?.[0].status).toBe('todo');
  });
});
