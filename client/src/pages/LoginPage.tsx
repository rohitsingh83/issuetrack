import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/FormControls';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import { ApiError } from '@/lib/api';

const DEMO_PERSONAS = [
  {
    name: 'Avery Chen',
    role: 'Owner',
    email: 'owner@demo.dev',
    avatarBg: 'bg-indigo-600',
    initials: 'AC',
    badge: 'Product Lead',
  },
  {
    name: 'Priya Patel',
    role: 'Admin',
    email: 'admin@demo.dev',
    avatarBg: 'bg-emerald-600',
    initials: 'PP',
    badge: 'Tech Lead',
  },
  {
    name: 'Marcus Johnson',
    role: 'Member',
    email: 'member@demo.dev',
    avatarBg: 'bg-amber-600',
    initials: 'MJ',
    badge: 'Developer',
  },
  {
    name: 'Sofia Rossi',
    role: 'Viewer',
    email: 'viewer@demo.dev',
    avatarBg: 'bg-purple-600',
    initials: 'SR',
    badge: 'Stakeholder',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activePersonaEmail, setActivePersonaEmail] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const handleSelectPersona = (email: string) => {
    setActivePersonaEmail(email);
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123!', { shouldValidate: true });
    setFormError(null);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate(from, { replace: true });
    } catch (error) {
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
    }
  });

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
      <div className="space-y-4">
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

        <FormField
          label="Email address"
          htmlFor="login-email"
          required
          error={errors.email?.message}
        >
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

        <FormField
          label="Password"
          htmlFor="login-password"
          required
          error={errors.password?.message}
        >
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

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} className="shadow-md hover:shadow-lg transition-all duration-150">
          Sign in
        </Button>

        <div className="pt-2">
          <div className="flex items-center justify-between pb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
              1-Click Demo Personas
            </span>
            <span className="text-[11px] text-slate-400">Click to autofill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_PERSONAS.map((persona) => {
              const isSelected = activePersonaEmail === persona.email;
              return (
                <button
                  key={persona.email}
                  type="button"
                  onClick={() => handleSelectPersona(persona.email)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-1 ring-brand-500'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${persona.avatarBg}`}
                  >
                    {persona.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{persona.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{persona.badge}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Demo accounts (development only)</p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
            <li>owner@demo.dev · admin@demo.dev</li>
            <li>member@demo.dev · viewer@demo.dev</li>
            <li className="text-slate-600">password: Password123!</li>
          </ul>
          <p className="mt-1 text-[11px] text-slate-500">
            Run <code className="rounded bg-white px-1">npm run seed</code> in <code>/server</code>.
          </p>
        </div>
      </form>
    </div>
  </AuthLayout>
  );
}
