import request from 'supertest';
import { app, registerUser } from './helpers';
import { isOriginAllowed } from '../src/config/env';

/**
 * The browser origin allow-list is what makes cookies (and therefore login)
 * work when the SPA is served from a different host than the API.
 */
describe('CORS origin policy', () => {
  it('accepts the configured CLIENT_ORIGIN and echoes it back with credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'nobody@test.dev', password: 'Password123!' });

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.status).toBe(401); // credentials, not CORS, are the only problem here
  });

  it('accepts origins matching a wildcard pattern (preview hosts)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://5173-abc123.preview.test')
      .send({ email: 'nobody@test.dev', password: 'Password123!' });

    expect(res.headers['access-control-allow-origin']).toBe('https://5173-abc123.preview.test');
    expect(res.status).toBe(401);
  });

  it('rejects an unknown origin with a diagnosable 403 instead of a generic 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'nobody@test.dev', password: 'Password123!' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_NOT_ALLOWED');
    expect(res.body.error.message).toContain('CLIENT_ORIGIN');
  });

  it('allows requests without an Origin header (curl, server-to-server)', async () => {
    const user = await registerUser({ email: 'originless@test.dev' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('originless@test.dev');
  });

  it('matches wildcard patterns without allowing look-alike hosts', () => {
    expect(isOriginAllowed('https://5173-abc.preview.test')).toBe(true);
    expect(isOriginAllowed('https://preview.test.evil.com')).toBe(false);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('http://localhost:5174')).toBe(false);
    expect(isOriginAllowed(undefined)).toBe(true);
  });
});
