import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Pencil,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { IssueTypeBadge, LabelChip, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { IssueFormModal } from '@/components/issues/IssueFormModal';
import { CommentSection } from '@/components/issues/CommentSection';
import { AttachmentSection } from '@/components/issues/AttachmentSection';
import { IssueActivityTimeline } from '@/components/issues/ActivityTimeline';
import { useProjectContext } from '@/context/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteIssue, useIssue, useUpdateIssue, useUpdateIssueStatus } from '@/hooks/useIssues';
import { useMembers } from '@/hooks/useMembers';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { canDeleteIssue, canEditIssue, formatDate, formatDateTime, isOverdue } from '@/lib/utils';

export function IssueDetailPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { project, role, canManageProject } = useProjectContext();
  const { user } = useAuth();
  const { data: issue, isLoading, isError, error, refetch } = useIssue(issueId);
  const { data: membersData } = useMembers(project.id);

  const updateIssue = useUpdateIssue(project.id);
  const updateStatus = useUpdateIssueStatus(project.id);
  const deleteIssue = useDeleteIssue(project.id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <PageLoader label="Loading issue…" />;

  if (isError || !issue) {
    return (
      <ErrorState
        title="Issue not found"
        message={error instanceof Error ? error.message : 'This issue may have been deleted.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const editable = canEditIssue(role, issue, user?.id);
  const deletable = canDeleteIssue(role, issue, user?.id);
  const overdue = isOverdue(issue.dueDate, issue.status);
  const members = membersData?.members ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/projects/${project.id}/board`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to board
        </Link>
        <div className="flex items-center gap-2">
          {editable && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => setEditOpen(true)}
            >
              Edit issue
            </Button>
          )}
          {deletable && (
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete issue
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="surface-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                {issue.issueKey}
              </span>
              <IssueTypeBadge type={issue.type} />
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
            </div>

            <h1 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
              {issue.title}
            </h1>

            <p className="mt-1 text-xs text-slate-600">
              Reported by{' '}
              <span className="font-medium text-slate-600">
                {issue.reporter?.name ?? 'Unknown'}
              </span>{' '}
              on {formatDate(issue.createdAt)} · updated {formatDateTime(issue.updatedAt)}
            </p>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Description
              </h2>
              {issue.description ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                  {issue.description}
                </p>
              ) : (
                <p className="mt-2 text-sm italic text-slate-600">No description provided.</p>
              )}
            </div>

            {issue.labels.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h2 className="sr-only">Labels</h2>
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map((label) => (
                    <LabelChip key={label} label={label} />
                  ))}
                </div>
              </div>
            )}
          </article>

          <AttachmentSection
            issueId={issue.id}
            attachments={issue.attachments}
            canManage={editable}
          />

          <CommentSection
            issueId={issue.id}
            canComment={role !== 'viewer'}
            canModerate={canManageProject}
          />
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="properties-heading" className="surface-card p-4">
            <h2 id="properties-heading" className="mb-3 text-sm font-semibold text-slate-800">
              Details
            </h2>

            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="detail-status"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600"
                >
                  Status
                </label>
                {editable ? (
                  <Select
                    id="detail-status"
                    value={issue.status}
                    className="h-9 py-0 text-sm"
                    onChange={(event) =>
                      updateStatus.mutate({
                        issueId: issue.id,
                        status: event.target.value as typeof issue.status,
                      })
                    }
                    disabled={updateStatus.isPending}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status].label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <StatusBadge status={issue.status} />
                )}
              </div>

              <div>
                <label
                  htmlFor="detail-priority"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600"
                >
                  Priority
                </label>
                {editable ? (
                  <Select
                    id="detail-priority"
                    value={issue.priority}
                    className="h-9 py-0 text-sm"
                    onChange={(event) =>
                      updateIssue.mutate({
                        issueId: issue.id,
                        payload: { priority: event.target.value as typeof issue.priority },
                      })
                    }
                    disabled={updateIssue.isPending}
                  >
                    {PRIORITY_ORDER.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_META[priority].label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <PriorityBadge priority={issue.priority} />
                )}
              </div>

              <div>
                <label
                  htmlFor="detail-assignee"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600"
                >
                  Assignee
                </label>
                {editable ? (
                  <Select
                    id="detail-assignee"
                    value={issue.assignee?.id ?? ''}
                    className="h-9 py-0 text-sm"
                    onChange={(event) =>
                      updateIssue.mutate({
                        issueId: issue.id,
                        payload: { assignee: event.target.value || null },
                      })
                    }
                    disabled={updateIssue.isPending}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <AssigneeDisplay
                    name={issue.assignee?.name}
                    email={issue.assignee?.email}
                    avatarUrl={issue.assignee?.avatarUrl}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Due date
                </span>
                <span
                  className={
                    overdue ? 'text-xs font-semibold text-rose-600' : 'text-xs text-slate-600'
                  }
                >
                  {issue.dueDate
                    ? `${formatDate(issue.dueDate)}${overdue ? ' · overdue' : ''}`
                    : 'None'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  <UserIcon className="h-3.5 w-3.5" aria-hidden="true" /> Reporter
                </span>
                <AssigneeDisplay
                  name={issue.reporter?.name}
                  email={issue.reporter?.email}
                  avatarUrl={issue.reporter?.avatarUrl}
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  Project
                </span>
                <Link
                  to={`/projects/${project.id}/board`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  {project.key}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <IssueActivityTimeline issueId={issue.id} />
        </aside>
      </div>

      <IssueFormModal
        mode="edit"
        open={editOpen}
        issue={issue}
        projectId={project.id}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${issue.issueKey}?`}
        description="This permanently deletes the issue, its comments and attachments. This cannot be undone."
        confirmLabel="Delete issue"
        destructive
        loading={deleteIssue.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteIssue.mutate(issue.id, {
            onSuccess: () => navigate(`/projects/${project.id}/board`, { replace: true }),
          });
        }}
      />
    </div>
  );
}

function AssigneeDisplay({
  name,
  email,
  avatarUrl,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  if (!name) return <span className="text-xs text-slate-600">Unassigned</span>;
  return (
    <span className="flex items-center gap-1.5">
      <Avatar name={name} email={email ?? undefined} src={avatarUrl ?? null} size="xs" />
      <span className="text-xs text-slate-700">{name}</span>
    </span>
  );
}
