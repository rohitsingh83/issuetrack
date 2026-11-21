import type { Server } from 'socket.io';
import { env } from '../config/env';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { verifyAuthToken } from '../utils/jwt';
import { projectRoom, setSocketServer } from './emitter';

interface SocketUser {
  userId: string;
  name: string;
}

/**
 * Registers Socket.io authentication + project room subscriptions.
 * The client authenticates with the same httpOnly cookie (or auth.token) used
 * by the REST API, then joins one room per project it belongs to.
 */
export function initSocket(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const cookies = Object.fromEntries(
        cookieHeader
          .split(';')
          .map((part) => part.trim().split('='))
          .filter((pair) => pair.length === 2)
          .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
      );
      const bearer = (socket.handshake.auth?.token as string | undefined) ?? undefined;
      const token = bearer || cookies[env.COOKIE_NAME];
      if (!token) return next(new Error('UNAUTHORIZED'));

      const payload = verifyAuthToken(token);
      const user = await User.findById(payload.sub).select('name email');
      if (!user) return next(new Error('UNAUTHORIZED'));

      (socket.data as SocketUser & { userId: string }).userId = String(user._id);
      (socket.data as SocketUser & { userId: string }).name = user.name;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data as SocketUser;
    socket.join(`user:${userId}`);

    try {
      const projects = await Project.find({ $or: [{ owner: userId }, { 'members.user': userId }] })
        .select('_id')
        .lean();
      projects.forEach((p) => socket.join(projectRoom(String(p._id))));
      socket.emit('connected', { userId, projectIds: projects.map((p) => String(p._id)) });
    } catch {
      socket.emit('connected', { userId, projectIds: [] });
    }

    // Allow the client to join a project room immediately after creating a project.
    socket.on('join:project', (projectId: string) => {
      if (typeof projectId === 'string' && /^[0-9a-fA-F]{24}$/.test(projectId)) {
        socket.join(projectRoom(projectId));
      }
    });
    socket.on('leave:project', (projectId: string) => {
      if (typeof projectId === 'string') socket.leave(projectRoom(projectId));
    });
  });

  setSocketServer(io);
}
