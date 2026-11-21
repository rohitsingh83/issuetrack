import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as commentService from '../services/comment.service';
import * as attachmentService from '../services/attachment.service';
import { Issue } from '../models/Issue';
import { Project } from '../models/Project';
import { resolveProjectRole } from '../policies/permissions';
import { ApiError } from '../utils/ApiError';
import { validated } from '../middleware/validate';
import { sendCreated, sendSuccess } from '../utils/response';
import { uploadDir } from '../middleware/upload';
import { verifyFileToken } from '../utils/jwt';

export async function listCommentsHandler(req: Request, res: Response) {
  const comments = await commentService.listComments(String(req.issue!._id));
  return sendSuccess(res, comments);
}

export async function createCommentHandler(req: Request, res: Response) {
  const body = validated<{ content: string }>(req.validated.body);
  const comment = await commentService.createComment({
    issue: req.issue!,
    project: req.project!,
    role: req.projectRole,
    authorId: String(req.user!._id),
    content: body.content,
  });
  return sendCreated(res, comment);
}

export async function updateCommentHandler(req: Request, res: Response) {
  const body = validated<{ content: string }>(req.validated.body);
  const comment = await commentService.updateComment({
    commentId: String(req.params.commentId),
    issue: req.issue!,
    project: req.project!,
    userId: String(req.user!._id),
    content: body.content,
  });
  return sendSuccess(res, comment);
}

export async function deleteCommentHandler(req: Request, res: Response) {
  await commentService.deleteComment({
    commentId: String(req.params.commentId),
    issue: req.issue!,
    project: req.project!,
    role: req.projectRole,
    userId: String(req.user!._id),
  });
  return sendSuccess(res, { message: 'Comment deleted' });
}

export async function uploadAttachmentsHandler(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const issue = await attachmentService.addAttachments({
    issue: req.issue!,
    project: req.project!,
    role: req.projectRole,
    userId: String(req.user!._id),
    actorName: req.user!.name,
    files,
  });
  return sendCreated(res, issue);
}

export async function deleteAttachmentHandler(req: Request, res: Response) {
  const issue = await attachmentService.removeAttachment({
    issue: req.issue!,
    project: req.project!,
    role: req.projectRole,
    userId: String(req.user!._id),
    attachmentId: String(req.params.attachmentId),
  });
  return sendSuccess(res, issue);
}

/**
 * Streams an attachment. Authorised either by a session (cookie/Bearer) that
 * belongs to a project member, or by the short-lived signed token that is
 * embedded in the URL handed out with the issue payload (so <img> tags work
 * cross-origin without exposing the session cookie).
 */
export async function downloadAttachmentHandler(req: Request, res: Response) {
  const issueId = String(req.params.issueId);
  const attachmentId = String(req.params.attachmentId);
  const file = await attachmentService.getAttachmentFile(issueId, attachmentId);

  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  let authorised = false;

  if (queryToken) {
    try {
      verifyFileToken(queryToken, attachmentId, issueId);
      authorised = true;
    } catch {
      authorised = false;
    }
  }

  if (!authorised && req.user) {
    const issue = await Issue.findById(issueId).select('project');
    const project = issue ? await Project.findById(issue.project) : null;
    authorised = Boolean(project && resolveProjectRole(project, String(req.user._id)));
  }

  if (!authorised) throw ApiError.unauthorized('You do not have access to this attachment');

  const absolute = path.resolve(uploadDir, path.basename(file.filename));
  if (!absolute.startsWith(uploadDir) || !fs.existsSync(absolute)) {
    throw ApiError.notFound('Attachment file is no longer available');
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${file.originalName.replace(/[^\w.\- ]/g, '_')}"`,
  );
  return fs.createReadStream(absolute).pipe(res);
}
