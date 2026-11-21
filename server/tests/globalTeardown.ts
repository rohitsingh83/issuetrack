import fs from 'fs';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  const portFile = path.resolve(__dirname, '../.test-db-url');
  if (fs.existsSync(portFile)) {
    fs.unlinkSync(portFile);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twin = (globalThis as any).__TEST_TWIN__;
  if (twin && typeof twin.stop === 'function') {
    await twin.stop();
  }
}

