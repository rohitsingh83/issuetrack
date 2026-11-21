import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { AlertTriangle, Columns3, ListTodo, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AvatarGroup } from '@/components/ui/Avatar';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { RoleBadge } from '@/components/ui/Badge';
import { useProject } from '@/hooks/useProjects';
import { ProjectProvider, useProjectContext } from '@/context/ProjectContext';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/types';

const TABS = [
  { to: 'board', label: 'Board', icon: Columns3 },
  { to: 'issues', label: 'Issues', icon: ListTodo },
  { to: 'settings', label: 'Settings', icon: Settings2 },
];

/** Shared project chrome: header, stats, member avatars and tab navigation. */
export function ProjectLayout() {
  const { projectId } = useParams();
  const { data: project, isLoading, isError, error, refetch } = useProject(projectId);

  if (isLoading) return <PageLoader label="Loading project…" />;

  if (isError || !project) {
    return (
      <ErrorState
        title="Project unavailable"
        message={
          error instanceof Error
            ? error.message
            : 'This project may not exist, or you may not be a member of it.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const role: ProjectRole = project.role ?? 'viewer';

  return (
    <ProjectProvider project={project} role={role}>
      <div className="space-y-5">
        <header className="surface-card overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
                  {project.key.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-semibold text-ink sm:text-xl">
                      {project.name}
                    </h1>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                      {project.key}
                    </span>
                    <RoleBadge role={role} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-slate-600">
                    {project.description || 'No description yet.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="settings"
                  className="hidden items-center gap-2 rounded-lg px-1 sm:flex"
                  aria-label="View project members"
                >
                  <AvatarGroup
                    users={project.members.map((m) => ({
                      name: m.name,
                      email: m.email,
                      avatarUrl: m.avatarUrl,
                    }))}
                    max={4}
                    size="sm"
                  />
                  <span className="text-xs text-slate-600">
                    {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </Link>
                {role !== 'viewer' && <NewIssueButton />}
              </div>
            </div>

            <nav aria-label="Project sections" className="-mb-1 flex gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
                    )
                  }
                >
                  <tab.icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        {role === 'viewer' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              You have <strong>viewer</strong> access to this project. You can browse issues but not
              create, edit or comment.
            </p>
          </div>
        )}

        <Outlet />
      </div>
    </ProjectProvider>
  );
}

function NewIssueButton() {
  const { openCreateIssue } = useProjectContext();
  return (
    <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateIssue}>
      New issue
    </Button>
  );
}
