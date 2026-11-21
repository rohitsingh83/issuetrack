import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { cacheProject } from '@/hooks/useProjects';
import { queryKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';

const base: Project = {
  id: 'p1',
  name: 'ShopEasy',
  key: 'SHOP',
  description: '',
  owner: null,
  members: [],
  memberCount: 1,
  createdAt: '2026-11-21T00:00:00.000Z',
  updatedAt: '2026-11-21T00:00:00.000Z',
};

describe('cacheProject', () => {
  it('keeps the caller role when a mutation response omits it (add member regression)', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.project('p1'), { ...base, role: 'owner' });

    cacheProject(client, { ...base, memberCount: 2 });

    expect(client.getQueryData<Project>(queryKeys.project('p1'))).toMatchObject({
      memberCount: 2,
      role: 'owner',
    });
  });

  it('uses the role from the response when the server sends one', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.project('p1'), { ...base, role: 'owner' });

    cacheProject(client, { ...base, role: 'admin' });

    expect(client.getQueryData<Project>(queryKeys.project('p1'))?.role).toBe('admin');
  });
});
