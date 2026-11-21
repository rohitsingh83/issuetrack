import crypto from 'crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { allowedOrigins, env, isClerkEnabled } from '../config/env';
import { User } from '../models/User';
import { serializeUser } from '../serializers';
import { ApiError } from '../utils/ApiError';
import { signAuthToken } from '../utils/jwt';
import type { AuthResult } from './auth.service';

/** Minimal shape of the Clerk user we rely on (keeps tests free of the SDK types). */
export interface ClerkIdentity {
  clerkUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Verifies a Clerk session token **server-side** and returns the user's verified
 * primary email. The browser never gets to choose which account it signs into:
 * the token signature, expiry and authorised party are checked against Clerk,
 * and the email comes from Clerk's Backend API, not from the request body.
 */
export async function resolveClerkIdentity(sessionToken: string): Promise<ClerkIdentity> {
  if (!isClerkEnabled) {
    throw new ApiError(503, 'Clerk sign-in is not configured on this server', 'CLERK_DISABLED');
  }

  let clerkUserId: string;
  try {
    const payload = await verifyToken(sessionToken, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: allowedOrigins,
    });
    clerkUserId = payload.sub;
  } catch {
    throw ApiError.unauthorized('Your Clerk session is invalid or has expired');
  }

  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const primary =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ??
    clerkUser.emailAddresses[0];

  if (!primary || primary.verification?.status !== 'verified') {
    throw ApiError.forbidden('Your Clerk account has no verified email address');
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
    clerkUser.username ||
    primary.emailAddress.split('@')[0];

  return {
    clerkUserId,
    email: primary.emailAddress.toLowerCase().trim(),
    name,
    avatarUrl: clerkUser.imageUrl || null,
  };
}

/** Finds (or creates) the local account for a verified Clerk identity and issues our JWT. */
export async function signInWithClerkIdentity(identity: ClerkIdentity): Promise<AuthResult> {
  let user = await User.findOne({ email: identity.email });
  if (!user) {
    // Clerk-only accounts get an unguessable password; they can set one later from Profile.
    const passwordHash = await User.hashPassword(crypto.randomBytes(32).toString('hex'));
    user = await User.create({
      name: identity.name.trim().length >= 2 ? identity.name.trim().slice(0, 80) : 'New user',
      email: identity.email,
      passwordHash,
      avatarUrl: identity.avatarUrl,
    });
  } else if (!user.avatarUrl && identity.avatarUrl) {
    user.avatarUrl = identity.avatarUrl;
    await user.save();
  }

  const token = signAuthToken({ sub: String(user._id), email: user.email, name: user.name });
  return { user: serializeUser(user), token };
}

export async function loginWithClerkToken(sessionToken: string): Promise<AuthResult> {
  const identity = await resolveClerkIdentity(sessionToken);
  return signInWithClerkIdentity(identity);
}
