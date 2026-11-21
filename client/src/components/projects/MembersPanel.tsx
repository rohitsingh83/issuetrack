import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { useAddMember, useMembers, useRemoveMember, useUpdateMemberRole } from '@/hooks/useMembers';
import { useAuth } from '@/hooks/useAuth';
import { memberFormSchema, type MemberFormValues } from '@/lib/schemas';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Member, ProjectRole } from '@/types';

interface MembersPanelProps {
  projectId: string;
  ownerId?: string;
  canManage: boolean;
}

export function MembersPanel({ projectId, ownerId, canManage }: MembersPanelProps) {
  const { user } = useAuth();
  const { data, isLoading } = useMembers(projectId);
  const addMember = useAddMember(projectId);
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { email: '', role: 'member' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await addMember.mutateAsync({ email: values.email.trim(), role: values.role });
      reset({ email: '', role: 'member' });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.email) setError('email', { message: error.details.email[0] });
        setFormError(error.message);
      }
    }
  });

  const members = data?.members ?? [];

  return (
    <section aria-labelledby="members-heading" className="surface-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-600" aria-hidden="true" />
        <h2 id="members-heading" className="text-sm font-semibold text-slate-800">
          Team members
        </h2>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
          {members.length}
        </span>
      </div>

      {canManage && (
        <form
          onSubmit={onSubmit}
          className="mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <FormField
              label="Add member by email"
              htmlFor="member-email"
              error={errors.email?.message}
            >
              <Input
                id="member-email"
                type="email"
                placeholder="teammate@company.com"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>
            <FormField label="Role" htmlFor="member-role">
              <Select id="member-role" {...register('role')}>
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
            <Button
              type="submit"
              loading={isSubmitting || addMember.isPending}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Add
            </Button>
          </div>
          {formError && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
              {formError}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            The user must already have an IssueTrack account. Admins manage members; viewers can
            only read.
          </p>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add teammates to collaborate on this project."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {members.map((member) => {
            const isOwner = member.role === 'owner' || member.id === ownerId;
            const isSelf = member.id === user?.id;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={member.name} email={member.email} src={member.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    {member.name}
                    {isSelf && (
                      <span className="text-[11px] font-normal text-slate-600">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-600">{member.email}</p>
                </div>
                <div className="text-right text-[11px] text-slate-600">
                  <p>Joined {formatDate(member.addedAt)}</p>
                </div>
                {canManage && !isOwner ? (
                  <div className="flex items-center gap-1.5">
                    <Select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      className="h-8 w-[7.5rem] py-0 text-xs"
                      onChange={(event) =>
                        updateRole.mutate({
                          userId: member.id,
                          role: event.target.value as ProjectRole,
                        })
                      }
                      disabled={updateRole.isPending}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(member)}
                      className="rounded p-1.5 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove ${member.name} from the project`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={`Remove ${removeTarget?.name ?? 'member'}?`}
        description="They will lose access to this project immediately and be unassigned from its issues."
        confirmLabel="Remove member"
        destructive
        loading={removeMember.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          removeMember.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) });
        }}
      />
    </section>
  );
}
