import { Link } from 'react-router-dom';
import {
  CalendarClock,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  UserRound,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from '@/components/ui/Avatar';
import { IssueTypeBadge, LabelChip, PriorityBadge } from '@/components/ui/Badge';
import { Menu } from '@/components/ui/Menu';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { cn, formatDate, isOverdue, relativeTime } from '@/lib/utils';
import type { Issue, IssueStatus } from '@/types';

export interface IssueCardProps {
  issue: Issue;
  onMove?: (issue: Issue, status: IssueStatus) => void;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issue: Issue) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  dragDisabled?: boolean;
}

/** Kanban card: draggable, keyboard-sortable and with a menu fallback for status changes. */
export function IssueCard({
  issue,
  onMove,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  dragDisabled,
}: IssueCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { status: issue.status, type: 'issue' },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Pointer/touch dragging works from anywhere on the card; keyboard dragging is
  // activated from the focused grip so screen-reader users get an explicit handle.
  const { onKeyDown, ...pointerListeners } = (listeners ?? {}) as {
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    [key: string]: unknown;
  };

  const overdue = isOverdue(issue.dueDate, issue.status);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...(dragDisabled ? {} : pointerListeners)}
      className={cn(
        'group relative rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-card transition-all duration-200 hover:border-brand-300 hover:shadow-raised hover:-translate-y-0.5',
        isDragging && 'z-20 opacity-75 shadow-pop ring-2 ring-brand-400 rotate-1',
      )}
      aria-label={`${issue.issueKey}: ${issue.title}. Status ${STATUS_META[issue.status].label}`}
      data-testid={`issue-card-${issue.id}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5">
          {dragDisabled ? (
            <span className="rounded p-0.5 text-slate-200" aria-hidden="true">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          ) : (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
              aria-label={`Drag ${issue.issueKey} to change its status`}
              title="Drag to change status (keyboard: Space, arrows, Space)"
              {...attributes}
              onKeyDown={onKeyDown}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <Link
            to={`/projects/${issue.projectId}/issues/${issue.id}`}
            className="rounded bg-slate-100/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
          >
            {issue.issueKey}
          </Link>
          <IssueTypeBadge type={issue.type} className="scale-95" />
        </div>

        <Menu
          label={`Actions for ${issue.issueKey}`}
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              className="rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
              aria-label={`Open actions for ${issue.issueKey}`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          items={[
            ...(canEdit && onMove
              ? STATUS_ORDER.filter((status) => status !== issue.status).map((status) => ({
                  label: `Move to ${STATUS_META[status].label}`,
                  onSelect: () => onMove(issue, status),
                }))
              : []),
            ...(canEdit && onEdit ? [{ label: 'Edit issue', onSelect: () => onEdit(issue) }] : []),
            ...(canDelete && onDelete
              ? [{ label: 'Delete issue', destructive: true, onSelect: () => onDelete(issue) }]
              : []),
          ]}
        />
      </div>

      <Link to={`/projects/${issue.projectId}/issues/${issue.id}`} className="mt-1.5 block">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 transition hover:text-brand-700">
          {issue.title}
        </h3>
      </Link>

      {issue.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <LabelChip key={label} label={label} />
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[11px] text-slate-600">+{issue.labels.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={issue.priority} />
          {issue.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border transition-colors',
                overdue
                  ? 'border-rose-200 bg-rose-50 text-rose-700 font-semibold'
                  : 'border-slate-200/70 bg-slate-50 text-slate-600',
              )}
              title={`Due ${formatDate(issue.dueDate)}${overdue ? ' · overdue' : ''}`}
            >
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {overdue ? 'Overdue' : formatDate(issue.dueDate)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-slate-600" title="Comments">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {issue.commentCount ?? 0}
          </span>
          {issue.attachments.length > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] text-slate-600"
              title="Attachments"
            >
              <Paperclip className="h-3 w-3" aria-hidden="true" />
              {issue.attachments.length}
            </span>
          )}
          {issue.assignee ? (
            <Avatar
              name={issue.assignee.name}
              email={issue.assignee.email}
              src={issue.assignee.avatarUrl}
              size="sm"
            />
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-600"
              title="Unassigned"
            >
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Unassigned</span>
            </span>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-[10px] text-slate-600">Updated {relativeTime(issue.updatedAt)}</p>
    </article>
  );
}
