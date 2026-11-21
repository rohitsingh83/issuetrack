import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, KanbanSquare, Radio, ShieldCheck } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: KanbanSquare,
    title: 'Kanban that keeps up',
    description: 'Drag issues between To Do, In Progress and Done with instant optimistic updates.',
  },
  {
    icon: Radio,
    title: 'Real-time by default',
    description: 'Comments, moves and edits broadcast to every teammate the moment they happen.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-aware access',
    description: 'Owner, admin, member and viewer roles enforced in the API — not just the UI.',
  },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />

        <Link to="/" className="relative inline-flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M6 7h12M6 12h8M6 17h4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="18" cy="17" r="2.6" fill="#a5b4fc" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Issue<span className="text-brand-300">Track</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Designed for Modern Agile Teams
          </div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Ship fewer bugs. Fix them faster.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            A focused issue tracker built for high-performing engineering teams: project workspaces,
            interactive Kanban boards, threaded discussions, and a full audit trail.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3 rounded-lg p-2 transition hover:bg-white/5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/30 border border-brand-400/20 text-brand-300 shadow-sm">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/70">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/70 border-t border-white/10 pt-4">
          <p className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            React · Node.js · MongoDB · Socket.io
          </p>
          <span className="font-mono text-[11px] text-white/50">v1.0.0</span>
        </div>
      </div>

      <div className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-canvas to-indigo-50/30 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M6 7h12M6 12h8M6 17h4"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="18" cy="17" r="2.6" fill="#a5b4fc" />
              </svg>
            </span>
            <span className="text-base font-semibold text-ink">IssueTrack</span>
          </div>

          <div className="surface-card rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-raised backdrop-blur-sm sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>

          <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}
