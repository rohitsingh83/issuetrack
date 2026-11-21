import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { allowedOrigins, allowedOriginPatterns, env, isOriginAllowed, isTest } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { initSocket } from './realtime/socket';
import { User } from './models/User';
import { populateSeedData } from './seed/seed';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // If newly initialized database has 0 users, auto-seed demo data
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // eslint-disable-next-line no-console
      console.log('🌱 Newly created database is empty. Auto-seeding initial demo data...');
      await populateSeedData();
    }
  } catch (seedErr) {
    // eslint-disable-next-line no-console
    console.warn('Auto-seed check notice:', seedErr);
  }

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed for Socket.io connections'));
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  initSocket(io);

  server.listen(env.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 IssueTrack API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    // eslint-disable-next-line no-console
    console.log(
      `   Allowed origins: ${[...allowedOrigins, ...allowedOriginPatterns].join(', ') || '(none)'}`,
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — shutting down`);
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (!isTest) {
  bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to start server', error);
    process.exit(1);
  });
}

export { bootstrap };
