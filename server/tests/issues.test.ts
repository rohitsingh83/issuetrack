import { addMember, createIssue, createProject, registerUser } from './helpers';

describe('Issue CRUD, filtering and Kanban status updates', () => {
  it('generates sequential project-scoped issue keys', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'BUG' });

    const first = await createIssue(owner, project.id, { title: 'First defect' });
    const second = await createIssue(owner, project.id, { title: 'Second defect' });

    expect(first.status).toBe(201);
    expect(first.body.data.issueKey).toBe('BUG-1');
    expect(first.body.data.issueNumber).toBe(1);
    expect(second.body.data.issueKey).toBe('BUG-2');
  });

  it('rejects invalid issue payloads', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'VAL' });
    const res = await owner.agent
      .post(`/api/projects/${project.id}/issues`)
      .send({ title: 'ab', priority: 'urgent', status: 'blocked' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.objectContaining({
        title: expect.any(Array),
        priority: expect.any(Array),
        status: expect.any(Array),
      }),
    );
  });

  it('requires the assignee to be a project member', async () => {
    const owner = await registerUser();
    const outsider = await registerUser();
    const project = await createProject(owner, { key: 'ASG' });

    const res = await createIssue(owner, project.id, { assignee: outsider.id });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/member of this project/i);
  });

  it('supports full issue updates and logs meaningful activity', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'UPD' });
    const created = await createIssue(owner, project.id, { title: 'Old title', priority: 'low' });

    const patched = await owner.agent.patch(`/api/issues/${created.body.data.id}`).send({
      title: 'New title',
      priority: 'critical',
      status: 'in-progress',
      labels: ['regression', 'ui'],
      assignee: owner.id,
      dueDate: '2030-01-01',
    });

    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({
      title: 'New title',
      priority: 'critical',
      status: 'in-progress',
      labels: ['regression', 'ui'],
    });
    expect(patched.body.data.assignee.id).toBe(owner.id);
    expect(patched.body.data.dueDate).toContain('2030-01-01');

    const activity = await owner.agent.get(`/api/issues/${created.body.data.id}/activity`);
    const actions = activity.body.data.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'issue.created',
        'issue.updated',
        'issue.status_changed',
        'issue.priority_changed',
        'issue.assigned',
      ]),
    );
  });

  it('moves an issue between Kanban columns through the status endpoint', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'KAN' });
    const created = await createIssue(owner, project.id);

    const moved = await owner.agent
      .patch(`/api/issues/${created.body.data.id}/status`)
      .send({ status: 'done' });
    expect(moved.status).toBe(200);
    expect(moved.body.data.status).toBe('done');

    const invalid = await owner.agent
      .patch(`/api/issues/${created.body.data.id}/status`)
      .send({ status: 'archived' });
    expect(invalid.status).toBe(400);

    const board = await owner.agent.get(`/api/projects/${project.id}/issues/board`);
    expect(board.status).toBe(200);
    expect(board.body.data[0].status).toBe('done');
  });

  it('filters by status, priority, type, label, assignee and free text', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'FLT' });

    await createIssue(owner, project.id, {
      title: 'Crash on checkout',
      priority: 'critical',
      type: 'bug',
      labels: ['checkout'],
    });
    await createIssue(owner, project.id, {
      title: 'Add dark mode',
      priority: 'low',
      type: 'story',
      labels: ['ui'],
      status: 'done',
    });
    await createIssue(owner, project.id, {
      title: 'Checkout copy tweak',
      priority: 'medium',
      type: 'task',
      labels: ['copy'],
      assignee: owner.id,
    });

    const byStatus = await owner.agent.get(`/api/projects/${project.id}/issues?status=done`);
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.meta.pagination.total).toBe(1);

    const byPriority = await owner.agent.get(
      `/api/projects/${project.id}/issues?priority=critical`,
    );
    expect(byPriority.body.data).toHaveLength(1);

    const byType = await owner.agent.get(`/api/projects/${project.id}/issues?type=story`);
    expect(byType.body.data[0].title).toBe('Add dark mode');

    const byLabel = await owner.agent.get(`/api/projects/${project.id}/issues?label=checkout`);
    expect(byLabel.body.data).toHaveLength(1);

    const assigned = await owner.agent.get(`/api/projects/${project.id}/issues?assignee=me`);
    expect(assigned.body.data).toHaveLength(1);

    const unassigned = await owner.agent.get(
      `/api/projects/${project.id}/issues?assignee=unassigned`,
    );
    expect(unassigned.body.data).toHaveLength(2);

    const search = await owner.agent.get(`/api/projects/${project.id}/issues?search=checkout`);
    expect(search.body.data).toHaveLength(2);

    const byKey = await owner.agent.get(`/api/projects/${project.id}/issues?search=FLT-2`);
    expect(byKey.body.data).toHaveLength(1);
  });

  it('supports multi-select filters, sorting and pagination metadata', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'PGN' });
    for (let i = 0; i < 7; i += 1) {
      await createIssue(owner, project.id, {
        title: `Issue number ${i}`,
        priority: i % 2 === 0 ? 'low' : 'critical',
      });
    }

    const page = await owner.agent.get(`/api/projects/${project.id}/issues?page=2&limit=3`);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(3);
    expect(page.body.meta.pagination).toMatchObject({ page: 2, limit: 3, total: 7, totalPages: 3 });

    const multi = await owner.agent.get(
      `/api/projects/${project.id}/issues?priority=low&priority=critical`,
    );
    expect(multi.body.meta.pagination.total).toBe(7);

    const sortedByPriority = await owner.agent.get(
      `/api/projects/${project.id}/issues?sort=priority`,
    );
    expect(sortedByPriority.body.data[0].priority).toBe('critical');

    const oldest = await owner.agent.get(`/api/projects/${project.id}/issues?sort=oldest`);
    expect(oldest.body.data[0].title).toBe('Issue number 0');
  });

  it('enforces role permissions on issues', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const viewer = await registerUser();
    const project = await createProject(owner, { key: 'PERM' });
    await addMember(owner, project.id, member.email, 'member');
    await addMember(owner, project.id, viewer.email, 'viewer');

    const ownerIssue = await createIssue(owner, project.id, { title: 'Owned by reporter' });
    expect(ownerIssue.status).toBe(201);

    // viewer is read-only
    const viewerRead = await viewer.agent.get(`/api/projects/${project.id}/issues`);
    expect(viewerRead.status).toBe(200);
    const viewerCreate = await createIssue(viewer, project.id, { title: 'Viewer attempt' });
    expect(viewerCreate.status).toBe(403);

    // member can create, but not edit an issue they neither reported nor are assigned to
    const memberCreate = await createIssue(member, project.id, { title: 'Member issue' });
    expect(memberCreate.status).toBe(201);
    const memberEditOthers = await member.agent
      .patch(`/api/issues/${ownerIssue.body.data.id}`)
      .send({ title: 'Hijacked' });
    expect(memberEditOthers.status).toBe(403);

    // member can edit their own issue
    const memberEditOwn = await member.agent
      .patch(`/api/issues/${memberCreate.body.data.id}`)
      .send({ title: 'Member updated own issue' });
    expect(memberEditOwn.status).toBe(200);

    // member cannot delete someone else's issue
    const memberDelete = await member.agent.delete(`/api/issues/${ownerIssue.body.data.id}`);
    expect(memberDelete.status).toBe(403);

    // admin/owner can
    const ownerDelete = await owner.agent.delete(`/api/issues/${memberCreate.body.data.id}`);
    expect(ownerDelete.status).toBe(200);
  });

  it('prevents cross-project access', async () => {
    const ownerA = await registerUser();
    const ownerB = await registerUser();
    const projectA = await createProject(ownerA, { key: 'PRVA' });
    const projectB = await createProject(ownerB, { key: 'PRVB' });
    const issueA = await createIssue(ownerA, projectA.id);

    const read = await ownerB.agent.get(`/api/issues/${issueA.body.data.id}`);
    expect(read.status).toBe(403);

    const write = await ownerB.agent
      .patch(`/api/issues/${issueA.body.data.id}`)
      .send({ title: 'hax' });
    expect(write.status).toBe(403);

    const del = await ownerB.agent.delete(`/api/issues/${issueA.body.data.id}`);
    expect(del.status).toBe(403);

    const projectScoped = await ownerB.agent.get(`/api/projects/${projectA.id}/issues`);
    expect(projectScoped.status).toBe(403);

    const crossList = await ownerB.agent.get(`/api/issues?project=${projectA.id}`);
    expect(crossList.status).toBe(403);

    const ownList = await ownerB.agent.get('/api/issues');
    expect(ownList.status).toBe(200);
    expect(ownList.body.meta.pagination.total).toBe(0);
    expect(projectB.id).toBeTruthy();
  });

  it('returns 404 for unknown issues and validates object ids', async () => {
    const owner = await registerUser();
    const res = await owner.agent.get('/api/issues/64b7f9f0a0123456789abcde');
    expect(res.status).toBe(404);

    const malformed = await owner.agent.get('/api/issues/not-an-id');
    expect(malformed.status).toBe(400);
  });

  it('lists only the caller’s projects on the cross-project endpoint', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const projectA = await createProject(owner, { key: 'XPRJ' });
    await createProject(owner, { key: 'YPRJ' });
    await addMember(owner, projectA.id, member.email, 'member');
    await createIssue(owner, projectA.id, { title: 'Visible to shared member' });

    const res = await member.agent.get('/api/issues');
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(1);
  });
});

describe('Issue detail payloads', () => {
  it('includes reporter, assignee, comment count and attachment links', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'DTL' });
    const created = await createIssue(owner, project.id, { assignee: owner.id });
    await owner.agent
      .post(`/api/issues/${created.body.data.id}/comments`)
      .send({ content: 'Looking into it' });

    const detail = await owner.agent.get(`/api/issues/${created.body.data.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.commentCount).toBe(1);
    expect(detail.body.data.reporter.email).toBe(owner.email);
    expect(detail.body.data.assignee.email).toBe(owner.email);
    expect(detail.body.data.projectKey).toBe('DTL');
  });
});
