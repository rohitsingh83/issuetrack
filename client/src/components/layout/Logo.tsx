import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  to = '/',
  compact = false,
}: {
  className?: string;
  to?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)}
      aria-label="IssueTrack home"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M6 7h12M6 12h8M6 17h4" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="17" r="2.6" fill="#a5b4fc" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Issue<span className="text-brand-300">Track</span>
        </span>
      )}
    </Link>
  );
}
