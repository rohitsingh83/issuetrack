import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/FormControls';
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects';
import { projectFormSchema, type ProjectFormValues } from '@/lib/schemas';
import { ApiError } from '@/lib/api';
import type { Project } from '@/types';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  project?: Project;
  onCreated?: (project: Project) => void;
}

function keyFromName(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  if (!letters) return '';
  const words = letters.split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 4);
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function ProjectFormModal({
  open,
  onClose,
  mode,
  project,
  onCreated,
}: ProjectFormModalProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(project?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();
  const [keyTouched, setKeyTouched] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', key: '', description: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setKeyTouched(false);
    reset(
      mode === 'edit' && project
        ? { name: project.name, key: project.key, description: project.description }
        : { name: '', key: '', description: '' },
    );
  }, [open, mode, project, reset]);

  const name = watch('name');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (mode === 'create') {
        const created = await createProject.mutateAsync({
          name: values.name.trim(),
          key: values.key.trim().toUpperCase(),
          description: values.description?.trim() ?? '',
        });
        onCreated?.(created);
      } else if (project) {
        await updateProject.mutateAsync({
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
        });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.key) setError('key', { message: error.details.key[0] });
        if (error.details?.name) setError('name', { message: error.details.name[0] });
        setFormError(error.message);
      } else {
        setFormError('Could not save the project');
      }
    }
  });

  const busy = isSubmitting || createProject.isPending || updateProject.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={mode === 'create' ? 'Create project' : 'Edit project'}
      description={
        mode === 'create'
          ? 'Projects group issues and team members. Use a short, memorable key.'
          : 'Update the project name and description.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {mode === 'create' ? 'Create project' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {formError}
          </div>
        )}

        <FormField
          label="Project name"
          htmlFor="project-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="project-name"
            placeholder="e.g. Nebula Web App"
            invalid={Boolean(errors.name)}
            data-autofocus
            {...register('name', {
              onChange: (event) => {
                if (mode === 'create' && !keyTouched) {
                  setValue('key', keyFromName(event.target.value), { shouldValidate: false });
                }
              },
            })}
          />
        </FormField>

        {mode === 'create' && (
          <FormField
            label="Project key"
            htmlFor="project-key"
            required
            error={errors.key?.message}
            hint="Used as the issue prefix, e.g. WEB-12. Letters and numbers, 2-10 characters."
          >
            <Input
              id="project-key"
              placeholder="WEB"
              className="uppercase"
              maxLength={10}
              invalid={Boolean(errors.key)}
              {...register('key', {
                onChange: () => setKeyTouched(true),
              })}
              onBlur={() => {
                const current = watch('key');
                if (current) setValue('key', current.toUpperCase());
              }}
            />
          </FormField>
        )}

        <FormField
          label="Description"
          htmlFor="project-description"
          optional
          error={errors.description?.message}
        >
          <Textarea
            id="project-description"
            rows={3}
            placeholder={name ? `What is ${name} about?` : 'What is this project about?'}
            {...register('description')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
