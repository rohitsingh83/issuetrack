import { useEffect, useRef, useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import {
  ISSUE_TYPE_META,
  ISSUE_TYPE_ORDER,
  PRIORITY_META,
  PRIORITY_ORDER,
  SORT_OPTIONS,
  STATUS_META,
  STATUS_ORDER,
} from '@/lib/constants';
import { countActiveFilters } from '@/lib/filterParams';
import { cn } from '@/lib/utils';
import type { IssueFilters, IssueStatus, Project } from '@/types';

interface IssueFilterBarProps {
  filters: IssueFilters;
  onChange: (next: IssueFilters) => void;
  onClear: () => void;
  assignees?: { id: string; name: string }[];
  labels?: string[];
  projects?: Project[];
  showProjectFilter?: boolean;
  resultCount?: number;
  compact?: boolean;
}

/** Search + filters + sort bar used by both the issue table and the Kanban board. */
export function IssueFilterBar({
  filters,
  onChange,
  onClear,
  assignees = [],
  labels = [],
  projects = [],
  showProjectFilter = false,
  resultCount,
  compact = false,
}: IssueFilterBarProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<number>();

  useEffect(() => {
    setSearchDraft(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    return () => window.clearTimeout(debounceRef.current);
  }, []);

  const commitSearch = (value: string) => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChange({ ...filters, search: value.trim() || undefined, page: 1 });
    }, 320);
  };

  const toggleStatus = (status: IssueStatus) => {
    const current = filters.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...filters, status: next.length ? next : undefined, page: 1 });
  };

  const activeCount = countActiveFilters(filters);

  return (
    <div className="surface-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchDraft}
            onChange={(event) => {
              setSearchDraft(event.target.value);
              commitSearch(event.target.value);
            }}
            placeholder="Search by title, key, description or label…"
            aria-label="Search issues"
            className="pl-9"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => {
                setSearchDraft('');
                onChange({ ...filters, search: undefined, page: 1 });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="hidden items-center gap-1 rounded-lg bg-slate-100 p-0.5 lg:flex"
            role="group"
            aria-label="Filter by status"
          >
            {STATUS_ORDER.map((status) => {
              const active = filters.status?.includes(status) ?? false;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-800',
                  )}
                >
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[status].dot)}
                    aria-hidden="true"
                  />
                  {STATUS_META[status].label}
                </button>
              );
            })}
          </div>

          <Select
            value={filters.sort ?? 'newest'}
            onChange={(event) =>
              onChange({ ...filters, sort: event.target.value as IssueFilters['sort'], page: 1 })
            }
            aria-label="Sort issues"
            className="w-auto min-w-[9.5rem]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Button
            variant={expanded ? 'subtle' : 'secondary'}
            size="md"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="issue-filter-panel"
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div
          id="issue-filter-panel"
          className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="block text-xs font-medium text-slate-600">
            Status
            <Select
              className="mt-1"
              value={filters.status?.[0] ?? ''}
              onChange={(event) =>
                onChange({
                  ...filters,
                  status: event.target.value ? [event.target.value as IssueStatus] : undefined,
                  page: 1,
                })
              }
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Priority
            <Select
              className="mt-1"
              value={filters.priority?.[0] ?? ''}
              onChange={(event) =>
                onChange({
                  ...filters,
                  priority: event.target.value
                    ? [event.target.value as NonNullable<IssueFilters['priority']>[number]]
                    : undefined,
                  page: 1,
                })
              }
            >
              <option value="">All priorities</option>
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_META[priority].label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Type
            <Select
              className="mt-1"
              value={filters.type?.[0] ?? ''}
              onChange={(event) =>
                onChange({
                  ...filters,
                  type: event.target.value
                    ? [event.target.value as NonNullable<IssueFilters['type']>[number]]
                    : undefined,
                  page: 1,
                })
              }
            >
              <option value="">All types</option>
              {ISSUE_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {ISSUE_TYPE_META[type].label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Assignee
            <Select
              className="mt-1"
              value={filters.assignee ?? ''}
              onChange={(event) =>
                onChange({ ...filters, assignee: event.target.value || undefined, page: 1 })
              }
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </Select>
          </label>

          {showProjectFilter && projects.length > 0 && (
            <label className="block text-xs font-medium text-slate-600">
              Project
              <Select
                className="mt-1"
                value={filters.project ?? ''}
                onChange={(event) =>
                  onChange({ ...filters, project: event.target.value || undefined, page: 1 })
                }
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.key})
                  </option>
                ))}
              </Select>
            </label>
          )}

          {labels.length > 0 && (
            <label className="block text-xs font-medium text-slate-600">
              Label
              <Select
                className="mt-1"
                value={filters.label?.[0] ?? ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    label: event.target.value ? [event.target.value] : undefined,
                    page: 1,
                  })
                }
              >
                <option value="">All labels</option>
                {labels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          )}

          <label className="block text-xs font-medium text-slate-600">
            Due from
            <Input
              type="date"
              className="mt-1"
              value={filters.dueDateFrom ?? ''}
              onChange={(event) =>
                onChange({ ...filters, dueDateFrom: event.target.value || undefined, page: 1 })
              }
            />
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Due until
            <Input
              type="date"
              className="mt-1"
              value={filters.dueDateTo ?? ''}
              onChange={(event) =>
                onChange({ ...filters, dueDateTo: event.target.value || undefined, page: 1 })
              }
            />
          </label>

          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={onClear}
              leftIcon={<X className="h-4 w-4" />}
            >
              Clear filters
            </Button>
          </div>
        </div>
      )}

      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          {typeof resultCount === 'number' ? (
            <span data-testid="result-count">
              <span className="font-semibold text-slate-700">{resultCount}</span>{' '}
              {resultCount === 1 ? 'issue' : 'issues'} match
            </span>
          ) : (
            <span>Filter and sort issues</span>
          )}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto rounded px-1.5 py-0.5 font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Reset {activeCount} filter{activeCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
