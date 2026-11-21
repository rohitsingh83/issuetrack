import type { Server } from 'socket.io';

/**
 * Thin indirection so services can broadcast without importing the HTTP server
 * (which would create a circular dependency and make unit testing painful).
 */
let io: Server | null = null;

export function setSocketServer(server: Server | null): void {
  io = server;
}

export function getSocketServer(): Server | null {
  return io;
}

export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

export function emitToProject(projectId: string, event: string, payload: unknown): void {
  io?.to(projectRoom(projectId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
