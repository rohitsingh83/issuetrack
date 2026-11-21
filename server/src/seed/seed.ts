/**
 * Seed script — populates the database with demo users, a project, members,
 * issues, comments and activity history.
 *
 * Usage: npm run seed            (in ./server)
 * Destructive: clears users/projects/issues/comments/activity first.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Issue } from '../models/Issue';
import { Comment } from '../models/Comment';
import { Activity } from '../models/Activity';
import { recordActivity } from '../services/activity.service';
import { PRIORITY_WEIGHT } from '../constants/domain';

const DEMO_USERS = [
  { name: 'Avery Chen', email: 'owner@demo.dev', role: 'owner' },
  { name: 'Priya Nair', email: 'admin@demo.dev', role: 'admin' },
  { name: 'Marcus Webb', email: 'member@demo.dev', role: 'member' },
  { name: 'Sofia Ruiz', email: 'viewer@demo.dev', role: 'viewer' },
];

const ISSUES = [
  {
    title: 'Login form fails on Safari 17 with autofill enabled',
    description:
      'When Safari autofills the email field, the form submits before React Hook Form registers the value, so the request goes out with an empty email.',
    type: 'bug',
    priority: 'critical',
    status: 'in-progress',
    labels: ['auth', 'browser'],
    daysAgo: 5,
    assignee: 2,
    reporter: 0,
  },
  {
    title: 'Kanban drag-and-drop loses dropped card on slow networks',
    description:
      'Optimistic update rolls back unexpectedly when the PATCH takes more than ~2s. We should keep the optimistic state until the mutation settles.',
    type: 'bug',
    priority: 'high',
    status: 'todo',
    labels: ['board', 'performance'],
    daysAgo: 3,
    assignee: 2,
    reporter: 1,
  },
  {
    title: 'Add CSV export for filtered issue list',
    description:
      'Product wants a one-click export of the currently filtered issue list, including key, title, status, priority and assignee.',
    type: 'story',
    priority: 'medium',
    status: 'todo',
    labels: ['reporting'],
    daysAgo: 8,
    assignee: null,
    reporter: 1,
  },
  {
    title: 'Comment timestamps should be relative on the issue detail page',
    description: 'Show "3 minutes ago" style timestamps with a tooltip for the absolute time.',
    type: 'task',
    priority: 'low',
    status: 'done',
    labels: ['ui'],
    daysAgo: 12,
    assignee: 2,
    reporter: 0,
  },
  {
    title: 'Attachments disappear after editing an issue',
    description:
      'Saving the edit form replaces the whole issue document and wipes the attachments array.',
    type: 'bug',
    priority: 'high',
    status: 'done',
    labels: ['attachments', 'regression'],
    daysAgo: 15,
    assignee: 1,
    reporter: 2,
  },
  {
    title: 'Mobile sidebar should close after navigating',
    description: 'On <768px the drawer stays open after tapping a nav item.',
    type: 'bug',
    priority: 'medium',
    status: 'in-progress',
    labels: ['mobile', 'ui'],
    daysAgo: 2,
    assignee: null,
    reporter: 2,
  },
  {
    title: 'Rate limit login attempts per IP',
    description: 'Add express-rate-limit to /api/auth/login and /api/auth/register.',
    type: 'task',
    priority: 'high',
    status: 'done',
    labels: ['security', 'auth'],
    daysAgo: 20,
    assignee: 1,
    reporter: 0,
  },
  {
    title: 'Project settings: allow renaming a project',
    description: 'Owner and admins should be able to rename and re-describe a project.',
    type: 'story',
    priority: 'low',
    status: 'todo',
    labels: ['settings'],
    daysAgo: 9,
    assignee: null,
    reporter: 0,
  },
];

const COMMENTS = [
  {
    issueIndex: 0,
    authorIndex: 1,
    content:
      'Reproduced on Safari 17.4. The autofill fires `change` after submit — we should switch to `onTouched` validation.',
  },
  {
    issueIndex: 0,
    authorIndex: 2,
    content: "I'll take this today. Adding a regression test with React Testing Library.",
  },
  {
    issueIndex: 1,
    authorIndex: 0,
    content: 'Nice catch. Let’s keep the optimistic value in the cache until `onSettled`.',
  },
  {
    issueIndex: 2,
    authorIndex: 2,
    content: 'Should the export respect the current sort order too?',
  },
];

export async function populateSeedData(): Promise<void> {

  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Issue.deleteMany({}),
    Comment.deleteMany({}),
    Activity.deleteMany({}),
  ]);

  const passwordHash = await User.hashPassword(env.SEED_DEMO_PASSWORD);
  const users = await User.create(
    DEMO_USERS.map((u) => ({ name: u.name, email: u.email, passwordHash })),
  );
  // eslint-disable-next-line no-console
  console.log(`   • ${users.length} users created`);

  const project = await Project.create({
    name: 'Nebula Web App',
    key: 'WEB',
    description:
      'Customer-facing web application: authentication, dashboards and the issue tracking experience.',
    owner: users[0]._id,
    members: DEMO_USERS.map((u, index) => ({
      user: users[index]._id,
      role: u.role,
      addedAt: new Date(Date.now() - (10 - index) * 86400000),
    })),
    issueCounter: 0,
  });

  const secondProject = await Project.create({
    name: 'Mobile Companion',
    key: 'APP',
    description: 'React Native companion app for on-the-go triage.',
    owner: users[0]._id,
    members: [
      { user: users[0]._id, role: 'owner' },
      { user: users[1]._id, role: 'admin' },
      { user: users[2]._id, role: 'member' },
    ],
    issueCounter: 0,
  });
  // eslint-disable-next-line no-console
  console.log(`   • 2 projects created (${project.key}, ${secondProject.key})`);

  await recordActivity({
    project: project._id,
    actor: users[0]._id,
    action: 'project.created',
    message: `created the project ${project.name} (${project.key})`,
  });
  await recordActivity({
    project: secondProject._id,
    actor: users[0]._id,
    action: 'project.created',
    message: `created the project ${secondProject.name} (${secondProject.key})`,
  });

  const createdIssues = [];
  for (const [index, seedIssue] of ISSUES.entries()) {
    const issue = await Issue.create({
      project: project._id,
      issueNumber: index + 1,
      issueKey: `${project.key}-${index + 1}`,
      title: seedIssue.title,
      description: seedIssue.description,
      type: seedIssue.type,
      priority: seedIssue.priority,
      priorityRank: PRIORITY_WEIGHT[seedIssue.priority as keyof typeof PRIORITY_WEIGHT],
      status: seedIssue.status,
      reporter: users[seedIssue.reporter]._id,
      assignee: seedIssue.assignee === null ? null : users[seedIssue.assignee]._id,
      labels: seedIssue.labels,
      dueDate: seedIssue.status === 'done' ? null : new Date(Date.now() + (index - 2) * 86400000),
      createdAt: new Date(Date.now() - seedIssue.daysAgo * 86400000),
      updatedAt: new Date(Date.now() - (seedIssue.daysAgo - 1) * 86400000),
    });
    createdIssues.push(issue);

    await recordActivity({
      project: project._id,
      issue: issue._id,
      actor: users[seedIssue.reporter]._id,
      action: 'issue.created',
      message: `created issue ${issue.issueKey}`,
      to: issue.title,
    });
    if (issue.assignee) {
      await recordActivity({
        project: project._id,
        issue: issue._id,
        actor: users[0]._id,
        action: 'issue.assigned',
        message: `assigned ${issue.issueKey}`,
        field: 'assignee',
      });
    }
    if (issue.status !== 'todo') {
      await recordActivity({
        project: project._id,
        issue: issue._id,
        actor: users[0]._id,
        action: 'issue.status_changed',
        message: `moved ${issue.issueKey} to ${issue.status === 'done' ? 'Done' : 'In Progress'}`,
        field: 'status',
        from: 'todo',
        to: issue.status,
      });
    }
  }
  await Project.updateOne({ _id: project._id }, { $set: { issueCounter: ISSUES.length } });

  // A couple of issues in the second project so the project selector has data.
  const appIssue = await Issue.create({
    project: secondProject._id,
    issueNumber: 1,
    issueKey: `${secondProject.key}-1`,
    title: 'Offline mode: queued issues never sync back',
    description: 'Queued mutations are dropped when the app is cold-started.',
    type: 'bug',
    priority: 'critical',
    status: 'in-progress',
    priorityRank: PRIORITY_WEIGHT.critical,
    reporter: users[2]._id,
    assignee: users[1]._id,
    labels: ['offline', 'sync'],
    dueDate: new Date(Date.now() + 3 * 86400000),
  });
  await Project.updateOne({ _id: secondProject._id }, { $set: { issueCounter: 1 } });
  await recordActivity({
    project: secondProject._id,
    issue: appIssue._id,
    actor: users[2]._id,
    action: 'issue.created',
    message: `created issue ${appIssue.issueKey}`,
    to: appIssue.title,
  });

  for (const c of COMMENTS) {
    await Comment.create({
      issue: createdIssues[c.issueIndex]._id,
      project: project._id,
      author: users[c.authorIndex]._id,
      content: c.content,
    });
    await recordActivity({
      project: project._id,
      issue: createdIssues[c.issueIndex]._id,
      actor: users[c.authorIndex]._id,
      action: 'comment.added',
      message: `commented on ${createdIssues[c.issueIndex].issueKey}`,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `   • ${ISSUES.length + 1} issues, ${COMMENTS.length} comments, activity timeline created`,
  );
  // eslint-disable-next-line no-console
  console.log('\n✅ Seed complete. Demo logins (development only):');
  DEMO_USERS.forEach((u) =>
    console.log(`   ${u.role.padEnd(6)} ${u.email}  /  ${env.SEED_DEMO_PASSWORD}`),
  );
}

export async function seed(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding IssueTrack demo data…');
  await connectDatabase();
  await populateSeedData();
  await disconnectDatabase();
  await mongoose.connection.close().catch(() => undefined);
}

if (process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'))) {
  seed()
    .then(() => process.exit(0))
    .catch(async (error) => {
      // eslint-disable-next-line no-console
      console.error('❌ Seed failed', error);
      await disconnectDatabase().catch(() => undefined);
      process.exit(1);
    });
}
