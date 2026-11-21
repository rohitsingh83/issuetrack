import type { IUser, UserDocument } from '../models/User';
import type { IProject } from '../models/Project';
import type { IIssue } from '../models/Issue';
import type { IActivity } from '../models/Activity';
import type { IComment } from '../models/Comment';
import { signFileToken } from '../utils/jwt';

export interface PublicUserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface MemberDto extends PublicUserDto {
  role: string;
  addedAt: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  key: string;
  description: string;
  owner: PublicUserDto | null;
  members: MemberDto[];
  memberCount: number;
  role?: string;
  issueCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: PublicUserDto | null;
  createdAt: string;
}

export interface IssueDto {
  id: string;
  projectId: string;
  projectKey?: string;
  issueNumber: number;
  issueKey: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  reporter: PublicUserDto | null;
  assignee: PublicUserDto | null;
  labels: string[];
  dueDate: string | null;
  attachments: AttachmentDto[];
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

type Populated<T> = T & { _id: unknown };

function asUser(value: unknown): PublicUserDto | null {
  if (!value) return null;
  const u = value as Populated<IUser>;
  if (!u._id) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email ?? '',
    avatarUrl: u.avatarUrl ?? null,
  };
}

export function serializeUser(user: IUser): PublicUserDto {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function serializeProject(project: IProject, role?: string): ProjectDto {
  const owner = asUser(project.owner);
  return {
    id: String(project._id),
    name: project.name,
    key: project.key,
    description: project.description ?? '',
    owner,
    members: (project.members ?? []).map((m) => {
      const u = asUser(m.user);
      return {
        id: u?.id ?? '',
        name: u?.name ?? 'Unknown user',
        email: u?.email ?? '',
        avatarUrl: u?.avatarUrl ?? null,
        role: m.role,
        addedAt: new Date(m.addedAt).toISOString(),
      };
    }),
    memberCount: project.members?.length ?? 0,
    ...(role ? { role } : {}),
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
  };
}

export function serializeAttachment(
  issueId: string,
  attachment: IIssue['attachments'][number],
): AttachmentDto {
  const token = signFileToken(String(attachment._id), issueId);
  return {
    id: String(attachment._id),
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `/api/issues/${issueId}/attachments/${String(attachment._id)}?token=${token}`,
    uploadedBy: asUser(attachment.uploadedBy),
    createdAt: new Date(attachment.createdAt).toISOString(),
  };
}

export function serializeIssue(issue: IIssue & { commentCount?: number }): IssueDto {
  const projectRaw = issue.project as unknown;
  const projectObj =
    projectRaw && typeof projectRaw === 'object' && '_id' in (projectRaw as object)
      ? (projectRaw as { _id: unknown; key?: string })
      : null;
  const issueId = String(issue._id);

  return {
    id: issueId,
    projectId: projectObj ? String(projectObj._id) : String(projectRaw),
    projectKey: projectObj?.key,
    issueNumber: issue.issueNumber,
    issueKey: issue.issueKey,
    title: issue.title,
    description: issue.description ?? '',
    type: issue.type,
    priority: issue.priority,
    status: issue.status,
    reporter: asUser(issue.reporter),
    assignee: asUser(issue.assignee),
    labels: issue.labels ?? [],
    dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
    attachments: (issue.attachments ?? []).map((a) => serializeAttachment(issueId, a)),
    ...(typeof issue.commentCount === 'number' ? { commentCount: issue.commentCount } : {}),
    createdAt: new Date(issue.createdAt).toISOString(),
    updatedAt: new Date(issue.updatedAt).toISOString(),
  };
}

export interface CommentDto {
  id: string;
  issueId: string;
  content: string;
  author: PublicUserDto | null;
  edited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeComment(comment: IComment): CommentDto {
  return {
    id: String(comment._id),
    issueId: String(comment.issue),
    content: comment.content,
    author: asUser(comment.author),
    edited: Boolean(comment.editedAt),
    editedAt: comment.editedAt ? new Date(comment.editedAt).toISOString() : null,
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString(),
  };
}

export interface ActivityDto {
  id: string;
  action: string;
  message: string;
  field: string | null;
  from: string | null;
  to: string | null;
  actor: PublicUserDto | null;
  issueId: string | null;
  createdAt: string;
}

export function serializeActivity(activity: IActivity): ActivityDto {
  return {
    id: String(activity._id),
    action: activity.action,
    message: activity.message,
    field: activity.field ?? null,
    from: activity.from ?? null,
    to: activity.to ?? null,
    actor: asUser(activity.actor),
    issueId: activity.issue ? String(activity.issue) : null,
    createdAt: new Date(activity.createdAt).toISOString(),
  };
}

export type { UserDocument };
