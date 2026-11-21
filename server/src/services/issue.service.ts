import mongoose from 'mongoose';
import { PRIORITY_WEIGHT, type IssuePriority } from '../constants/domain';
import { resolveProjectRole } from '../policies/permissions';
import { Comment } from '../models/Comment';
import { Issue, type IssueDocument } from '../models/Issue';
import { Project, type ProjectDocument } from '../models/Project';
import { emitToProject } from '../realtime/emitter';
import { serializeIssue, type IssueDto } from '../serializers';
import { ApiError } from '../utils/ApiError';
import type { IssueQueryInput } from '../validators';
import { recordActivity } from './activity.service';

const USER_SELECT = 'name email avatarUrl';
const ISSUE_POPULATE = [
  { path: 'reporter', select: USER_SELECT },
  { path: 'assignee', select: USER_SELECT },
  { path: 'attachments.uploadedBy', select: USER_SELECT },
  { path: 'project', select: 'name key' },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().slice(0, 30);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length >= 10) break;
  }
  return result;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Invalid date provided');
  return date;
}

function sortSpec(sort: IssueQueryInput['sort']): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1 };
    case 'priority':
      return { priorityRank: -1, createdAt: -1 };
    case 'dueDate':
      return { dueDate: 1, createdAt: -1 };
    case 'recentlyUpdated':
      return { updatedAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

function asArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export interface IssueListScope {
  projectIds: string[];
  projectFilter?: string;
  userId: string;
}

export async function buildIssueFilter(
  query: IssueQueryInput,
  scope: IssueListScope,
): Promise<Record<string, unknown>> {
  const projectIds = scope.projectIds.map((id) => new mongoose.Types.ObjectId(id));
  const filter: Record<string, unknown> = {
    project: scope.projectFilter
      ? new mongoose.Types.ObjectId(scope.projectFilter)
      : { $in: projectIds },
  };

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { issueKey: rx }, { labels: rx }];
  }

  const statuses = asArray(query.status);
  if (statuses?.length) filter.status = { $in: statuses };

  const priorities = asArray(query.priority);
  if (priorities?.length) filter.priority = { $in: priorities };

  const types = asArray(query.type);
  if (types?.length) filter.type = { $in: types };

  if (query.assignee) {
    if (query.assignee === 'unassigned') filter.assignee = null;
    else if (query.assignee === 'me') filter.assignee = new mongoose.Types.ObjectId(scope.userId);
    else if (mongoose.isValidObjectId(query.assignee)) {
      filter.assignee = new mongoose.Types.ObjectId(query.assignee);
    }
  }

  if (query.reporter) {
    if (query.reporter === 'me') filter.reporter = new mongoose.Types.ObjectId(scope.userId);
    else if (mongoose.isValidObjectId(query.reporter)) {
      filter.reporter = new mongoose.Types.ObjectId(query.reporter);
    }
  }

  const labels = asArray(query.label);
  if (labels?.length) filter.labels = { $in: labels };

  if (query.dueDateFrom || query.dueDateTo) {
    const range: Record<string, Date> = {};
    if (query.dueDateFrom) range.$gte = parseDate(query.dueDateFrom) as Date;
    if (query.dueDateTo) range.$lte = parseDate(query.dueDateTo) as Date;
    filter.dueDate = { ...range, $ne: null };
  }

  return filter;
}

export async function listIssues(
  query: IssueQueryInput,
  scope: IssueListScope,
): Promise<{ items: IssueDto[]; total: number; page: number; limit: number }> {
  const filter = await buildIssueFilter(query, scope);
  const page = query.page;
  const limit = query.limit;

  const [docs, total] = await Promise.all([
    Issue.find(filter)
      .sort(sortSpec(query.sort))
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(ISSUE_POPULATE),
    Issue.countDocuments(filter),
  ]);

  return { items: docs.map((d) => serializeIssue(d)), total, page, limit };
}

/** Kanban payload: all issues for a project, grouped client-side. */
export async function listBoardIssues(
  project: ProjectDocument,
  query: IssueQueryInput,
  userId: string,
): Promise<{ items: IssueDto[]; total: number }> {
  const filter = await buildIssueFilter(
    { ...query, page: 1, limit: 100 },
    { projectIds: [String(project._id)], projectFilter: String(project._id), userId },
  );
  const docs = await Issue.find(filter)
    .sort({ priorityRank: -1, updatedAt: -1 })
    .limit(500)
    .populate(ISSUE_POPULATE);
  return { items: docs.map((d) => serializeIssue(d)), total: docs.length };
}

async function nextIssueIdentity(
  project: ProjectDocument,
): Promise<{ issueNumber: number; issueKey: string }> {
  const updated = await Project.findOneAndUpdate(
    { _id: project._id },
    { $inc: { issueCounter: 1 } },
    { new: true, projection: { issueCounter: 1, key: 1 } },
  );
  if (!updated) throw ApiError.notFound('Project not found');
  project.issueCounter = updated.issueCounter;
  return { issueNumber: updated.issueCounter, issueKey: `${updated.key}-${updated.issueCounter}` };
}

export interface IssueWriteInput {
  title?: string;
  description?: string;
  type?: 'bug' | 'task' | 'story';
  priority?: IssuePriority;
  status?: 'todo' | 'in-progress' | 'done';
  assignee?: string | null;
  labels?: string[];
  dueDate?: string | null;
}

async function assertAssigneeIsMember(
  project: ProjectDocument,
  assignee?: string | null,
): Promise<void> {
  if (!assignee) return;
  const role = resolveProjectRole(project, assignee);
  if (!role) throw ApiError.badRequest('Assignee must be a member of this project');
}

export async function createIssue(
  project: ProjectDocument,
  reporterId: string,
  input: IssueWriteInput,
): Promise<IssueDto> {
  await assertAssigneeIsMember(project, input.assignee);
  const identity = await nextIssueIdentity(project);

  const issue = await Issue.create({
    project: project._id,
    issueNumber: identity.issueNumber,
    issueKey: identity.issueKey,
    title: input.title,
    description: input.description ?? '',
    type: input.type ?? 'bug',
    priority: input.priority ?? 'medium',
    priorityRank: PRIORITY_WEIGHT[input.priority ?? 'medium'],
    status: input.status ?? 'todo',
    reporter: reporterId,
    assignee: input.assignee || null,
    labels: normalizeLabels(input.labels ?? []),
    dueDate: parseDate(input.dueDate),
    attachments: [],
  });

  await recordActivity({
    project: project._id,
    issue: issue._id,
    actor: reporterId,
    action: 'issue.created',
    message: `created issue ${issue.issueKey}`,
    to: issue.title,
  });
  if (issue.assignee) {
    await recordActivity({
      project: project._id,
      issue: issue._id,
      actor: reporterId,
      action: 'issue.assigned',
      message: `assigned ${issue.issueKey}`,
      field: 'assignee',
      to: String(issue.assignee),
    });
  }

  const populated = await issue.populate(ISSUE_POPULATE);
  const dto = serializeIssue(populated);
  emitToProject(String(project._id), 'issue:created', dto);
  return dto;
}

export async function getIssueById(issueId: string): Promise<IssueDto> {
  const issue = await Issue.findById(issueId).populate(ISSUE_POPULATE);
  if (!issue) throw ApiError.notFound('Issue not found');
  const commentCount = await Comment.countDocuments({ issue: issue._id });
  return { ...serializeIssue(issue), commentCount };
}

interface UpdateOptions {
  actorId: string;
  project: ProjectDocument;
  issue: IssueDocument;
  input: IssueWriteInput;
}

export async function updateIssue({
  actorId,
  project,
  issue,
  input,
}: UpdateOptions): Promise<IssueDto> {
  const activities: Parameters<typeof recordActivity>[0][] = [];
  const issueRef = issue._id;
  const projectId = project._id;

  if (input.assignee !== undefined) {
    const nextAssignee = input.assignee || null;
    if (String(nextAssignee ?? '') !== String(issue.assignee ?? '')) {
      await assertAssigneeIsMember(project, nextAssignee);
      const from = issue.assignee ? String(issue.assignee) : null;
      issue.assignee = nextAssignee ? new mongoose.Types.ObjectId(nextAssignee) : null;
      activities.push({
        project: projectId,
        issue: issueRef,
        actor: actorId,
        action: nextAssignee ? 'issue.assigned' : 'issue.unassigned',
        message: nextAssignee ? `assigned ${issue.issueKey}` : `unassigned ${issue.issueKey}`,
        field: 'assignee',
        from,
        to: nextAssignee ? String(nextAssignee) : null,
      });
    }
  }

  if (input.status !== undefined && input.status !== issue.status) {
    activities.push({
      project: projectId,
      issue: issueRef,
      actor: actorId,
      action: 'issue.status_changed',
      message: `moved ${issue.issueKey} to ${statusLabel(input.status)}`,
      field: 'status',
      from: issue.status,
      to: input.status,
    });
    issue.status = input.status;
  }

  if (input.priority !== undefined && input.priority !== issue.priority) {
    activities.push({
      project: projectId,
      issue: issueRef,
      actor: actorId,
      action: 'issue.priority_changed',
      message: `changed priority of ${issue.issueKey} from ${issue.priority} to ${input.priority}`,
      field: 'priority',
      from: issue.priority,
      to: input.priority,
    });
    issue.priority = input.priority;
    issue.priorityRank = PRIORITY_WEIGHT[input.priority];
  }

  if (input.type !== undefined && input.type !== issue.type) {
    issue.type = input.type;
  }

  const contentChanges: string[] = [];
  if (input.title !== undefined && input.title !== issue.title) {
    issue.title = input.title;
    contentChanges.push('title');
  }
  if (input.description !== undefined && input.description !== issue.description) {
    issue.description = input.description;
    contentChanges.push('description');
  }
  if (input.labels !== undefined) {
    const nextLabels = normalizeLabels(input.labels);
    if (JSON.stringify(nextLabels) !== JSON.stringify(issue.labels)) {
      issue.labels = nextLabels;
      contentChanges.push('labels');
    }
  }
  if (input.dueDate !== undefined) {
    const nextDue = parseDate(input.dueDate);
    const current = issue.dueDate ? new Date(issue.dueDate).getTime() : null;
    if ((nextDue?.getTime() ?? null) !== current) {
      issue.dueDate = nextDue;
      contentChanges.push('due date');
    }
  }

  if (activities.length > 0 || contentChanges.length > 0) {
    if (contentChanges.length > 0) {
      activities.push({
        project: projectId,
        issue: issueRef,
        actor: actorId,
        action: 'issue.updated',
        message: `updated ${contentChanges.join(', ')} of ${issue.issueKey}`,
        field: contentChanges.join(','),
      });
    }
    await issue.save();
    for (const activity of activities) {
      // status changes are the most interesting; keep insertion order
      await recordActivity(activity);
    }
  }

  const populated = await issue.populate(ISSUE_POPULATE);
  const dto = serializeIssue(populated);
  emitToProject(String(projectId), 'issue:updated', dto);
  return dto;
}

function statusLabel(status: string): string {
  if (status === 'in-progress') return 'In Progress';
  if (status === 'todo') return 'To Do';
  return 'Done';
}

export async function deleteIssue(
  project: ProjectDocument,
  issue: IssueDocument,
  actorId: string,
): Promise<void> {
  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'issue.deleted',
    message: `deleted issue ${issue.issueKey}: ${issue.title}`,
  });
  await Promise.all([
    Comment.deleteMany({ issue: issue._id }),
    Issue.deleteOne({ _id: issue._id }),
  ]);
  emitToProject(String(project._id), 'issue:deleted', {
    issueId: String(issue._id),
    issueKey: issue.issueKey,
    projectId: String(project._id),
  });
}

export async function listProjectLabels(projectId: string): Promise<string[]> {
  const labels = await Issue.distinct('labels', {
    project: new mongoose.Types.ObjectId(projectId),
  });
  return (labels as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
