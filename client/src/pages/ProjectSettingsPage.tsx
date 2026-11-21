import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, History, Save, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/Feedback';
import { MembersPanel } from '@/components/projects/MembersPanel';
import { ActivityList } from '@/components/issues/ActivityTimeline';
import { useProjectContext } from '@/context/ProjectContext';
import { useDeleteProject, useProjectActivity, useUpdateProject } from '@/hooks/useProjects';
import { projectFormSchema, type ProjectFormValues } from '@/lib/schemas';

export function ProjectSettingsPage() {
  const { project, role, canManageProject } = useProjectContext();
  const navigate = useNavigate();
  const updateProject = useUpdateProject(project.id);
  const deleteProject = useDeleteProject();
  const { data: activity, isLoading: activityLoading } = useProjectActivity(project.id);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name,
      key: project.key,
      description: project.description,
    },
  });

  useEffect(() => {
    reset({ name: project.name, key: project.key, description: project.description });
  }, [project, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await updateProject.mutateAsync({
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
    });
    reset({ ...values });
  });

  return (
    <div className="space-y-4">
      <section aria-labelledby="general-heading" className="surface-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <h2 id="general-heading" className="text-sm font-semibold text-slate-800">
            General
          </h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <FormField
              label="Project name"
              htmlFor="settings-name"
              required
              error={errors.name?.message}
            >
              <Input
                id="settings-name"
                disabled={!canManageProject || updateProject.isPending}
                invalid={Boolean(errors.name)}
                {...register('name')}
              />
            </FormField>
            <FormField
              label="Project key"
              htmlFor="settings-key"
              hint="Keys are permanent so issue references stay stable."
            >
              <Input
                id="settings-key"
                value={project.key}
                readOnly
                disabled
                className="font-mono"
              />
            </FormField>
          </div>

          <FormField
            label="Description"
            htmlFor="settings-description"
            optional
            error={errors.description?.message}
          >
            <Textarea
              id="settings-description"
              rows={3}
              disabled={!canManageProject || updateProject.isPending}
              {...register('description')}
            />
          </FormField>

          {canManageProject ? (
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                loading={isSubmitting || updateProject.isPending}
                disabled={!isDirty}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => reset()}
                disabled={!isDirty || updateProject.isPending}
              >
                Reset
              </Button>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Only project owners and admins can edit these settings.
            </p>
          )}
        </form>
      </section>

      <MembersPanel
        projectId={project.id}
        ownerId={project.owner?.id}
        canManage={canManageProject}
      />

      <section aria-labelledby="project-activity-heading" className="surface-card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <h2 id="project-activity-heading" className="text-sm font-semibold text-slate-800">
            Project activity
          </h2>
        </div>
        <ActivityList items={activity} isLoading={activityLoading} />
      </section>

      {role === 'owner' ? (
        <section
          aria-labelledby="danger-heading"
          className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <h2 id="danger-heading" className="text-sm font-semibold text-rose-900">
              Danger zone
            </h2>
          </div>
          <p className="text-sm text-rose-800/80">
            Deleting <strong>{project.name}</strong> permanently removes all of its issues,
            comments, attachments and activity. Members will lose access immediately.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete project
          </Button>
        </section>
      ) : (
        <EmptyState
          title="Danger zone unavailable"
          description="Only the project owner can delete this project."
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${project.name}?`}
        description={
          <>
            This permanently deletes the project <strong>{project.name}</strong> ({project.key}) and
            every issue inside it. This action cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteProject.mutate(project.id, {
            onSuccess: () => navigate('/projects', { replace: true }),
          });
        }}
      />
    </div>
  );
}
