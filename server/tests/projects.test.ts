import { addMember, createProject, createIssue, registerUser } from './helpers';

describe('Projects & role-based authorization', () => {
  it('creates a project with the creator as owner and lists it for members only', async () => {
    const owner = await registerUser();
    const outsider = await registerUser();

    const res = await owner.agent
      .post('/api/projects')
      .send({ name: 'Apollo Platform', key: 'apollo', description: 'Core services' });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('APOLLO');
    expect(res.body.data.role).toBe('owner');
    expect(res.body.data.members).toHaveLength(1);

    const ownList = await owner.agent.get('/api/projects');
    expect(ownList.body.data).toHaveLength(1);

    const outsiderList = await outsider.agent.get('/api/projects');
    expect(outsiderList.body.data).toHaveLength(0);

    const forbidden = await outsider.agent.get(`/api/projects/${res.body.data.id}`);
    expect(forbidden.status).toBe(403);
  });

  it('validates the project key format and rejects duplicates', async () => {
    const user = await registerUser();
    const invalid = await user.agent.post('/api/projects').send({ name: 'Bad key', key: '1BAD!' });
    expect(invalid.status).toBe(400);

    await user.agent.post('/api/projects').send({ name: 'First', key: 'DUP' }).expect(201);
    const dup = await user.agent.post('/api/projects').send({ name: 'Second', key: 'DUP' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already in use/i);
  });

  it('adds members by email and only admins/owners can manage them', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const viewer = await registerUser();
    const project = await createProject(owner, { key: 'TEAM' });

    const added = await addMember(owner, project.id, member.email, 'member');
    expect(added.status).toBe(201);
    expect(added.body.data.members).toHaveLength(2);

    // member cannot add other members
    const denied = await addMember(member, project.id, viewer.email, 'viewer');
    expect(denied.status).toBe(403);

    // unknown email
    const unknown = await addMember(owner, project.id, 'ghost@test.dev', 'member');
    expect(unknown.status).toBe(404);

    // duplicate member
    const twice = await addMember(owner, project.id, member.email, 'member');
    expect(twice.status).toBe(409);

    // newly added member can read the project
    const read = await member.agent.get(`/api/projects/${project.id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.role).toBe('member');
  });

  it('enforces role changes and refuses to alter the owner', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const project = await createProject(owner, { key: 'ROLE' });
    await addMember(owner, project.id, member.email, 'member');

    const promoted = await owner.agent
      .patch(`/api/projects/${project.id}/members/${member.id}`)
      .send({ role: 'admin' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.members.find((m: { id: string }) => m.id === member.id).role).toBe(
      'admin',
    );

    const ownerRole = await owner.agent
      .patch(`/api/projects/${project.id}/members/${owner.id}`)
      .send({ role: 'member' });
    expect(ownerRole.status).toBe(400);

    // A freshly-promoted admin may not hand out the owner role (ownership transfer is out of scope)
    const selfPromote = await member.agent
      .patch(`/api/projects/${project.id}/members/${member.id}`)
      .send({ role: 'owner' });
    expect(selfPromote.status).toBe(400);
    expect(selfPromote.body.error.message).toMatch(/[Oo]wnership/);

    // A plain member cannot patch roles at all
    const plainMember = await registerUser();
    await addMember(owner, project.id, plainMember.email, 'member');
    const plainDenied = await plainMember.agent
      .patch(`/api/projects/${project.id}/members/${member.id}`)
      .send({ role: 'member' });
    expect(plainDenied.status).toBe(403);
  });

  it('removes members and unassigns them from issues', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const project = await createProject(owner, { key: 'RMV' });
    await addMember(owner, project.id, member.email, 'member');

    const created = await createIssue(owner, project.id, { assignee: member.id });
    expect(created.status).toBe(201);
    expect(created.body.data.assignee.id).toBe(member.id);

    const removed = await owner.agent.delete(`/api/projects/${project.id}/members/${member.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.members).toHaveLength(1);

    const issue = await owner.agent.get(`/api/issues/${created.body.data.id}`);
    expect(issue.body.data.assignee).toBeNull();

    const denied = await member.agent.get(`/api/projects/${project.id}`);
    expect(denied.status).toBe(403);
  });

  it('only lets the owner delete a project and cascades related data', async () => {
    const owner = await registerUser();
    const admin = await registerUser();
    const project = await createProject(owner, { key: 'DEL' });
    await addMember(owner, project.id, admin.email, 'admin');
    const issue = await createIssue(owner, project.id);

    const denied = await admin.agent.delete(`/api/projects/${project.id}`);
    expect(denied.status).toBe(403);

    const deleted = await owner.agent.delete(`/api/projects/${project.id}`);
    expect(deleted.status).toBe(200);

    const gone = await owner.agent.get(`/api/issues/${issue.body.data.id}`);
    expect(gone.status).toBe(404);
  });

  it('lets admins edit project details but not viewers or members', async () => {
    const owner = await registerUser();
    const admin = await registerUser();
    const member = await registerUser();
    const project = await createProject(owner, { key: 'EDIT' });
    await addMember(owner, project.id, admin.email, 'admin');
    await addMember(owner, project.id, member.email, 'member');

    const adminEdit = await admin.agent
      .patch(`/api/projects/${project.id}`)
      .send({ name: 'Renamed by admin' });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.name).toBe('Renamed by admin');

    const memberEdit = await member.agent
      .patch(`/api/projects/${project.id}`)
      .send({ name: 'Nope' });
    expect(memberEdit.status).toBe(403);
  });

  it('records project activity for auditing', async () => {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'AUDIT' });
    const res = await owner.agent.get(`/api/projects/${project.id}/activity`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].action).toBe('project.created');
    expect(res.body.data[0].actor.email).toBe(owner.email);
  });
});
