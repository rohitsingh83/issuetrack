import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-600">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">404</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-600">
        The page you are looking for has been moved, deleted, or never existed.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
