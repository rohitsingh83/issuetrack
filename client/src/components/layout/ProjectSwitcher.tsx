import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronsUpDown, FolderKanban, Plus } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Feedback';

/** Dropdown that lets users jump between projects from anywhere in the app. */
export function ProjectSwitcher({ onCreateProject }: { onCreateProject?: () => void }) {
  const { data: projects, isLoading } = useProjects();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const current = projects?.find((p) => p.id === projectId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left text-sm text-white/90 transition',
          'hover:border-white/20 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-300',
        )}
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
        {isLoading ? (
          <Skeleton className="h-3.5 w-24 bg-white/20" />
        ) : (
          <span className="flex-1 truncate font-medium">
            {current ? current.name : 'Select project'}
          </span>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            aria-label="Projects"
            className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop animate-slide-up"
          >
            {projects && projects.length > 0 ? (
              projects.map((project) => (
                <button
                  key={project.id}
                  role="option"
                  aria-selected={project.id === projectId}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/projects/${project.id}/board`);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-[10px] font-bold text-brand-700">
                    {project.key.slice(0, 3)}
                  </span>
                  <span className="flex-1 truncate">{project.name}</span>
                  {project.id === projectId && (
                    <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  )}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-slate-600">No projects yet</p>
            )}
            {onCreateProject && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateProject();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-100 px-2.5 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New project
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
