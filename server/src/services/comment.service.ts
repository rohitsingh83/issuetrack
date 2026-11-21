import { canComment, canDeleteIssue, canEditIssue } from '../policies/permissions';
import type { ProjectRole } from '../constants/domain';
import type { IssueDocument } from '../models/Issue';
import type { ProjectDocument } from '../models/Project';
import { Comment } from '../models/Comment';
import { emitToProject } from '../realtime/emitter';
import { serializeComment, type CommentDto } from '../serializers';
import { ApiError } from '../utils/ApiError';
import { recordActivity } from './activity.service';

const AUTHOR_SELECT = 'name email avatarUrl';

export async function listComments(issueId: string): Promise<CommentDto[]> {
  const comments = await Comment.find({ issue: issueId })
    .sort({ createdAt: 1 })
    .populate('author', AUTHOR_SELECT);
  return comments.map(serializeComment);
}

export async function createComment(input: {
  issue: IssueDocument;
  project: ProjectDocument;
  role: ProjectRole | undefined;
  authorId: string;
  content: string;
}): Promise<CommentDto> {
  const { issue, project, role, authorId, content } = input;
  if (!canComment(role)) throw ApiError.forbidden('Viewers cannot comment on issues');

  const comment = await Comment.create({
    issue: issue._id,
    project: project._id,
    author: authorId,
    content,
  });

  await recordActivity({
    project: project._id,
    issue: issue._id,
    actor: authorId,
    action: 'comment.added',
    message: `commented on ${issue.issueKey}`,
  });

  const populated = await comment.populate('author', AUTHOR_SELECT);
  const dto = serializeComment(populated);
  emitToProject(String(project._id), 'comment:created', { ...dto, projectId: String(project._id) });
  return dto;
}

export async function updateComment(input: {
  commentId: string;
  issue: IssueDocument;
  project: ProjectDocument;
  userId: string;
  content: string;
}): Promise<CommentDto> {
  const comment = await Comment.findOne({ _id: input.commentId, issue: input.issue._id });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) !== input.userId) {
    throw ApiError.forbidden('You can only edit your own comments');
  }

  comment.content = input.content;
  comment.editedAt = new Date();
  await comment.save();

  const populated = await comment.populate('author', AUTHOR_SELECT);
  const dto = serializeComment(populated);
  emitToProject(String(input.project._id), 'comment:updated', {
    ...dto,
    projectId: String(input.project._id),
  });
  return dto;
}

export async function deleteComment(input: {
  commentId: string;
  issue: IssueDocument;
  project: ProjectDocument;
  role: ProjectRole | undefined;
  userId: string;
}): Promise<void> {
  const comment = await Comment.findOne({ _id: input.commentId, issue: input.issue._id });
  if (!comment) throw ApiError.notFound('Comment not found');

  const isAuthor = String(comment.author) === input.userId;
  const canModerate = canDeleteIssue(input.role, { reporter: comment.author }, input.userId);
  if (!isAuthor && !canModerate) {
    throw ApiError.forbidden('You can only delete your own comments');
  }

  await comment.deleteOne();
  await recordActivity({
    project: input.project._id,
    issue: input.issue._id,
    actor: input.userId,
    action: 'comment.deleted',
    message: `deleted a comment on ${input.issue.issueKey}`,
  });

  emitToProject(String(input.project._id), 'comment:deleted', {
    commentId: String(comment._id),
    issueId: String(input.issue._id),
    projectId: String(input.project._id),
  });
}

export function canEditComment(
  role: ProjectRole | undefined,
  authorId: string,
  userId: string,
): boolean {
  if (authorId === userId) return true;
  return canEditIssue(role, { reporter: authorId as never, assignee: null }, userId);
}
