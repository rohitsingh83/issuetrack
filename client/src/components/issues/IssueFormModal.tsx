import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { LabelInput } from './LabelInput';
import { useMembers } from '@/hooks/useMembers';
import { useProjectLabels } from '@/hooks/useProjects';
import { useCreateIssue, useUpdateIssue } from '@/hooks/useIssues';
import { issueFormSchema, type IssueFormValues } from '@/lib/schemas';
import {
  ISSUE_TYPE_ORDER,
  ISSUE_TYPE_META,
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
} from '@/lib/constants';
import { ApiError, api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { formatBytes, toDateInputValue } from '@/lib/utils';
import type { Issue } from '@/types';

interface IssueFormModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  projectId: string;
  issue?: Issue;
  defaultStatus?: Issue['status'];
  onCreated?: (issue: Issue) => void;
}

const DEFAULTS: IssueFormValues = {
  title: '',
  description: '',
  type: 'bug',
  priority: 'medium',
  status: 'todo',
  assignee: '',
  dueDate: '',
  labels: [],
};

/** Create/edit issue dialog. Handles validation, labels, assignee and attachments. */
export function IssueFormModal({
  mode,
  open,
  onClose,
  projectId,
  issue,
  defaultStatus = 'todo',
  onCreated,
}: IssueFormModalProps) {
  const { data: memberData } = useMembers(open ? projectId : undefined);
  const { data: projectLabels } = useProjectLabels(open ? projectId : undefined);
  const createIssue = useCreateIssue(projectId);
  const updateIssue = useUpdateIssue(projectId);
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: { ...DEFAULTS, status: defaultStatus },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setFiles([]);
    if (mode === 'edit' && issue) {
      reset({
        title: issue.title,
        description: issue.description,
        type: issue.type,
        priority: issue.priority,
        status: issue.status,
        assignee: issue.assignee?.id ?? '',
        dueDate: toDateInputValue(issue.dueDate),
        labels: issue.labels,
      });
    } else {
      reset({ ...DEFAULTS, status: defaultStatus });
    }
  }, [open, mode, issue, reset, defaultStatus]);

  const members = memberData?.members ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() ?? '',
      type: values.type,
      priority: values.priority,
      status: values.status,
      assignee: values.assignee ? values.assignee : null,
      labels: values.labels ?? [],
      dueDate: values.dueDate ? values.dueDate : null,
    };

    try {
      if (mode === 'create') {
        const created = await createIssue.mutateAsync(payload);
        if (files.length > 0) {
          try {
            await api.issues.attachments.upload(created.id, files);
            queryClient.invalidateQueries({ queryKey: ['issue', created.id] });
            queryClient.invalidateQueries({ queryKey: ['issues'] });
            queryClient.invalidateQueries({ queryKey: ['board'] });
          } catch {
            toast.warning(
              'Issue created, but the attachment upload failed. Retry from the issue page.',
            );
          }
        }
        onCreated?.(created);
      } else if (issue) {
        await updateIssue.mutateAsync({ issueId: issue.id, payload });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.details) {
        Object.entries(error.details).forEach(([field, messages]) => {
          if (field === 'title' || field === 'description' || field === 'dueDate') {
            setError(field, { message: messages[0] });
          }
        });
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'Could not save the issue');
      }
    }
  });

  const busy = isSubmitting || createIssue.isPending || updateIssue.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      size="lg"
      title={mode === 'create' ? 'Create issue' : `Edit ${issue?.issueKey ?? 'issue'}`}
      description={
        mode === 'create'
          ? 'Describe the problem clearly so your team can pick it up quickly.'
          : 'Update the details, status, priority or assignment.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {mode === 'create' ? 'Create issue' : 'Save changes'}
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

        <FormField label="Title" htmlFor="issue-title" required error={errors.title?.message}>
          <Input
            id="issue-title"
            placeholder="e.g. Checkout button does nothing on Safari"
            invalid={Boolean(errors.title)}
            data-autofocus
            {...register('title')}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="issue-description"
          optional
          error={errors.description?.message}
          hint="Include steps to reproduce, expected and actual behaviour."
        >
          <Textarea
            id="issue-description"
            rows={5}
            placeholder="What happened? What did you expect?"
            {...register('description')}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Type" htmlFor="issue-type" required error={errors.type?.message}>
            <Select id="issue-type" {...register('type')}>
              {ISSUE_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {ISSUE_TYPE_META[type].label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Priority"
            htmlFor="issue-priority"
            required
            error={errors.priority?.message}
          >
            <Select id="issue-priority" {...register('priority')}>
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_META[priority].label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" htmlFor="issue-status" required error={errors.status?.message}>
            <Select id="issue-status" {...register('status')}>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Assignee"
            htmlFor="issue-assignee"
            optional
            hint={
              members.length === 0
                ? 'Add project members to assign issues.'
                : 'Only project members can be assigned.'
            }
          >
            <Select id="issue-assignee" {...register('assignee')} disabled={members.length === 0}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Due date" htmlFor="issue-due" optional error={errors.dueDate?.message}>
            <Input id="issue-due" type="date" {...register('dueDate')} />
          </FormField>
        </div>

        <FormField label="Labels" htmlFor="issue-labels" optional error={errors.labels?.message}>
          <Controller
            control={control}
            name="labels"
            render={({ field }) => (
              <LabelInput
                id="issue-labels"
                value={field.value ?? []}
                onChange={field.onChange}
                suggestions={projectLabels ?? []}
              />
            )}
          />
        </FormField>

        {mode === 'create' && (
          <FormField
            label="Screenshots"
            htmlFor="issue-files"
            optional
            hint="PNG, JPG, WEBP, GIF or PDF · up to 5 MB each · max 5 files"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="issue-files"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="sr-only"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  setFiles((current) => [...current, ...selected].slice(0, 5));
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Paperclip className="h-3.5 w-3.5" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach files
              </Button>
              <span className="text-xs text-slate-600">
                {files.length === 0 ? 'No files selected' : `${files.length} file(s) ready`}
              </span>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600"
                  >
                    <span className="truncate">
                      {file.name} · {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="rounded p-0.5 text-slate-600 hover:text-rose-600"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>
        )}
      </form>
    </Modal>
  );
}
