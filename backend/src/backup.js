import archiver from 'archiver';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import config from './config.js';
import { isRunning, stopServer, startServer } from './server-manager.js';

export function backupServer(server) {
  return new Promise((resolve, reject) => {
    if (!existsSync(config.backupsDir)) {
      mkdirSync(config.backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = server.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipPath = join(config.backupsDir, `${safeName}-${timestamp}.zip`);

    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(server.path, safeName);
    archive.finalize();
  });
}

export async function deleteServer(server, makeBackup = true) {
  if (makeBackup) {
    await backupServer(server);
  }

  const { rmSync } = await import('fs');
  rmSync(server.path, { recursive: true, force: true });
}
