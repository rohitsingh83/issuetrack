import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CircleDot, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BoardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { KanbanBoard } from '@/components/issues/KanbanBoard';
import { IssueFilterBar } from '@/components/issues/IssueFilterBar';
import { IssueFormModal } from '@/components/issues/IssueFormModal';
import { useProjectContext } from '@/context/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { useBoardIssues, useDeleteIssue, useUpdateIssueStatus } from '@/hooks/useIssues';
import { useMembers } from '@/hooks/useMembers';
import { useProjectLabels } from '@/hooks/useProjects';
import { filtersFromParams, paramsFromFilters } from '@/lib/filterParams';
import { canDeleteIssue, canEditIssue, isOverdue } from '@/lib/utils';
import { STATUS_ORDER } from '@/lib/constants';
import type { Issue, IssueFilters, IssueStatus } from '@/types';

export function BoardPage() {
  const { project, role, canCreateIssue } = useProjectContext();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<IssueFilters>(() => filtersFromParams(searchParams), [searchParams]);

  const {
    data: issues = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useBoardIssues(project.id, filters);
  const { data: membersData } = useMembers(project.id);
  const { data: labels } = useProjectLabels(project.id);

  const updateStatus = useUpdateIssueStatus(project.id);
  const deleteIssue = useDeleteIssue(project.id);

  const [editing, setEditing] = useState<Issue | null>(null);
  const [createStatus, setCreateStatus] = useState<IssueStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);

  const handleFiltersChange = (next: IssueFilters) => {
    setSearchParams(paramsFromFilters(next), { replace: true });
  };

  const handleClear = () => setSearchParams(new URLSearchParams(), { replace: true });

  const counts = useMemo(() => {
    const byStatus = { todo: 0, 'in-progress': 0, done: 0 } as Record<IssueStatus, number>;
    issues.forEach((issue) => {
      byStatus[issue.status] += 1;
    });
    return {
      byStatus,
      total: issues.length,
      overdue: issues.filter((issue) => isOverdue(issue.dueDate, issue.status)).length,
    };
  }, [issues]);

  const hasFilters = countFilterChips(filters) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
            <CircleDot className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            <strong className="font-semibold text-slate-700">{counts.total}</strong> total
          </span>
          {STATUS_ORDER.map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200"
            >
              {status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              )}
              {counts.byStatus[status]}
            </span>
          ))}
          {counts.overdue > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-200">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {counts.overdue} overdue
            </span>
          )}
        </div>
        {canCreateIssue && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateStatus('todo')}
            className="md:hidden"
          >
            Add issue
          </Button>
        )}
      </div>

      <IssueFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        onClear={handleClear}
        assignees={membersData?.members ?? []}
        labels={labels ?? []}
        resultCount={issues.length}
      />

      {isLoading ? (
        <BoardSkeleton />
      ) : isError ? (
        <ErrorState
          title="Could not load the board"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : issues.length === 0 && !hasFilters ? (
        <EmptyState
          title="This board is empty"
          description="Create the first issue to start tracking work across To Do, In Progress and Done."
          icon={<CircleDot className="h-6 w-6" aria-hidden="true" />}
          action={
            canCreateIssue ? (
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setCreateStatus('todo')}
              >
                Create issue
              </Button>
            ) : undefined
          }
        />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No issues match these filters"
          description="Try clearing a filter or searching for a different term."
          action={
            <Button variant="secondary" onClick={handleClear}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <KanbanBoard
          issues={issues}
          onStatusChange={(issue, status) => updateStatus.mutate({ issueId: issue.id, status })}
          onEdit={(issue) => setEditing(issue)}
          onDelete={(issue) => setDeleteTarget(issue)}
          canEditIssue={(issue) => canEditIssue(role, issue, user?.id)}
          canDeleteIssue={(issue) => canDeleteIssue(role, issue, user?.id)}
          onCreate={(status) => setCreateStatus(status)}
          canCreate={canCreateIssue}
        />
      )}

      {canCreateIssue && (
        <CreateIssueModal status={createStatus} onClose={() => setCreateStatus(null)} />
      )}

      <IssueFormModal
        mode="edit"
        open={Boolean(editing)}
        issue={editing ?? undefined}
        projectId={project.id}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.issueKey ?? 'issue'}?`}
        description="Deleting an issue also removes its comments and attachments. This cannot be undone."
        confirmLabel="Delete issue"
        destructive
        loading={deleteIssue.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteIssue.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}

function CreateIssueModal({
  status,
  onClose,
}: {
  status: IssueStatus | null;
  onClose: () => void;
}) {
  const { project } = useProjectContext();
  return (
    <IssueFormModal
      mode="create"
      open={Boolean(status)}
      projectId={project.id}
      {...(status ? { defaultStatus: status } : {})}
      onClose={onClose}
    />
  );
}

function countFilterChips(filters: IssueFilters): number {
  return (
    (filters.search ? 1 : 0) +
    (filters.status?.length ?? 0) +
    (filters.priority?.length ?? 0) +
    (filters.type?.length ?? 0) +
    (filters.label?.length ?? 0) +
    (filters.assignee ? 1 : 0) +
    (filters.dueDateFrom ? 1 : 0) +
    (filters.dueDateTo ? 1 : 0)
  );
}
