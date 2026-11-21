import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, FolderKanban, Plus, Settings2, Users } from 'lucide-react';
import { AvatarGroup } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { useProjects } from '@/hooks/useProjects';
import { relativeTime } from '@/lib/utils';

export function ProjectsPage() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setModalOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Projects</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Every project is a workspace with its own board, issue keys and team.
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          New project
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load projects"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : !projects?.length ? (
        <EmptyState
          title="Create your first project"
          description="Projects keep related issues together. Start with something like “Web App” or “Mobile”."
          icon={<FolderKanban className="h-6 w-6" aria-hidden="true" />}
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
              New project
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const done = project.doneCount ?? 0;
            const total = project.issueCount ?? 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <li
                key={project.id}
                className="surface-card group flex flex-col p-5 transition-all duration-200 hover:border-brand-300 hover:shadow-raised hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                      {project.key.slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-ink group-hover:text-brand-700 transition-colors">{project.name}</h2>
                      <p className="font-mono text-[11px] text-slate-500">{project.key}</p>
                    </div>
                  </div>
                  {project.role && <RoleBadge role={project.role} />}
                </div>

                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-600">
                  {project.description || 'No description yet.'}
                </p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      {done}/{total} done
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progress}%` }}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${progress}% of issues done`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AvatarGroup
                      users={project.members.map((m) => ({
                        name: m.name,
                        email: m.email,
                        avatarUrl: m.avatarUrl,
                      }))}
                      max={3}
                      size="xs"
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {project.memberCount}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600">
                    {relativeTime(project.updatedAt)}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <Link
                    to={`/projects/${project.id}/board`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                  >
                    Open board
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    to={`/projects/${project.id}/issues`}
                    className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                  >
                    Issues
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/settings`)}
                    className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Settings for ${project.name}`}
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectFormModal
        open={modalOpen}
        mode="create"
        onClose={() => setModalOpen(false)}
        onCreated={(project) => navigate(`/projects/${project.id}/board`)}
      />
    </div>
  );
}
