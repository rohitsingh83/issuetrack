import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { validated } from '../middleware/validate';
import { sendSuccess } from '../utils/response';

export async function getMe(req: Request, res: Response) {
  const user = await authService.getCurrentUser(String(req.user!._id));
  return sendSuccess(res, { user });
}

export async function updateMe(req: Request, res: Response) {
  const body = validated<{
    name?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }>(req.validated.body);
  const user = await authService.updateProfile(req.user!, body);
  return sendSuccess(res, { user });
}

export async function lookup(req: Request, res: Response) {
  const email = String(req.query.email ?? '').trim();
  if (!email) throw ApiError.badRequest('An email query parameter is required');
  const user = await authService.lookupUserByEmail(email);
  return sendSuccess(res, { user });
}

export async function search(req: Request, res: Response) {
  const query = String(req.query.q ?? '').trim();
  if (query.length < 2) return sendSuccess(res, { users: [] });
  const users = await authService.searchUsers(query);
  return sendSuccess(res, { users });
}
