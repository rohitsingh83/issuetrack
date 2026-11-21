import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Menu as MenuIcon,
  Plus,
  Radio,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { ProjectSwitcher } from './ProjectSwitcher';
import { ProfileMenu, ProfileSummary } from './ProfileMenu';
import { Button } from '@/components/ui/Button';
import { useProjects } from '@/hooks/useProjects';
import { useRealtime } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';

function RealtimeIndicator() {
  const { status } = useRealtime();
  // Realtime is intentionally off on serverless hosting — don't show "offline".
  if (import.meta.env.VITE_REALTIME === 'off') return null;
  const config = {
    connected: {
      label: 'Live',
      className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    },
    connecting: {
      label: 'Connecting',
      className: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    },
    disconnected: {
      label: 'Offline',
      className: 'bg-slate-500/20 text-slate-300 ring-slate-400/30',
    },
  }[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset',
        config.className,
      )}
      role="status"
      aria-live="polite"
      title={`Real-time updates: ${config.label.toLowerCase()}`}
    >
      <Radio className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: true },
  { to: '/issues', label: 'All issues', icon: ListTodo, end: true },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: projects } = useProjects();
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 py-4">
        <Logo to="/" />
      </div>

      <div className="px-3">
        <ProjectSwitcher onCreateProject={() => navigate('/projects?new=1')} />
      </div>

      <nav
        aria-label="Main navigation"
        className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-thin"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-gradient-to-r from-brand-600/25 to-brand-700/10 text-white shadow-sm ring-1 ring-inset ring-brand-500/30'
                  : 'text-white/60 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}

        <div className="pt-4">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Projects
            </p>
            <Link
              to="/projects?new=1"
              onClick={onNavigate}
              className="rounded p-0.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Create a project"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-0.5">
            {projects?.map((project) => (
              <li key={project.id}>
                <NavLink
                  to={`/projects/${project.id}/board`}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition',
                    projectId === project.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/55 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[9px] font-bold text-brand-200">
                    {project.key.slice(0, 3)}
                  </span>
                  <span className="truncate">{project.name}</span>
                </NavLink>
              </li>
            ))}
            {projects?.length === 0 && (
              <li className="px-2.5 py-1.5 text-xs text-white/70">No projects yet</li>
            )}
          </ul>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <RealtimeIndicator />
        </div>
        <ProfileSummary />
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const { projectId, issueId } = useParams();
  const { data: projects } = useProjects();
  const project = projects?.find((p) => p.id === projectId);
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const label = segments.includes('board')
    ? 'Board'
    : segments.includes('issues') && issueId
      ? 'Issue details'
      : segments.includes('issues')
        ? 'Issues'
        : segments.includes('settings')
          ? 'Settings'
          : null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        <li>
          <Link to="/" className="text-slate-600 transition hover:text-slate-900">
            Home
          </Link>
        </li>
        {project && (
          <>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </li>
            <li className="min-w-0">
              <Link
                to={`/projects/${project.id}/board`}
                className="truncate font-medium text-slate-700 transition hover:text-brand-700"
              >
                {project.name}
              </Link>
            </li>
          </>
        )}
        {label && (
          <>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </li>
            <li aria-current="page" className="text-slate-600">
              {label}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-full min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-64">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full w-72 max-w-[85vw] animate-slide-in-right shadow-pop">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute -right-11 top-3 rounded-lg bg-white/10 p-2 text-white backdrop-blur"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md transition-all sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-3">
            <RealtimeIndicator />
            <div className="h-4 w-px bg-slate-200" aria-hidden="true" />
            <ProfileMenu />
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
