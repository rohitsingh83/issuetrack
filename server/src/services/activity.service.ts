import type { Types } from 'mongoose';
import type { ActivityAction } from '../constants/domain';
import { Activity, type ActivityDocument } from '../models/Activity';
import { emitToProject } from '../realtime/emitter';
import { serializeActivity } from '../serializers';

export interface RecordActivityInput {
  project: Types.ObjectId | string;
  issue?: Types.ObjectId | string | null;
  actor: Types.ObjectId | string;
  action: ActivityAction;
  message: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  metadata?: Record<string, unknown>;
}

/** Persists an audit-log entry and broadcasts it to the project room. */
export async function recordActivity(input: RecordActivityInput): Promise<ActivityDocument> {
  const activity = await Activity.create({
    project: input.project,
    issue: input.issue ?? null,
    actor: input.actor,
    action: input.action,
    message: input.message.slice(0, 500),
    field: input.field ?? null,
    from: input.from ?? null,
    to: input.to ?? null,
    metadata: input.metadata ?? {},
  });

  const populated = await activity.populate('actor', 'name email avatarUrl');
  emitToProject(String(input.project), 'activity:created', serializeActivity(populated));
  return activity;
}

export async function listProjectActivity(projectId: string, limit = 30) {
  const activities = await Activity.find({ project: projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name email avatarUrl')
    .populate('issue', 'issueKey title');
  return activities.map(serializeActivity);
}

export async function listIssueActivity(issueId: string, limit = 100) {
  const activities = await Activity.find({ issue: issueId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name email avatarUrl');
  return activities.map(serializeActivity);
}

export async function listUserActivity(projectIds: string[], limit = 15) {
  const activities = await Activity.find({ project: { $in: projectIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name email avatarUrl')
    .populate('issue', 'issueKey title')
    .populate('project', 'name key');
  return activities.map((a) => {
    const dto = serializeActivity(a);
    const project = a.project as unknown as { _id: unknown; name?: string; key?: string } | null;
    const issue = a.issue as unknown as { _id: unknown; issueKey?: string; title?: string } | null;
    return {
      ...dto,
      projectId: project && project._id ? String(project._id) : null,
      projectName: project?.name ?? null,
      projectKey: project?.key ?? null,
      issueKey: issue?.issueKey ?? null,
    };
  });
}
