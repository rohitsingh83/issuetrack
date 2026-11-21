import { Link } from 'react-router-dom';
import { CalendarClock, MessageSquare, Paperclip } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { IssueTypeBadge, LabelChip, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { cn, formatDate, isOverdue, relativeTime } from '@/lib/utils';
import type { Issue } from '@/types';

export function IssueTable({ issues, projectKey }: issuesProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <caption className="sr-only">Issues</caption>
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-600">
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Key
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Title
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Priority
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">
                Type
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">
                Labels
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold sm:table-cell">
                Assignee
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold md:table-cell">
                Due
              </th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-semibold lg:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issues.map((issue) => {
              const overdue = isOverdue(issue.dueDate, issue.status);
              return (
                <tr key={issue.id} className="group transition hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link
                      to={`/projects/${issue.projectId}/issues/${issue.id}`}
                      className="font-mono text-xs font-medium text-slate-600 group-hover:text-brand-700"
                    >
                      {issue.issueKey}
                    </Link>
                  </td>
                  <td className="max-w-[380px] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <IssueTypeBadge type={issue.type} className="lg:hidden" />
                      <Link
                        to={`/projects/${issue.projectId}/issues/${issue.id}`}
                        className="line-clamp-1 text-sm font-medium text-slate-800 group-hover:text-brand-700"
                      >
                        {issue.title}
                      </Link>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                      <span>{issue.reporter?.name ?? 'Unknown reporter'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{projectKey ?? issue.projectKey ?? ''}</span>
                      {(issue.commentCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" aria-hidden="true" />
                          {issue.commentCount}
                        </span>
                      )}
                      {issue.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" aria-hidden="true" />
                          {issue.attachments.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <StatusBadge status={issue.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <PriorityBadge priority={issue.priority} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 lg:table-cell">
                    <IssueTypeBadge type={issue.type} />
                  </td>
                  <td className="hidden px-3 py-2.5 xl:table-cell">
                    <div className="flex max-w-[160px] flex-wrap gap-1">
                      {issue.labels.slice(0, 2).map((label) => (
                        <LabelChip key={label} label={label} />
                      ))}
                      {issue.labels.length > 2 && (
                        <span className="text-[11px] text-slate-600">
                          +{issue.labels.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">
                    {issue.assignee ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar
                          name={issue.assignee.name}
                          email={issue.assignee.email}
                          src={issue.assignee.avatarUrl}
                          size="xs"
                        />
                        <span className="text-xs text-slate-600">{issue.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">Unassigned</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 md:table-cell">
                    {issue.dueDate ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          overdue ? 'font-medium text-rose-600' : 'text-slate-600',
                        )}
                      >
                        <CalendarClock className="h-3 w-3" aria-hidden="true" />
                        {formatDate(issue.dueDate)}
                        {overdue && <span className="sr-only">(overdue)</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-right lg:table-cell">
                    <span className="text-xs text-slate-600">{relativeTime(issue.updatedAt)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface issuesProps {
  issues: Issue[];
  projectKey?: string;
}
