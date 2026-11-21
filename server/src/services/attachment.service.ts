import mongoose from 'mongoose';
import type { ProjectRole } from '../constants/domain';
import { canEditIssue } from '../policies/permissions';
import { Issue, type IssueDocument } from '../models/Issue';
import type { ProjectDocument } from '../models/Project';
import { emitToProject } from '../realtime/emitter';
import {
  serializeAttachment,
  serializeIssue,
  type AttachmentDto,
  type IssueDto,
} from '../serializers';
import { ApiError } from '../utils/ApiError';
import { safeUnlink } from '../middleware/upload';
import { recordActivity } from './activity.service';

const MAX_ATTACHMENTS = 10;

export async function addAttachments(input: {
  issue: IssueDocument;
  project: ProjectDocument;
  role: ProjectRole | undefined;
  userId: string;
  actorName: string;
  files: Express.Multer.File[];
}): Promise<IssueDto> {
  const { issue, project, role, userId, files } = input;
  if (!canEditIssue(role, issue, userId)) {
    files.forEach((f) => safeUnlink(f.filename));
    throw ApiError.forbidden('You do not have permission to add attachments to this issue');
  }
  if (!files || files.length === 0) throw ApiError.badRequest('No files were uploaded');
  if (issue.attachments.length + files.length > MAX_ATTACHMENTS) {
    files.forEach((f) => safeUnlink(f.filename));
    throw ApiError.badRequest(`An issue can have at most ${MAX_ATTACHMENTS} attachments`);
  }

  const newAttachments = files.map((file) => ({
    _id: new mongoose.Types.ObjectId(),
    filename: file.filename,
    originalName: file.originalname.slice(0, 200),
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: new mongoose.Types.ObjectId(userId),
    createdAt: new Date(),
  }));

  issue.attachments.push(...newAttachments);
  await issue.save();

  await recordActivity({
    project: project._id,
    issue: issue._id,
    actor: userId,
    action: 'attachment.added',
    message: `attached ${files.length === 1 ? files[0].originalname : `${files.length} files`} to ${issue.issueKey}`,
  });

  const populated = await issue.populate([
    { path: 'reporter', select: 'name email avatarUrl' },
    { path: 'assignee', select: 'name email avatarUrl' },
    { path: 'attachments.uploadedBy', select: 'name email avatarUrl' },
    { path: 'project', select: 'name key' },
  ]);
  const dto = serializeIssue(populated);
  emitToProject(String(project._id), 'issue:updated', dto);
  emitToProject(String(project._id), 'attachment:added', {
    issueId: String(issue._id),
    projectId: String(project._id),
    attachments: dto.attachments,
  });
  return dto;
}

export async function removeAttachment(input: {
  issue: IssueDocument;
  project: ProjectDocument;
  role: ProjectRole | undefined;
  userId: string;
  attachmentId: string;
}): Promise<IssueDto> {
  const { issue, project, role, userId, attachmentId } = input;
  const attachment = issue.attachments.find((a) => String(a._id) === attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');

  const isUploader = String(attachment.uploadedBy) === userId;
  if (!isUploader && !canEditIssue(role, issue, userId)) {
    throw ApiError.forbidden('You do not have permission to delete this attachment');
  }

  issue.attachments = issue.attachments.filter((a) => String(a._id) !== attachmentId);
  await issue.save();
  safeUnlink(attachment.filename);

  await recordActivity({
    project: project._id,
    issue: issue._id,
    actor: userId,
    action: 'attachment.deleted',
    message: `removed attachment ${attachment.originalName} from ${issue.issueKey}`,
  });

  const populated = await issue.populate([
    { path: 'reporter', select: 'name email avatarUrl' },
    { path: 'assignee', select: 'name email avatarUrl' },
    { path: 'attachments.uploadedBy', select: 'name email avatarUrl' },
    { path: 'project', select: 'name key' },
  ]);
  const dto = serializeIssue(populated);
  emitToProject(String(project._id), 'issue:updated', dto);
  emitToProject(String(project._id), 'attachment:deleted', {
    issueId: String(issue._id),
    projectId: String(project._id),
    attachmentId,
  });
  return dto;
}

export async function getAttachmentMeta(
  issueId: string,
  attachmentId: string,
): Promise<AttachmentDto> {
  const issue = await Issue.findById(issueId).populate(
    'attachments.uploadedBy',
    'name email avatarUrl',
  );
  if (!issue) throw ApiError.notFound('Issue not found');
  const attachment = issue.attachments.find((a) => String(a._id) === attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  return serializeAttachment(issueId, attachment);
}

export async function getAttachmentFile(
  issueId: string,
  attachmentId: string,
): Promise<{ filename: string; originalName: string; mimeType: string }> {
  const issue = await Issue.findById(issueId);
  if (!issue) throw ApiError.notFound('Issue not found');
  const attachment = issue.attachments.find((a) => String(a._id) === attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  return {
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
  };
}
