import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ClerkSignIn } from '@/components/auth/ClerkSignIn';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/FormControls';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterValues } from '@/lib/schemas';
import { ApiError } from '@/lib/api';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) {
          Object.entries(error.details).forEach(([field, messages]) => {
            if (field === 'name' || field === 'email' || field === 'password') {
              setError(field, { message: messages[0] });
            }
          });
        }
        setFormError(error.message);
      } else {
        setFormError('Unable to create your account. Please try again.');
      }
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking issues with your team in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-4">
        <ClerkSignIn label="Sign up with Google or GitHub" />
      </div>
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

        <FormField label="Full name" htmlFor="register-name" required error={errors.name?.message}>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            icon={<User className="h-4 w-4" />}
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </FormField>

        <FormField
          label="Email address"
          htmlFor="register-email"
          required
          error={errors.email?.message}
        >
          <Input
            id="register-email"
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
          htmlFor="register-password"
          required
          error={errors.password?.message}
          hint="At least 8 characters, including a letter and a number."
        >
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="register-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="register-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create account
        </Button>

        <p className="text-center text-xs text-slate-600">
          By continuing you agree to keep your team’s issues moving. No credit card required.
        </p>
      </form>
    </AuthLayout>
  );
}
