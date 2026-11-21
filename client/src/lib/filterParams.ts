import type { IssueFilters, IssuePriority, IssueSort, IssueStatus, IssueType } from '@/types';

const STATUSES: IssueStatus[] = ['todo', 'in-progress', 'done'];
const PRIORITIES: IssuePriority[] = ['low', 'medium', 'high', 'critical'];
const TYPES: IssueType[] = ['bug', 'task', 'story'];
const SORTS: IssueSort[] = ['newest', 'oldest', 'priority', 'dueDate', 'recentlyUpdated'];

/** Reads shareable filter state from the URL query string. */
export function filtersFromParams(params: URLSearchParams): IssueFilters {
  const status = params
    .getAll('status')
    .filter((s): s is IssueStatus => STATUSES.includes(s as IssueStatus));
  const priority = params
    .getAll('priority')
    .filter((p): p is IssuePriority => PRIORITIES.includes(p as IssuePriority));
  const type = params.getAll('type').filter((t): t is IssueType => TYPES.includes(t as IssueType));
  const label = params.getAll('label').filter(Boolean);
  const sortParam = params.get('sort');
  const sort = SORTS.includes(sortParam as IssueSort) ? (sortParam as IssueSort) : 'newest';

  return {
    search: params.get('search') ?? undefined,
    status: status.length ? status : undefined,
    priority: priority.length ? priority : undefined,
    type: type.length ? type : undefined,
    label: label.length ? label : undefined,
    assignee: params.get('assignee') ?? undefined,
    reporter: params.get('reporter') ?? undefined,
    project: params.get('project') ?? undefined,
    dueDateFrom: params.get('dueDateFrom') ?? undefined,
    dueDateTo: params.get('dueDateTo') ?? undefined,
    sort,
    page: Number(params.get('page') ?? 1) || 1,
    limit: Number(params.get('limit') ?? 20) || 20,
  };
}

/** Serialises filters back to URLSearchParams, skipping defaults. */
export function paramsFromFilters(filters: IssueFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  filters.status?.forEach((status) => params.append('status', status));
  filters.priority?.forEach((priority) => params.append('priority', priority));
  filters.type?.forEach((type) => params.append('type', type));
  filters.label?.forEach((label) => params.append('label', label));
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.reporter) params.set('reporter', filters.reporter);
  if (filters.project) params.set('project', filters.project);
  if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
  if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo);
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters.limit && filters.limit !== 20) params.set('limit', String(filters.limit));
  return params;
}

export function countActiveFilters(filters: IssueFilters): number {
  let count = 0;
  if (filters.search) count += 1;
  count += filters.status?.length ?? 0;
  count += filters.priority?.length ?? 0;
  count += filters.type?.length ?? 0;
  count += filters.label?.length ?? 0;
  if (filters.assignee) count += 1;
  if (filters.reporter) count += 1;
  if (filters.project) count += 1;
  if (filters.dueDateFrom) count += 1;
  if (filters.dueDateTo) count += 1;
  return count;
}
