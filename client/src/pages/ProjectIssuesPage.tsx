import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListTodo, Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { IssueFilterBar } from '@/components/issues/IssueFilterBar';
import { IssueTable } from '@/components/issues/IssueTable';
import { useProjectContext } from '@/context/ProjectContext';
import { useIssues } from '@/hooks/useIssues';
import { useMembers } from '@/hooks/useMembers';
import { useProjectLabels } from '@/hooks/useProjects';
import { filtersFromParams, paramsFromFilters, countActiveFilters } from '@/lib/filterParams';
import type { IssueFilters } from '@/types';

export function ProjectIssuesPage() {
  const { project, canCreateIssue, openCreateIssue } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<IssueFilters>(() => filtersFromParams(searchParams), [searchParams]);

  const { data: membersData } = useMembers(project.id);
  const { data: labels } = useProjectLabels(project.id);
  const { data, isLoading, isError, error, refetch, isFetching } = useIssues({
    ...filters,
    projectId: project.id,
  });

  const applyFilters = (next: IssueFilters) => {
    setSearchParams(paramsFromFilters(next), { replace: false });
  };

  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: false });
  const activeFilters = countActiveFilters(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Issues
          {data && (
            <span className="ml-2 text-xs font-normal text-slate-600">
              {data.pagination.total} in {project.key}
            </span>
          )}
        </h2>
        {canCreateIssue && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateIssue}>
            New issue
          </Button>
        )}
      </div>

      <IssueFilterBar
        filters={filters}
        onChange={applyFilters}
        onClear={clearFilters}
        assignees={membersData?.members ?? []}
        labels={labels ?? []}
        resultCount={data?.pagination.total}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState
          title="Could not load issues"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        activeFilters > 0 ? (
          <EmptyState
            title="No issues match your filters"
            description="Try removing a filter, changing the sort order, or searching for a different term."
            icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No issues yet"
            description={`Nothing has been logged in ${project.name} yet. Create the first issue to get started.`}
            icon={<ListTodo className="h-6 w-6" aria-hidden="true" />}
            action={
              canCreateIssue ? (
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateIssue}>
                  New issue
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div
            className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}
            aria-busy={isFetching || undefined}
          >
            <IssueTable issues={data.items} projectKey={project.key} />
          </div>
          <Pagination
            pagination={data.pagination}
            onPageChange={(page) => applyFilters({ ...filters, page })}
          />
        </>
      )}
    </div>
  );
}
