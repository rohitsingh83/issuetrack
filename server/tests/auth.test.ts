import request from 'supertest';
import { app, registerUser } from './helpers';

describe('Authentication', () => {
  const credentials = { name: 'Dana Kim', email: 'dana@test.dev', password: 'Password123!' };

  it('registers a new user and sets an httpOnly cookie without leaking the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ name: 'Dana Kim', email: 'dana@test.dev' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2a$');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/it_token=/);
    expect(cookies.join(';')).toMatch(/HttpOnly/i);
  });

  it('rejects duplicate email registrations with 409', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const res = await request(app).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates the registration payload with field-level errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details).toEqual(
      expect.objectContaining({
        name: expect.any(Array),
        email: expect.any(Array),
        password: expect.any(Array),
      }),
    );
  });

  it('logs in with valid credentials and returns the current user', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);

    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(credentials.email);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(credentials.email);
  });

  it('rejects an invalid password with 401 and a generic message', async () => {
    const user = await registerUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
    expect(res.body.error).not.toHaveProperty('stack');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('protects authenticated endpoints', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered token', async () => {
    const user = await registerUser();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}tampered`);
    expect(res.status).toBe(401);
  });

  it('logs out by clearing the session cookie', async () => {
    const user = await registerUser();
    const res = await user.agent.post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/it_token=;/);

    const me = await user.agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('updates the profile and enforces password re-authentication', async () => {
    const user = await registerUser();
    const ok = await user.agent.patch('/api/users/me').send({ name: 'Renamed User' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.name).toBe('Renamed User');

    const bad = await user.agent
      .patch('/api/users/me')
      .send({ currentPassword: 'nope', newPassword: 'NewPassword123' });
    expect(bad.status).toBe(400);

    const good = await user.agent
      .patch('/api/users/me')
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123' });
    expect(good.status).toBe(200);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewPassword123' });
    expect(relogin.status).toBe(200);
  });
});
