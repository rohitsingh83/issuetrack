import request from 'supertest';
import { app, registerUser } from './helpers';
import { signInWithClerkIdentity } from '../src/services/clerk.service';
import { User } from '../src/models/User';

describe('Clerk sign-in', () => {
  it('reports which sign-in providers are available', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ password: true, clerk: false });
  });

  it('refuses a bare email — the old "trust the browser" bypass', async () => {
    const res = await request(app).post('/api/auth/clerk').send({ email: 'victim@test.dev' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('answers 503 when the server has no Clerk secret key configured', async () => {
    const res = await request(app)
      .post('/api/auth/clerk')
      .send({ token: 'eyJhbGciOiJSUzI1NiJ9.fake.token-value' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('CLERK_DISABLED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('creates a local account for a new verified Clerk identity', async () => {
    const result = await signInWithClerkIdentity({
      clerkUserId: 'user_123',
      email: 'newcomer@test.dev',
      name: 'New Comer',
      avatarUrl: 'https://img.clerk.com/a.png',
    });
    expect(result.token).toEqual(expect.any(String));
    expect(result.user).toMatchObject({ email: 'newcomer@test.dev', name: 'New Comer' });
    expect(await User.countDocuments({ email: 'newcomer@test.dev' })).toBe(1);
  });

  it('links a verified Clerk identity to the existing account with the same email', async () => {
    const user = await registerUser({ email: 'existing@test.dev', name: 'Existing User' });
    const result = await signInWithClerkIdentity({
      clerkUserId: 'user_456',
      email: 'existing@test.dev',
      name: 'Different Name',
      avatarUrl: null,
    });
    expect(result.user.id).toBe(user.id);
    expect(result.user.name).toBe('Existing User');
    expect(await User.countDocuments({ email: 'existing@test.dev' })).toBe(1);
  });
});
