/**
 * Vercel serverless entry for the IssueTrack API.
 *
 * Vercel routes every `/api/*` request here (see the root vercel.json). We reuse
 * the exact Express app from /server, connect to MongoDB once per warm
 * instance, and seed the demo dataset the first time the database is empty so
 * the live site's one-click demo accounts work out of the box.
 *
 * Socket.io needs a long-lived server, so realtime is disabled on Vercel; the
 * client is built with VITE_REALTIME=off and every mutation still refreshes the
 * UI through TanStack Query.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server/src/app';
import { connectDatabase } from '../server/src/config/db';
import { User } from '../server/src/models/User';
import { populateSeedData } from '../server/src/seed/seed';

const app = createApp();
let ready: Promise<void> | null = null;

async function prepare(): Promise<void> {
  await connectDatabase();
  if ((await User.estimatedDocumentCount()) === 0) {
    await populateSeedData();
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    ready ??= prepare();
    await ready;
  } catch (error) {
    ready = null; // retry on the next request instead of caching the failure
    // eslint-disable-next-line no-console
    console.error('Database connection failed', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: { message: 'Database is unavailable, please try again shortly', code: 'DB_UNAVAILABLE' },
      }),
    );
    return;
  }
  return app(req as never, res as never);
}
