import request from 'supertest';
import { addMember, app, createIssue, createProject, registerUser } from './helpers';

describe('Comments & collaboration permissions', () => {
  async function setup() {
    const owner = await registerUser();
    const member = await registerUser();
    const viewer = await registerUser();
    const project = await createProject(owner, { key: 'CMT' });
    await addMember(owner, project.id, member.email, 'member');
    await addMember(owner, project.id, viewer.email, 'viewer');
    const issue = await createIssue(owner, project.id, { title: 'Commentable issue' });
    return { owner, member, viewer, project, issueId: issue.body.data.id as string };
  }

  it('adds comments and returns them in chronological order with author details', async () => {
    const { owner, issueId } = await setup();

    const first = await owner.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'First thought' });
    expect(first.status).toBe(201);
    expect(first.body.data.author.email).toBe(owner.email);
    expect(first.body.data.edited).toBe(false);

    await owner.agent.post(`/api/issues/${issueId}/comments`).send({ content: 'Second thought' });

    const list = await owner.agent.get(`/api/issues/${issueId}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { content: string }) => c.content)).toEqual([
      'First thought',
      'Second thought',
    ]);
  });

  it('rejects empty comments', async () => {
    const { owner, issueId } = await setup();
    const res = await owner.agent.post(`/api/issues/${issueId}/comments`).send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('blocks viewers from commenting', async () => {
    const { viewer, issueId } = await setup();
    const res = await viewer.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'Read only' });
    expect(res.status).toBe(403);
  });

  it('lets members comment', async () => {
    const { member, issueId } = await setup();
    const res = await member.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'On it' });
    expect(res.status).toBe(201);
  });

  it('allows only the author to edit a comment', async () => {
    const { owner, member, issueId } = await setup();
    const created = await owner.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'Original' });

    const otherEdit = await member.agent
      .patch(`/api/issues/${issueId}/comments/${created.body.data.id}`)
      .send({ content: 'Hijacked' });
    expect(otherEdit.status).toBe(403);

    const ownEdit = await owner.agent
      .patch(`/api/issues/${issueId}/comments/${created.body.data.id}`)
      .send({ content: 'Edited content' });
    expect(ownEdit.status).toBe(200);
    expect(ownEdit.body.data.content).toBe('Edited content');
    expect(ownEdit.body.data.edited).toBe(true);
  });

  it('lets authors and admins/owners delete comments, but not unrelated members', async () => {
    const { owner, member, issueId } = await setup();
    const memberComment = await member.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'Member note' });
    const ownerComment = await owner.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'Owner note' });

    const memberDeleteOwner = await member.agent.delete(
      `/api/issues/${issueId}/comments/${ownerComment.body.data.id}`,
    );
    expect(memberDeleteOwner.status).toBe(403);

    const memberDeleteOwn = await member.agent.delete(
      `/api/issues/${issueId}/comments/${memberComment.body.data.id}`,
    );
    expect(memberDeleteOwn.status).toBe(200);

    const ownerDeleteMember = await owner.agent.delete(
      `/api/issues/${issueId}/comments/${ownerComment.body.data.id}`,
    );
    expect(ownerDeleteMember.status).toBe(200);
  });

  it('is scoped to the issue that owns the comment', async () => {
    const { owner, project, issueId } = await setup();
    const otherIssue = await createIssue(owner, project.id, { title: 'Another issue' });
    const comment = await owner.agent
      .post(`/api/issues/${issueId}/comments`)
      .send({ content: 'Scoped' });

    const res = await owner.agent.delete(
      `/api/issues/${otherIssue.body.data.id}/comments/${comment.body.data.id}`,
    );
    expect(res.status).toBe(404);
  });

  it('keeps comments private to project members', async () => {
    const { issueId } = await setup();
    const outsider = await registerUser();
    const res = await outsider.agent.get(`/api/issues/${issueId}/comments`);
    expect(res.status).toBe(403);
  });
});

describe('Attachments', () => {
  async function setupAttachment() {
    const owner = await registerUser();
    const project = await createProject(owner, { key: 'ATT' });
    const issue = await createIssue(owner, project.id, { title: 'With screenshot' });
    return { owner, project, issueId: issue.body.data.id as string };
  }

  it('uploads an image, exposes a signed URL and streams it back', async () => {
    const { owner, issueId } = await setupAttachment();

    const upload = await owner.agent
      .post(`/api/issues/${issueId}/attachments`)
      .attach('files', Buffer.from('89504e470d0a1a0a', 'hex'), {
        filename: 'screenshot.png',
        contentType: 'image/png',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.data.attachments).toHaveLength(1);
    const attachment = upload.body.data.attachments[0];
    expect(attachment.originalName).toBe('screenshot.png');
    expect(attachment.url).toContain('token=');

    const file = await request(app).get(attachment.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');

    const unsigned = await request(app).get(`/api/issues/${issueId}/attachments/${attachment.id}`);
    expect(unsigned.status).toBe(401);
  });

  it('rejects unsupported file types', async () => {
    const { owner, issueId } = await setupAttachment();
    const res = await owner.agent
      .post(`/api/issues/${issueId}/attachments`)
      .attach('files', Buffer.from('#!/bin/sh'), {
        filename: 'evil.sh',
        contentType: 'application/x-sh',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('deletes an attachment', async () => {
    const { owner, issueId } = await setupAttachment();
    const upload = await owner.agent
      .post(`/api/issues/${issueId}/attachments`)
      .attach('files', Buffer.from('fake-image'), {
        filename: 'shot.jpg',
        contentType: 'image/jpeg',
      });

    const attachmentId = upload.body.data.attachments[0].id;
    const removed = await owner.agent.delete(`/api/issues/${issueId}/attachments/${attachmentId}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.attachments).toHaveLength(0);
  });

  it('blocks non-members from uploading', async () => {
    const { issueId } = await setupAttachment();
    const outsider = await registerUser();
    const res = await outsider.agent
      .post(`/api/issues/${issueId}/attachments`)
      .attach('files', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
