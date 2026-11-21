import { useEffect, useRef, useState } from 'react';
import { SignInButton, useAuth as useClerkAuth, useClerk } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { isClerkConfigured } from '@/lib/clerk';
import { useAuth } from '@/hooks/useAuth';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.1V7H2.1a11 11 0 0 0 0 9.9L5.8 14Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-slate-900" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

/**
 * "Continue with Google / GitHub" via Clerk.
 *
 * Clerk handles the OAuth / email-code flow in its modal. Once Clerk reports a
 * signed-in user we send the short-lived Clerk *session token* (never an email)
 * to `/api/auth/clerk`; the API verifies it with Clerk and issues our own JWT
 * cookie. We then sign out of Clerk so the app has a single source of truth for
 * the session and "Log out" really logs out.
 */
function ClerkSignInInner({ label }: { label: string }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const clerk = useClerk();
  const { loginWithClerk } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const exchanging = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || exchanging.current) return;
    exchanging.current = true;
    setBusy(true);
    setError(null);

    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Clerk did not return a session token');
        await loginWithClerk(token);
        await clerk.signOut().catch(() => undefined);
        navigate(from, { replace: true });
      } catch (err) {
        await clerk.signOut().catch(() => undefined);
        setError(
          err instanceof ApiError ? err.message : 'Could not complete sign-in. Please try again.',
        );
        exchanging.current = false;
        setBusy(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, loginWithClerk, clerk, navigate, from]);

  const disabled = !isLoaded || busy;

  return (
    <div className="space-y-2">
      <SignInButton mode="modal">
        <button
          type="button"
          disabled={disabled}
          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
          ) : (
            <span className="flex items-center gap-1.5">
              <GoogleMark />
              <GitHubMark />
            </span>
          )}
          <span>{busy ? 'Signing you in…' : label}</span>
        </button>
      </SignInButton>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Renders the Clerk button plus an "or" divider — only when both client and API have Clerk keys. */
export function ClerkSignIn({ label = 'Continue with Google or GitHub' }: { label?: string }) {
  const { data } = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: async () => (await api.auth.providers()).data,
    enabled: isClerkConfigured,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!isClerkConfigured || !data?.clerk) return null;

  return (
    <div className="space-y-4">
      <ClerkSignInInner label={label} />
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          or with email
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
