import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export interface FileTokenPayload {
  attachmentId: string;
  issueId: string;
  purpose: 'attachment';
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'issuetrack',
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'issuetrack' }) as JwtPayload &
      AuthTokenPayload;
    if (!decoded.sub) throw new Error('missing subject');
    return { sub: String(decoded.sub), email: decoded.email, name: decoded.name };
  } catch {
    throw ApiError.unauthorized('Your session is invalid or has expired. Please sign in again.');
  }
}

/** Short-lived signed token that grants read access to a single attachment. */
export function signFileToken(attachmentId: string, issueId: string): string {
  return jwt.sign(
    { attachmentId, issueId, purpose: 'attachment' } satisfies FileTokenPayload,
    env.JWT_SECRET,
    {
      expiresIn: env.FILE_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: 'issuetrack',
    },
  );
}

export function verifyFileToken(token: string, attachmentId: string, issueId: string): void {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'issuetrack' }) as JwtPayload &
      FileTokenPayload;
    if (
      decoded.purpose !== 'attachment' ||
      decoded.attachmentId !== attachmentId ||
      decoded.issueId !== issueId
    ) {
      throw new Error('token mismatch');
    }
  } catch {
    throw ApiError.unauthorized('Attachment link is invalid or has expired.');
  }
}
