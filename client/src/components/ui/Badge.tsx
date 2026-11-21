import type { ReactNode } from 'react';
import { ISSUE_TYPE_META, PRIORITY_META, STATUS_META } from '@/lib/constants';
import { cn, ROLE_LABEL } from '@/lib/utils';
import type { IssuePriority, IssueStatus, IssueType, ProjectRole } from '@/types';

export function Badge({
  children,
  className,
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.todo;
  const Icon = meta.icon;
  return (
    <Badge
      className={cn(meta.badge, className)}
      icon={<Icon className="h-3 w-3" aria-hidden="true" />}
    >
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
  showLabel = true,
}: {
  priority: IssuePriority;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  const Icon = meta.icon;
  return (
    <Badge
      className={cn(meta.badge, className)}
      icon={<Icon className="h-3 w-3" aria-hidden="true" />}
    >
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </Badge>
  );
}

export function IssueTypeBadge({ type, className }: { type: IssueType; className?: string }) {
  const meta = ISSUE_TYPE_META[type] ?? ISSUE_TYPE_META.bug;
  const Icon = meta.icon;
  return (
    <Badge
      className={cn(meta.className, className)}
      icon={<Icon className="h-3 w-3" aria-hidden="true" />}
    >
      {meta.label}
    </Badge>
  );
}

export function RoleBadge({ role, className }: { role: ProjectRole; className?: string }) {
  const styles: Record<ProjectRole, string> = {
    owner: 'bg-brand-50 text-brand-700 ring-brand-200',
    admin: 'bg-violet-50 text-violet-700 ring-violet-200',
    member: 'bg-slate-100 text-slate-700 ring-slate-200',
    viewer: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
  return <Badge className={cn(styles[role], 'capitalize', className)}>{ROLE_LABEL[role]}</Badge>;
}

export function LabelChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600',
        className,
      )}
    >
      {label}
    </span>
  );
}
