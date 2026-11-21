import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  FolderKanban,
  Loader2,
  Plus,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { AvatarGroup } from '@/components/ui/Avatar';
import { PriorityBadge, RoleBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, EmptyState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { ActivityList } from '@/components/issues/ActivityTimeline';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { PRIORITY_META, PRIORITY_ORDER } from '@/lib/constants';
import { cn, formatDate, isOverdue, pluralize, relativeTime } from '@/lib/utils';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  to,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof FolderKanban;
  tone?: 'brand' | 'amber' | 'emerald' | 'rose';
  to?: string;
}) {
  const tones = {
    brand: {
      border: 'border-indigo-100 hover:border-indigo-300',
      iconBg: 'bg-indigo-600 text-white shadow-sm shadow-indigo-300',
      badge: 'bg-indigo-50 text-indigo-700',
    },
    amber: {
      border: 'border-amber-100 hover:border-amber-300',
      iconBg: 'bg-amber-500 text-white shadow-sm shadow-amber-300',
      badge: 'bg-amber-50 text-amber-700',
    },
    emerald: {
      border: 'border-emerald-100 hover:border-emerald-300',
      iconBg: 'bg-emerald-600 text-white shadow-sm shadow-emerald-300',
      badge: 'bg-emerald-50 text-emerald-700',
    },
    rose: {
      border: 'border-rose-100 hover:border-rose-300',
      iconBg: 'bg-rose-500 text-white shadow-sm shadow-rose-300',
      badge: 'bg-rose-50 text-rose-700',
    },
  } as const;

  const currentTone = tones[tone];

  const content = (
    <div
      className={cn(
        'surface-card group relative flex items-start justify-between gap-3 p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-raised',
        currentTone.border,
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          currentTone.iconBg,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );

  return to ? (
    <Link to={to} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500">
      {content}
    </Link>
  ) : (
    content
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDashboard();

  if (isLoading) return <PageLoader label="Loading your workspace…" />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        message={error instanceof Error ? error.message : 'Please try again.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const { stats, myIssues, recentActivity, projects } = data;
  const firstName = user?.name.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const timeEmoji = hour < 12 ? '☀️' : hour < 18 ? '☕' : '🌙';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/70 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
            <span>Productivity Dashboard</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {timeGreeting}, {firstName} {timeEmoji}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {stats.openIssues > 0
              ? `You have ${pluralize(stats.openIssues, 'open issue')} across ${pluralize(stats.projectCount, 'project')} in motion.`
              : 'All caught up — no open issues pending right now.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
          <Link
            to="/projects?new=1"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New project
          </Link>
        </div>
      </header>

      <section aria-label="Workspace metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assigned to me"
          value={stats.assignedToMe}
          hint="Open issues assigned to you"
          icon={UserCheck}
          to="/issues?assignee=me"
        />
        <StatCard
          label="Reported by me"
          value={stats.reportedByMe}
          hint="Open issues you created"
          icon={CircleDot}
          tone="amber"
          to="/issues?reporter=me"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint="Past due and not done"
          icon={AlertTriangle}
          tone="rose"
        />
        <StatCard
          label="Completed"
          value={stats.doneIssues}
          hint={`${stats.totalIssues} issues total`}
          icon={CheckCircle2}
          tone="emerald"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section aria-labelledby="my-issues-heading" className="surface-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 id="my-issues-heading" className="text-sm font-semibold text-slate-800">
                My open issues
              </h2>
              <Link
                to="/issues?assignee=me"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                View all
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {myIssues.length === 0 ? (
              <EmptyState
                title="Nothing assigned to you"
                description="When a teammate assigns you an issue it will show up right here."
                icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {myIssues.map((issue) => (
                  <li key={issue.id}>
                    <Link
                      to={`/projects/${issue.projectId}/issues/${issue.id}`}
                      className="flex flex-wrap items-center gap-2 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <span className="font-mono text-[11px] font-medium text-slate-600">
                        {issue.issueKey}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {issue.title}
                      </span>
                      <PriorityBadge priority={issue.priority} />
                      <StatusBadge status={issue.status} />
                      {issue.dueDate && (
                        <span
                          className={cn(
                            'text-[11px]',
                            isOverdue(issue.dueDate, issue.status)
                              ? 'font-medium text-rose-600'
                              : 'text-slate-600',
                          )}
                        >
                          {isOverdue(issue.dueDate, issue.status)
                            ? 'Overdue'
                            : formatDate(issue.dueDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="projects-heading" className="surface-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 id="projects-heading" className="text-sm font-semibold text-slate-800">
                Projects
              </h2>
              <Link
                to="/projects"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                Manage
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to start tracking issues."
                icon={<FolderKanban className="h-5 w-5" aria-hidden="true" />}
                action={
                  <Link
                    to="/projects?new=1"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-medium text-white"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New project
                  </Link>
                }
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <ul className="grid gap-3.5 p-4 sm:grid-cols-2">
                {projects.slice(0, 4).map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/projects/${project.id}/board`}
                      className="group flex h-full flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 transition-all duration-200 hover:border-brand-400 hover:shadow-raised hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                          {project.key.slice(0, 3)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                            {project.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {project.issueCount ?? 0} {project.issueCount === 1 ? 'issue' : 'issues'} tracked
                          </p>
                        </div>
                        {project.role && <RoleBadge role={project.role} />}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <AvatarGroup
                          users={project.members.map((m) => ({
                            name: m.name,
                            email: m.email,
                            avatarUrl: m.avatarUrl,
                          }))}
                          max={3}
                          size="xs"
                        />
                        <span className="text-[11px] font-medium text-slate-500">
                          Updated {relativeTime(project.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section aria-labelledby="priority-heading" className="surface-card p-4">
            <h2 id="priority-heading" className="text-sm font-semibold text-slate-800">
              Open by priority
            </h2>
            <ul className="mt-3 space-y-2">
              {PRIORITY_ORDER.map((priority) => {
                const total = stats.totalIssues || 1;
                const count = stats.byPriority[priority] ?? 0;
                const percent = Math.round((count / total) * 100);
                return (
                  <li key={priority} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-slate-600">
                      {PRIORITY_META[priority].label}
                    </span>
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                      role="img"
                      aria-label={`${PRIORITY_META[priority].label}: ${count} issues`}
                    >
                      <div
                        className={cn('h-full rounded-full', PRIORITY_META[priority].dot)}
                        style={{ width: `${Math.max(percent, count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-medium tabular-nums text-slate-600">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
              By status
            </h3>
            <ul className="mt-2 space-y-1.5">
              {(['todo', 'in-progress', 'done'] as const).map((status) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <StatusBadge status={status} />
                  <span className="font-medium tabular-nums text-slate-600">
                    {stats.byStatus[status] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="activity-heading" className="surface-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="activity-heading" className="text-sm font-semibold text-slate-800">
                Recent activity
              </h2>
              <Loader2
                className="hidden h-3.5 w-3.5 animate-spin text-slate-300"
                aria-hidden="true"
              />
            </div>
            <ActivityList items={recentActivity} />
          </section>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
