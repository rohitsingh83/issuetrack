import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ClerkSignIn } from '@/components/auth/ClerkSignIn';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/FormControls';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const DEMO_PASSWORD = 'Password123!';

const DEMO_PERSONAS = [
  { name: 'Avery Chen', role: 'Owner', email: 'owner@demo.dev', avatarBg: 'bg-indigo-600', initials: 'AC' },
  { name: 'Priya Nair', role: 'Admin', email: 'admin@demo.dev', avatarBg: 'bg-emerald-600', initials: 'PN' },
  { name: 'Marcus Webb', role: 'Member', email: 'member@demo.dev', avatarBg: 'bg-amber-600', initials: 'MW' },
  { name: 'Sofia Ruiz', role: 'Viewer', email: 'viewer@demo.dev', avatarBg: 'bg-purple-600', initials: 'SR' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [personaLoading, setPersonaLoading] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const reportError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.details) {
        Object.entries(error.details).forEach(([field, messages]) => {
          if (field === 'email' || field === 'password') {
            setError(field, { message: messages[0] });
          }
        });
      }
      setFormError(error.message);
    } else {
      setFormError('Unable to sign in. Please try again.');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate(from, { replace: true });
    } catch (error) {
      reportError(error);
    }
  });

  const signInAsPersona = async (email: string) => {
    setFormError(null);
    setPersonaLoading(email);
    try {
      await login({ email, password: DEMO_PASSWORD });
      navigate(from, { replace: true });
    } catch (error) {
      reportError(error);
      setPersonaLoading(null);
    }
  };

  return (
    <AuthLayout
      title="Sign in to IssueTrack"
      subtitle="Welcome back — pick up where your team left off."
      footer={
        <>
          New to IssueTrack?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <ClerkSignIn />

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </FormField>

          <FormField label="Password" htmlFor="login-password" required error={errors.password?.message}>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                invalid={Boolean(errors.password)}
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isSubmitting}
            className="shadow-md transition-all duration-150 hover:shadow-lg"
          >
            Sign in
          </Button>
        </form>

        <section aria-labelledby="demo-heading" className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between pb-2">
            <h2
              id="demo-heading"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
              Try a demo account
            </h2>
            <span className="text-[11px] text-slate-500">One click, no typing</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_PERSONAS.map((persona) => {
              const loading = personaLoading === persona.email;
              return (
                <button
                  key={persona.email}
                  type="button"
                  onClick={() => void signInAsPersona(persona.email)}
                  disabled={personaLoading !== null}
                  aria-label={`Sign in as ${persona.name}, ${persona.role}`}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition',
                    'hover:border-brand-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    loading && 'border-brand-400 ring-1 ring-brand-400',
                  )}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${persona.avatarBg}`}
                  >
                    {persona.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">{persona.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{persona.role}</span>
                  </span>
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" aria-hidden="true" />
                  ) : (
                    <ArrowRight
                      className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </AuthLayout>
  );
}
