import type { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';

export async function dashboardHandler(req: Request, res: Response) {
  const data = await getDashboard(String(req.user!._id));
  return sendSuccess(res, data);
}
