import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.NODE_ENV = 'test';

const portFile = path.resolve(__dirname, '../.test-db-url');
if (fs.existsSync(portFile)) {
  const twinUrl = fs.readFileSync(portFile, 'utf8').trim();
  process.env.MONGODB_URI = `${twinUrl}/issuetrack_test`;
} else {
  process.env.MONGODB_URI =
    process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/issuetrack_test';
}

process.env.JWT_SECRET = process.env.JWT_SECRET_TEST ?? 'test_secret_test_secret_test_secret_32';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'issuetrack-test-uploads');
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.CLIENT_ORIGIN_PATTERNS = 'https://*.preview.test';
process.env.COOKIE_SECURE = 'false';
// Never let a developer's local Clerk keys leak into tests (dotenv does not override these).
process.env.CLERK_SECRET_KEY = '';
process.env.CLERK_JWT_KEY = '';

import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db';

beforeAll(async () => {
  await connectDatabase(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await disconnectDatabase();
});
