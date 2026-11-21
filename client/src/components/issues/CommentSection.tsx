import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { useAuth } from '@/hooks/useAuth';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from '@/hooks/useIssueDetail';
import { commentFormSchema, type CommentFormValues } from '@/lib/schemas';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { Comment } from '@/types';

interface CommentSectionProps {
  issueId: string;
  canComment: boolean;
  canModerate: boolean;
}

export function CommentSection({ issueId, canComment, canModerate }: CommentSectionProps) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(issueId);
  const createComment = useCreateComment(issueId);
  const updateComment = useUpdateComment(issueId);
  const deleteComment = useDeleteComment(issueId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createComment.mutateAsync(values.content.trim());
    reset({ content: '' });
  });

  const canEditComment = (comment: Comment) => comment.author?.id === user?.id;
  const canDeleteComment = (comment: Comment) => comment.author?.id === user?.id || canModerate;

  return (
    <section aria-labelledby="comments-heading" className="surface-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-slate-600" aria-hidden="true" />
        <h2 id="comments-heading" className="text-sm font-semibold text-slate-800">
          Comments
        </h2>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
          {comments?.length ?? 0}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : comments && comments.length > 0 ? (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <Avatar
                name={comment.author?.name}
                email={comment.author?.email}
                src={comment.author?.avatarUrl ?? null}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {comment.author?.name ?? 'Unknown user'}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    title={formatDateTime(comment.createdAt)}
                    className="text-[11px] text-slate-600"
                  >
                    {relativeTime(comment.createdAt)}
                  </time>
                  {comment.edited && (
                    <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600">
                      edited
                    </span>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-1.5">
                    <Textarea
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      rows={3}
                      aria-label="Edit comment"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const content = editDraft.trim();
                          if (!content) return;
                          updateComment.mutate(
                            { commentId: comment.id, content },
                            {
                              onSuccess: () => {
                                setEditingId(null);
                                setEditDraft('');
                              },
                            },
                          );
                        }}
                        loading={updateComment.isPending}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative mt-1 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                      {comment.content}
                    </p>
                    {(canEditComment(comment) || canDeleteComment(comment)) && (
                      <div className="mt-1 flex gap-1">
                        {canEditComment(comment) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditDraft(comment.content);
                            }}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-slate-600 transition hover:bg-white hover:text-slate-700"
                            aria-label="Edit comment"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                          </button>
                        )}
                        {canDeleteComment(comment) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(comment)}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-slate-600 transition hover:bg-white hover:text-rose-600"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No comments yet"
          description="Share context, findings or a quick update with your team."
          icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
          className="border-0 bg-transparent py-6"
        />
      )}

      {canComment ? (
        <form onSubmit={onSubmit} className="mt-5 border-t border-slate-100 pt-4">
          <label htmlFor="comment-input" className="label-base">
            Add a comment
          </label>
          <Textarea
            id="comment-input"
            rows={3}
            placeholder="Write a comment… (Ctrl/⌘ + Enter to send)"
            invalid={Boolean(errors.content)}
            {...register('content')}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                void onSubmit();
              }
            }}
          />
          {errors.content && (
            <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
              {errors.content.message}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" loading={createComment.isPending}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          You have read-only access to this project, so commenting is disabled.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete comment?"
        description="This permanently removes the comment from the issue. This action cannot be undone."
        confirmLabel="Delete comment"
        destructive
        loading={deleteComment.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteComment.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </section>
  );
}
