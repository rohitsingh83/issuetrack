import type { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Issue } from '@/types';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  queryClient?: QueryClient;
}

/** Renders UI inside a router + query client with retries disabled. */
export function renderWithProviders(
  ui: ReactNode,
  {
    route = '/',
    queryClient = createTestQueryClient(),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export const mockUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@test.dev',
  avatarUrl: null,
};

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  const now = new Date().toISOString();
  return {
    id: 'issue-1',
    projectId: 'project-1',
    projectKey: 'WEB',
    issueNumber: 1,
    issueKey: 'WEB-1',
    title: 'Login form fails on Safari',
    description: 'Steps to reproduce',
    type: 'bug',
    priority: 'high',
    status: 'todo',
    reporter: mockUser,
    assignee: null,
    labels: ['auth'],
    dueDate: null,
    attachments: [],
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
