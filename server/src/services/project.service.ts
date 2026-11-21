import mongoose from 'mongoose';
import { resolveProjectRole } from '../policies/permissions';
import { Issue } from '../models/Issue';
import { Comment } from '../models/Comment';
import { Activity } from '../models/Activity';
import { Project, type ProjectDocument } from '../models/Project';
import { User } from '../models/User';
import { emitToProject, projectRoom } from '../realtime/emitter';
import { getSocketServer } from '../realtime/emitter';
import { serializeProject, type ProjectDto } from '../serializers';
import { ApiError } from '../utils/ApiError';
import { recordActivity } from './activity.service';

const MEMBER_SELECT = 'name email avatarUrl';
const POPULATE = [
  { path: 'owner', select: MEMBER_SELECT },
  { path: 'members.user', select: MEMBER_SELECT },
];

export async function listProjectsForUser(userId: string): Promise<ProjectDto[]> {
  const projects = await Project.find({ $or: [{ owner: userId }, { 'members.user': userId }] })
    .sort({ updatedAt: -1 })
    .populate(POPULATE);

  const ids = projects.map((p) => p._id);
  const counts = await Issue.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
    done: number;
  }>([
    { $match: { project: { $in: ids } } },
    {
      $group: {
        _id: '$project',
        count: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c]));

  return projects.map((project) => {
    const dto = serializeProject(project, resolveProjectRole(project, userId));
    const stats = countMap.get(String(project._id));
    return { ...dto, issueCount: stats?.count ?? 0, doneCount: stats?.done ?? 0 } as ProjectDto;
  });
}

export async function getProjectOrThrow(projectId: string): Promise<ProjectDocument> {
  const project = await Project.findById(projectId).populate(POPULATE);
  if (!project) throw ApiError.notFound('Project not found');
  return project;
}

export async function createProject(
  userId: string,
  input: { name: string; key: string; description?: string },
): Promise<ProjectDto> {
  const key = input.key.toUpperCase();
  const existing = await Project.findOne({ key });
  if (existing) throw ApiError.conflict(`Project key "${key}" is already in use`);

  const project = await Project.create({
    name: input.name,
    key,
    description: input.description ?? '',
    owner: userId,
    members: [{ user: userId, role: 'owner', addedAt: new Date() }],
    issueCounter: 0,
  });

  await recordActivity({
    project: project._id,
    actor: userId,
    action: 'project.created',
    message: `created the project ${project.name} (${project.key})`,
  });

  const populated = await project.populate(POPULATE);
  // The creator's open sockets may not be in this room yet.
  getSocketServer()
    ?.to(`user:${userId}`)
    .socketsJoin(projectRoom(String(project._id)));

  const dto = serializeProject(populated, 'owner');
  emitToProject(String(project._id), 'project:created', dto);
  return dto;
}

export async function updateProject(
  project: ProjectDocument,
  actorId: string,
  input: { name?: string; description?: string },
): Promise<ProjectDto> {
  const changes: string[] = [];
  if (input.name !== undefined && input.name !== project.name) {
    changes.push(`renamed the project to "${input.name}"`);
    project.name = input.name;
  }
  if (input.description !== undefined && input.description !== project.description) {
    changes.push('updated the project description');
    project.description = input.description;
  }
  if (changes.length === 0) {
    const populated = await project.populate(POPULATE);
    return serializeProject(populated);
  }
  await project.save();
  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'project.updated',
    message: changes.join(' and '),
  });

  const populated = await project.populate(POPULATE);
  const dto = serializeProject(populated);
  emitToProject(String(project._id), 'project:updated', dto);
  return dto;
}

export async function deleteProject(project: ProjectDocument, actorId: string): Promise<void> {
  const projectId = String(project._id);
  // Audit the deletion before the data disappears.
  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'project.updated',
    message: `deleted the project ${project.name} (${project.key})`,
  });
  await Promise.all([
    Issue.deleteMany({ project: project._id }),
    Comment.deleteMany({ project: project._id }),
    Project.deleteOne({ _id: project._id }),
  ]);
  emitToProject(projectId, 'project:deleted', { projectId });
  await Activity.deleteMany({ project: project._id });
}

export async function addMember(
  project: ProjectDocument,
  actorId: string,
  input: { email: string; role: 'admin' | 'member' | 'viewer' },
): Promise<ProjectDto> {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (!user) throw ApiError.notFound('No registered user found with that email address');

  const already = project.members.some((m) => String(m.user) === String(user._id));
  if (already) throw ApiError.conflict('That user is already a member of this project');
  if (String(project.owner) === String(user._id)) {
    throw ApiError.conflict('The project owner is already a member');
  }

  project.members.push({ user: user._id, role: input.role, addedAt: new Date() });
  await project.save();

  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'project.member.added',
    message: `added ${user.name} as ${input.role}`,
    metadata: { userId: String(user._id) },
  });

  getSocketServer()
    ?.to(`user:${String(user._id)}`)
    .socketsJoin(projectRoom(String(project._id)));
  const populated = await project.populate(POPULATE);
  const dto = serializeProject(populated);
  emitToProject(String(project._id), 'project:members.updated', dto);
  emitToProject(String(project._id), 'project:updated', dto);
  return dto;
}

export async function updateMemberRole(
  project: ProjectDocument,
  actorId: string,
  targetUserId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer',
): Promise<ProjectDto> {
  if (String(project.owner) === targetUserId) {
    throw ApiError.badRequest('The project owner role cannot be changed');
  }
  const member = project.members.find((m) => String(m.user) === targetUserId);
  if (!member) throw ApiError.notFound('That user is not a member of this project');
  if (member.role === role) {
    const populated = await project.populate(POPULATE);
    return serializeProject(populated);
  }
  if (role === 'owner') {
    throw ApiError.badRequest(
      'Transferring ownership is not supported. Contact the project owner.',
    );
  }

  const previous = member.role;
  member.role = role;
  await project.save();

  const target = await User.findById(targetUserId).select(MEMBER_SELECT);
  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'project.member.role_changed',
    message: `changed ${target?.name ?? 'a member'}'s role from ${previous} to ${role}`,
    from: previous,
    to: role,
    metadata: { userId: targetUserId },
  });

  const populated = await project.populate(POPULATE);
  const dto = serializeProject(populated);
  emitToProject(String(project._id), 'project:members.updated', dto);
  emitToProject(String(project._id), 'project:updated', dto);
  return dto;
}

export async function removeMember(
  project: ProjectDocument,
  actorId: string,
  targetUserId: string,
): Promise<ProjectDto> {
  if (String(project.owner) === targetUserId) {
    throw ApiError.badRequest('The project owner cannot be removed');
  }
  const member = project.members.find((m) => String(m.user) === targetUserId);
  if (!member) throw ApiError.notFound('That user is not a member of this project');

  project.members = project.members.filter((m) => String(m.user) !== targetUserId);
  await project.save();

  // Unassign the removed member from issues in this project.
  await Issue.updateMany(
    { project: project._id, assignee: targetUserId },
    { $set: { assignee: null } },
  );

  const target = await User.findById(targetUserId).select(MEMBER_SELECT);
  await recordActivity({
    project: project._id,
    actor: actorId,
    action: 'project.member.removed',
    message: `removed ${target?.name ?? 'a member'} from the project`,
    metadata: { userId: targetUserId },
  });

  getSocketServer()
    ?.to(`user:${targetUserId}`)
    .socketsLeave(projectRoom(String(project._id)));
  const populated = await project.populate(POPULATE);
  const dto = serializeProject(populated);
  emitToProject(String(project._id), 'project:members.updated', dto);
  emitToProject(String(project._id), 'project:updated', dto);
  emitToProject(String(project._id), 'issue:list-changed', { projectId: String(project._id) });
  return dto;
}

export async function projectStats(projectId: string) {
  const [byStatus, byPriority, byType, total, unassigned] = await Promise.all([
    Issue.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Issue.countDocuments({ project: projectId }),
    Issue.countDocuments({ project: projectId, assignee: null }),
  ]);

  const toMap = (rows: { _id: string; count: number }[]) =>
    rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row._id]: row.count }), {});

  return {
    total,
    unassigned,
    byStatus: toMap(byStatus),
    byPriority: toMap(byPriority),
    byType: toMap(byType),
  };
}
