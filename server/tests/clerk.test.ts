import request from 'supertest';
import { app, registerUser } from './helpers';
import crypto from 'crypto';
import { identityFromSignedToken, signInWithClerkIdentity } from '../src/services/clerk.service';

/** Minimal RS256 JWT signer so the public-key path is tested with real signatures. */
function signJwt(payload: Record<string, unknown>, privateKey: crypto.KeyObject): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  // `cat` marks a Clerk *session* token (as opposed to a JWT-template or M2M token).
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test', cat: 'cl_B7d4PD111AAA' };
  const body = `${enc(header)}.${enc(payload)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
  return `${body}.${signature}`;
}
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const origin = 'http://localhost:5173';
const claims = (extra: Record<string, unknown> = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return { sub: 'user_abc', azp: origin, iat: now - 5, nbf: now - 5, exp: now + 60, ...extra };
};
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

  describe('public-key verification (no secret key on the server)', () => {
    it('reads the identity from a correctly signed session token', async () => {
      const token = signJwt(
        claims({ email: 'Grace@Test.dev', name: 'Grace Hopper', picture: 'https://img/x.png' }),
        keys.privateKey,
      );
      await expect(identityFromSignedToken(token, publicPem, [origin])).resolves.toEqual({
        clerkUserId: 'user_abc',
        email: 'grace@test.dev',
        name: 'Grace Hopper',
        avatarUrl: 'https://img/x.png',
      });
    });

    it('rejects a token signed with a different key (forged claims)', async () => {
      const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const forged = signJwt(claims({ email: 'owner@demo.dev' }), attacker.privateKey);
      await expect(identityFromSignedToken(forged, publicPem, [origin])).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejects a valid token that carries no email claim', async () => {
      const token = signJwt(claims(), keys.privateKey);
      await expect(identityFromSignedToken(token, publicPem, [origin])).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('rejects a token minted for another site (authorized party mismatch)', async () => {
      const token = signJwt(claims({ email: 'a@b.dev', azp: 'https://evil.example' }), keys.privateKey);
      await expect(identityFromSignedToken(token, publicPem, [origin])).rejects.toMatchObject({
        statusCode: 401,
      });
    });
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
