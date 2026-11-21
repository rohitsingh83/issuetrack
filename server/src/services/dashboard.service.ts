import mongoose from 'mongoose';
import { Issue } from '../models/Issue';
import { Project } from '../models/Project';
import { serializeIssue, serializeProject, type IssueDto, type ProjectDto } from '../serializers';
import { resolveProjectRole } from '../policies/permissions';
import { listUserActivity } from './activity.service';

export interface DashboardDto {
  projects: ProjectDto[];
  stats: {
    projectCount: number;
    totalIssues: number;
    openIssues: number;
    doneIssues: number;
    assignedToMe: number;
    reportedByMe: number;
    overdue: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  myIssues: IssueDto[];
  recentActivity: Awaited<ReturnType<typeof listUserActivity>>;
}

export async function getDashboard(userId: string): Promise<DashboardDto> {
  const projects = await Project.find({ $or: [{ owner: userId }, { 'members.user': userId }] })
    .sort({ updatedAt: -1 })
    .populate([
      { path: 'owner', select: 'name email avatarUrl' },
      { path: 'members.user', select: 'name email avatarUrl' },
    ]);

  const projectIds = projects.map((p) => p._id);
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const [
    grouped,
    assignedToMe,
    reportedByMe,
    overdue,
    myIssues,
    recentActivity,
    issueTotals,
    perProject,
  ] = await Promise.all([
    Issue.aggregate<{ _id: { status: string; priority: string }; count: number }>([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: { status: '$status', priority: '$priority' }, count: { $sum: 1 } } },
    ]),
    Issue.countDocuments({
      project: { $in: projectIds },
      assignee: objectUserId,
      status: { $ne: 'done' },
    }),
    Issue.countDocuments({
      project: { $in: projectIds },
      reporter: objectUserId,
      status: { $ne: 'done' },
    }),
    Issue.countDocuments({
      project: { $in: projectIds },
      dueDate: { $ne: null, $lt: new Date() },
      status: { $ne: 'done' },
    }),
    Issue.find({ project: { $in: projectIds }, assignee: objectUserId, status: { $ne: 'done' } })
      .sort({ priorityRank: -1, updatedAt: -1 })
      .limit(6)
      .populate([
        { path: 'reporter', select: 'name email avatarUrl' },
        { path: 'assignee', select: 'name email avatarUrl' },
        { path: 'attachments.uploadedBy', select: 'name email avatarUrl' },
        { path: 'project', select: 'name key' },
      ]),
    listUserActivity(projectIds.map(String), 12),
    Issue.countDocuments({ project: { $in: projectIds } }),
    Issue.aggregate<{ _id: mongoose.Types.ObjectId; count: number; done: number }>([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: '$project',
          count: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const perProjectMap = new Map(perProject.map((row) => [String(row._id), row]));

  const byStatus: Record<string, number> = { todo: 0, 'in-progress': 0, done: 0 };
  const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  grouped.forEach((row) => {
    byStatus[row._id.status] = (byStatus[row._id.status] ?? 0) + row.count;
    byPriority[row._id.priority] = (byPriority[row._id.priority] ?? 0) + row.count;
  });

  return {
    projects: projects.map((p) => {
      const counts = perProjectMap.get(String(p._id));
      return {
        ...serializeProject(p, resolveProjectRole(p, userId)),
        issueCount: counts?.count ?? 0,
        doneCount: counts?.done ?? 0,
      };
    }),
    stats: {
      projectCount: projects.length,
      totalIssues: issueTotals,
      openIssues: (byStatus.todo ?? 0) + (byStatus['in-progress'] ?? 0),
      doneIssues: byStatus.done ?? 0,
      assignedToMe,
      reportedByMe,
      overdue,
      byStatus,
      byPriority,
    },
    myIssues: myIssues.map((i) => serializeIssue(i)),
    recentActivity,
  };
}
