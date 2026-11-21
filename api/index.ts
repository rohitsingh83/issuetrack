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
import { Project } from '../server/src/models/Project';
import { populateSeedData } from '../server/src/seed/seed';

const app = createApp();
let ready: Promise<void> | null = null;

const SEED_LOCK_ID = 'demo-seed-v1';

/**
 * Seeds the demo dataset exactly once per database. Several cold-starting
 * instances can race here, so a unique lock document decides the single winner;
 * everyone else skips. If seeding fails the lock is released for a retry.
 */
async function seedOnce(): Promise<void> {
  const demoProjectExists = await Project.exists({ key: 'WEB' });
  if (demoProjectExists) return;

  // Use the model's connection: /api has no node_modules of its own.
  const meta = Project.db.collection<{ _id: string; at: Date }>('_meta');
  try {
    await meta.insertOne({ _id: SEED_LOCK_ID, at: new Date() });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return; // another instance owns the seed
    throw error;
  }

  try {
    await populateSeedData();
  } catch (error) {
    await meta.deleteOne({ _id: SEED_LOCK_ID });
    throw error;
  }
}

async function prepare(): Promise<void> {
  await connectDatabase();
  try {
    await seedOnce();
  } catch (error) {
    // Never block the API because demo data could not be created.
    // eslint-disable-next-line no-console
    console.error('Demo seed failed', error);
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
