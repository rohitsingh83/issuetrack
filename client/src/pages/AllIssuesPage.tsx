import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { IssueFilterBar } from '@/components/issues/IssueFilterBar';
import { IssueTable } from '@/components/issues/IssueTable';
import { useIssues } from '@/hooks/useIssues';
import { useProjects } from '@/hooks/useProjects';
import { filtersFromParams, paramsFromFilters, countActiveFilters } from '@/lib/filterParams';
import type { IssueFilters } from '@/types';

/** Cross-project issue explorer with shareable URL state. */
export function AllIssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<IssueFilters>(() => filtersFromParams(searchParams), [searchParams]);
  const { data: projects } = useProjects();
  const { data, isLoading, isError, error, refetch, isFetching } = useIssues(filters);

  const applyFilters = (next: IssueFilters) =>
    setSearchParams(paramsFromFilters(next), { replace: false });
  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: false });
  const activeFilters = countActiveFilters(filters);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((project) =>
      project.members.forEach((member) => map.set(member.id, member.name)),
    );
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [projects]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">All issues</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Search, filter and sort every issue you have access to across all projects.
        </p>
      </header>

      <IssueFilterBar
        filters={filters}
        onChange={applyFilters}
        onClear={clearFilters}
        assignees={assignees}
        projects={projects ?? []}
        showProjectFilter
        resultCount={data?.pagination.total}
      />

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : isError ? (
        <ErrorState
          title="Could not load issues"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={activeFilters ? 'No issues match your filters' : 'No issues yet'}
          description={
            activeFilters
              ? 'Try removing a filter or searching for a different term.'
              : 'Issues from all projects you belong to will appear here.'
          }
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          action={
            activeFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
            <IssueTable issues={data.items} />
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
