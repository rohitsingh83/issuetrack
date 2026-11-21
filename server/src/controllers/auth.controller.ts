import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { clearAuthCookie, setAuthCookie } from '../utils/cookies';
import { sendCreated, sendSuccess } from '../utils/response';
import { validated } from '../middleware/validate';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export async function register(req: Request, res: Response) {
  const body = validated<RegisterBody>(req.validated.body);
  const result = await authService.registerUser(body);
  setAuthCookie(res, result.token);
  return sendCreated(res, { user: result.user, token: result.token });
}

export async function login(req: Request, res: Response) {
  const body = validated<LoginBody>(req.validated.body);
  const result = await authService.loginUser(body);
  setAuthCookie(res, result.token);
  return sendSuccess(res, { user: result.user, token: result.token });
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  return sendSuccess(res, { message: 'Signed out successfully' });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getCurrentUser(String(req.user!._id));
  return sendSuccess(res, { user });
}
