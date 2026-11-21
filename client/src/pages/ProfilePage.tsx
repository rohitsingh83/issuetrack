import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail, Save, ShieldCheck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/FormControls';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import {
  passwordFormSchema,
  profileFormSchema,
  type PasswordFormValues,
  type ProfileFormValues,
} from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: user?.name ?? '', avatarUrl: user?.avatarUrl ?? '' },
    mode: 'onTouched',
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name, avatarUrl: user.avatarUrl ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onProfileSubmit = profileForm.handleSubmit(async (values) => {
    setProfileError(null);
    try {
      const { data } = await api.users.updateProfile({
        name: values.name.trim(),
        avatarUrl: values.avatarUrl?.trim() || null,
      });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not update your profile');
    }
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    try {
      await api.users.updateProfile({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      if (error instanceof ApiError && error.details?.currentPassword) {
        passwordForm.setError('currentPassword', { message: error.details.currentPassword[0] });
      }
      setPasswordError(
        error instanceof ApiError ? error.message : 'Could not change your password',
      );
    }
  });

  const avatarPreview = profileForm.watch('avatarUrl');
  const namePreview = profileForm.watch('name');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Profile</h1>
        <p className="mt-0.5 text-sm text-slate-600">Manage your account details and password.</p>
      </header>

      <section aria-labelledby="account-heading" className="surface-card p-4 sm:p-5">
        <div className="mb-5 flex items-center gap-3">
          <Avatar
            name={namePreview || user?.name}
            email={user?.email}
            src={avatarPreview || user?.avatarUrl}
            size="xl"
          />
          <div>
            <h2 id="account-heading" className="text-sm font-semibold text-slate-800">
              {user?.name}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <Mail className="h-3 w-3" aria-hidden="true" />
              {user?.email}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-600">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Member since {formatDate(user ? new Date().toISOString() : null)}
            </p>
          </div>
        </div>

        <form onSubmit={onProfileSubmit} className="space-y-4" noValidate>
          {profileError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {profileError}
            </div>
          )}

          <FormField
            label="Full name"
            htmlFor="profile-name"
            required
            error={profileForm.formState.errors.name?.message}
          >
            <Input
              id="profile-name"
              icon={<UserIcon className="h-4 w-4" />}
              invalid={Boolean(profileForm.formState.errors.name)}
              {...profileForm.register('name')}
            />
          </FormField>

          <FormField
            label="Avatar URL"
            htmlFor="profile-avatar"
            optional
            hint="Paste a link to an image. Initials are used when empty."
            error={profileForm.formState.errors.avatarUrl?.message}
          >
            <Input
              id="profile-avatar"
              type="url"
              placeholder="https://example.com/avatar.png"
              {...profileForm.register('avatarUrl')}
            />
          </FormField>

          <FormField
            label="Email address"
            htmlFor="profile-email"
            hint="Email changes are not supported yet."
          >
            <Input id="profile-email" value={user?.email ?? ''} readOnly disabled />
          </FormField>

          <Button
            type="submit"
            loading={profileForm.formState.isSubmitting}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save profile
          </Button>
        </form>
      </section>

      <section aria-labelledby="password-heading" className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <h2 id="password-heading" className="text-sm font-semibold text-slate-800">
            Change password
          </h2>
        </div>

        <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
          {passwordError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {passwordError}
            </div>
          )}

          <FormField
            label="Current password"
            htmlFor="current-password"
            required
            error={passwordForm.formState.errors.currentPassword?.message}
          >
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(passwordForm.formState.errors.currentPassword)}
              {...passwordForm.register('currentPassword')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="New password"
              htmlFor="new-password"
              required
              error={passwordForm.formState.errors.newPassword?.message}
              hint="At least 8 characters with a letter and a number."
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(passwordForm.formState.errors.newPassword)}
                {...passwordForm.register('newPassword')}
              />
            </FormField>
            <FormField
              label="Confirm new password"
              htmlFor="confirm-password"
              required
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(passwordForm.formState.errors.confirmPassword)}
                {...passwordForm.register('confirmPassword')}
              />
            </FormField>
          </div>

          <Button type="submit" loading={passwordForm.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
