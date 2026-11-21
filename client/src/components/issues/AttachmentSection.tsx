import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/Feedback';
import { useDeleteAttachment, useUploadAttachments } from '@/hooks/useIssueDetail';
import { apiUrl, cn, formatBytes, formatDate } from '@/lib/utils';
import type { Attachment } from '@/types';

interface AttachmentSectionProps {
  issueId: string;
  attachments: Attachment[];
  canManage: boolean;
}

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

export function AttachmentSection({ issueId, attachments, canManage }: AttachmentSectionProps) {
  const upload = useUploadAttachments(issueId);
  const remove = useDeleteAttachment(issueId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const handleFiles = (files: File[]) => {
    const valid = files.filter((file) => {
      if (!ALLOWED.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        return false;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: file must be smaller than 5 MB`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;
    upload.mutate(valid.slice(0, 5));
  };

  return (
    <section aria-labelledby="attachments-heading" className="surface-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <h2 id="attachments-heading" className="text-sm font-semibold text-slate-800">
            Attachments
          </h2>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
            {attachments.length}
          </span>
        </div>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED.join(',')}
              className="sr-only"
              aria-label="Upload attachments"
              onChange={(event) => {
                handleFiles(Array.from(event.target.files ?? []));
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={upload.isPending}
              onClick={() => inputRef.current?.click()}
              leftIcon={<UploadCloud className="h-3.5 w-3.5" />}
            >
              Upload
            </Button>
          </>
        )}
      </div>

      {canManage && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            handleFiles(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            'mb-3 rounded-lg border border-dashed px-3 py-3 text-center text-xs transition',
            dragOver
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-slate-300 text-slate-600',
          )}
        >
          Drag & drop screenshots here, or use Upload · PNG, JPG, WEBP, GIF, PDF up to 5 MB
        </div>
      )}

      {attachments.length === 0 ? (
        <EmptyState
          title="No attachments"
          description={
            canManage
              ? 'Attach a screenshot or document to add visual context.'
              : 'Nothing attached yet.'
          }
          icon={<Paperclip className="h-5 w-5" aria-hidden="true" />}
          className="border-0 bg-transparent py-6"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith('image/');
            const href = apiUrl(attachment.url);
            return (
              <li
                key={attachment.id}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label={`Open ${attachment.originalName}`}
                >
                  {isImage ? (
                    <img
                      src={href}
                      alt={attachment.originalName}
                      loading="lazy"
                      className="h-36 w-full bg-slate-50 object-cover"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-50 text-slate-600">
                      <FileText className="h-10 w-10" aria-hidden="true" />
                    </div>
                  )}
                </a>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {attachment.originalName}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={href}
                      download={attachment.originalName}
                      className="rounded p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Download ${attachment.originalName}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(attachment)}
                        className="rounded p-1 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${attachment.originalName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete attachment?"
        description={
          <>
            <strong>{deleteTarget?.originalName}</strong> will be permanently removed from this
            issue.
          </>
        }
        confirmLabel="Delete attachment"
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </section>
  );
}
