import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { env, isTest } from './env';

mongoose.set('strictQuery', true);

interface TwinServerInstance {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

let twinServerInstance: TwinServerInstance | null = null;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  // If embedded database is already running, connect directly to it
  if (twinServerInstance) {
    const twinUrl = `${twinServerInstance.url}/${isTest ? 'issuetrack_test' : 'issuetrack'}`;
    await mongoose.connect(twinUrl, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    return mongoose;
  }

  try {
    // Attempt connecting to the configured URI (Atlas or local mongod)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1500,
      autoIndex: true,
    });
    if (!isTest) {
      // eslint-disable-next-line no-console
      console.log(`✅ MongoDB connected (${mongoose.connection.name})`);
    }
    return mongoose;
  } catch (err: unknown) {
    // If a non-local URI was explicitly configured, fail so the user knows
    const isLocal = uri.includes('127.0.0.1') || uri.includes('localhost');
    if (!isLocal) {
      throw err;
    }

    if (!isTest) {
      // eslint-disable-next-line no-console
      console.log(
        'ℹ️  No external MongoDB detected on localhost:27017. Initializing embedded database...',
      );
    }

    try {
      // Load ESM module dynamically
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const twinModule = (await Function('return import("@volter/twin-mongodb")')()) as {
        createMongodbTwinServer: (opts?: { root?: string }) => Promise<TwinServerInstance>;
      };

      const dataDir = isTest
        ? undefined
        : path.resolve(__dirname, '../../../server/data/issuetrack-db');

      if (dataDir && !fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      twinServerInstance = await twinModule.createMongodbTwinServer({
        root: dataDir,
      });

      const twinUrl = `${twinServerInstance.url}/${isTest ? 'issuetrack_test' : 'issuetrack'}`;

      await mongoose.connect(twinUrl, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: true,
      });

      if (!isTest) {
        // eslint-disable-next-line no-console
        console.log(
          `✅ Embedded MongoDB running & connected with persistence at: ${dataDir ?? 'in-memory'}`,
        );
      }
      return mongoose;
    } catch (twinErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to start embedded database:', twinErr);
      throw err;
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  // During tests, preserve the embedded server across test suites in the same worker
  if (!isTest && twinServerInstance) {
    await twinServerInstance.stop();
    twinServerInstance = null;
  }
}

// Ensure twin stops on process exit
process.on('exit', () => {
  if (twinServerInstance) {
    void twinServerInstance.stop().catch(() => undefined);
  }
});
