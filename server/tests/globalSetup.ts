import net from 'net';
import fs from 'fs';
import path from 'path';

function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export default async function globalSetup(): Promise<void> {
  const isOpen = await isPortOpen(27017);
  if (isOpen) {
    // External MongoDB is active
    return;
  }

  // Start embedded twin for test suites
  const { createMongodbTwinServer } = await import('@volter/twin-mongodb');
  const twin = await createMongodbTwinServer();

  // Save twin URL for test workers
  const portFile = path.resolve(__dirname, '../.test-db-url');
  fs.writeFileSync(portFile, twin.url, 'utf8');

  // Keep reference for teardown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__TEST_TWIN__ = twin;
}

