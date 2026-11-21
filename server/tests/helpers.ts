import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Express } from 'express';
import { createApp } from '../src/app';

export const app: Express = createApp();

export interface AuthUser {
  token: string;
  id: string;
  email: string;
  name: string;
  agent: TestAgent<request.Test>;
}

let counter = 0;

/** Registers a unique user and returns a cookie-carrying supertest agent. */
export async function registerUser(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<AuthUser> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@test.dev`;
  const password = overrides.password ?? 'Password123!';
  const name = overrides.name ?? `Test User ${counter}`;

  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);

  return { token: res.body.data.token, id: res.body.data.user.id, email, name, agent };
}

export async function createProject(
  user: AuthUser,
  overrides: Partial<{ name: string; key: string; description: string }> = {},
) {
  counter += 1;
  const key =
    overrides.key ?? `P${counter}${Date.now().toString().slice(-4)}`.slice(0, 8).toUpperCase();
  const res = await user.agent.post('/api/projects').send({
    name: overrides.name ?? `Project ${counter}`,
    key,
    description: overrides.description ?? 'Test project',
  });
  if (res.status !== 201) {
    throw new Error(`createProject failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { id: string; key: string; name: string };
}

export async function addMember(
  owner: AuthUser,
  projectId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer' = 'member',
) {
  return owner.agent.post(`/api/projects/${projectId}/members`).send({ email, role });
}

export async function createIssue(
  user: AuthUser,
  projectId: string,
  body: Partial<{
    title: string;
    description: string;
    type: string;
    priority: string;
    status: string;
    assignee: string;
    labels: string[];
    dueDate: string;
  }> = {},
) {
  const res = await user.agent.post(`/api/projects/${projectId}/issues`).send({
    title: body.title ?? 'A reproducible bug',
    description: body.description ?? 'Steps to reproduce…',
    type: body.type ?? 'bug',
    priority: body.priority ?? 'medium',
    status: body.status ?? 'todo',
    labels: body.labels ?? [],
    ...(body.assignee ? { assignee: body.assignee } : {}),
    ...(body.dueDate ? { dueDate: body.dueDate } : {}),
  });
  return res;
}
