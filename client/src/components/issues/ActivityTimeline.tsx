import {
  ArrowRightLeft,
  CalendarClock,
  CircleDot,
  History,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { useIssueActivity } from '@/hooks/useIssueDetail';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { ActivityItem } from '@/types';

const ACTION_ICON: Record<string, typeof Plus> = {
  'project.created': Plus,
  'project.updated': Pencil,
  'project.member.added': UserPlus,
  'project.member.removed': Users,
  'project.member.role_changed': ShieldCheck,
  'issue.created': CircleDot,
  'issue.updated': Pencil,
  'issue.status_changed': ArrowRightLeft,
  'issue.assigned': UserPlus,
  'issue.unassigned': UserPlus,
  'issue.priority_changed': CalendarClock,
  'issue.deleted': Trash2,
  'comment.added': MessageSquare,
  'comment.updated': Pencil,
  'comment.deleted': Trash2,
  'attachment.added': Paperclip,
  'attachment.deleted': Trash2,
};

export function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ACTION_ICON[item.action] ?? CircleDot;
  return (
    <li className="flex gap-2.5">
      <div className="relative flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>
      <div className="min-w-0 pb-3">
        <p className="text-sm leading-snug text-slate-700">
          <span className="font-medium text-slate-900">{item.actor?.name ?? 'Someone'}</span>{' '}
          {item.message}
        </p>
        <time
          dateTime={item.createdAt}
          title={formatDateTime(item.createdAt)}
          className="text-[11px] text-slate-600"
        >
          {relativeTime(item.createdAt)}
        </time>
      </div>
    </li>
  );
}

/** Issue activity/audit log. */
export function IssueActivityTimeline({ issueId }: { issueId: string }) {
  const { data: activity, isLoading } = useIssueActivity(issueId);

  return (
    <section aria-labelledby="activity-heading" className="surface-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-600" aria-hidden="true" />
        <h2 id="activity-heading" className="text-sm font-semibold text-slate-800">
          Activity
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : activity && activity.length > 0 ? (
        <ol className="space-y-0">
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No activity yet"
          description="Changes to this issue will appear here."
          icon={<History className="h-5 w-5" aria-hidden="true" />}
          className="border-0 bg-transparent py-6"
        />
      )}
    </section>
  );
}

/** Compact activity list reused on the dashboard and project settings page. */
export function ActivityList({
  items,
  isLoading,
}: {
  items?: ActivityItem[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No recent activity"
        description="Create or update an issue to see the timeline fill up."
        icon={<History className="h-5 w-5" aria-hidden="true" />}
        className="border-0 bg-transparent py-8"
      />
    );
  }
  return (
    <ol className="space-y-0">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5 pb-3">
          <Avatar
            name={item.actor?.name}
            email={item.actor?.email}
            src={item.actor?.avatarUrl ?? null}
            size="xs"
          />
          <div className="min-w-0">
            <p className="text-sm leading-snug text-slate-700">
              <span className="font-medium text-slate-900">{item.actor?.name ?? 'Someone'}</span>{' '}
              {item.message}
            </p>
            <p className="text-[11px] text-slate-600">
              {item.projectName && item.projectName}
              {item.projectName && item.issueKey ? ' · ' : ''}
              {item.issueKey}
              {item.issueKey ? ' · ' : ''}
              {relativeTime(item.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
