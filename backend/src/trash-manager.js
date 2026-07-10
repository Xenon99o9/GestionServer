import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync, statSync, unlinkSync } from 'fs';
import config from './config.js';
import { backupServer } from './backup.js';
import { execCommand, shEscape } from './remote-connector.js';
import { getRemote } from './remote-store.js';

const TRASH_FILE = 'trash.json';
const EXPIRATION_DAYS = 30;

function getTrashPath() {
  if (!existsSync(config.trashDir)) mkdirSync(config.trashDir, { recursive: true });
  return config.trashDir;
}

function getTrashFile() {
  return join(getTrashPath(), TRASH_FILE);
}

function readTrash() {
  const file = getTrashFile();
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeTrash(items) {
  writeFileSync(getTrashFile(), JSON.stringify(items, null, 2));
}

function generateSafeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function generateTrashId(name) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${generateSafeName(name)}-${ts}`;
}

function buildTrashItem(server, trashId) {
  return {
    trashId,
    name: server.name,
    type: server.type,
    version: server.version,
    loaderVersion: server.loaderVersion || null,
    port: server.port,
    minRam: server.minRam,
    maxRam: server.maxRam,
    javaPath: server.javaPath || 'java',
    rcon: server.rcon || { enabled: false, port: 25575, password: '' },
    autoStart: server.autoStart || false,
    originalPath: server.path,
    remote: !!server.remote,
    remoteId: server.remoteId || null,
    remoteHost: server.remoteHost || null,
    remoteDirectory: server.remoteDirectory || null,
    deletedAt: new Date().toISOString(),
  };
}

export async function moveToTrash(server, makeBackup = true) {
  if (makeBackup) {
    await backupServer(server);
  }

  const trashId = generateTrashId(server.name);
  const item = buildTrashItem(server, trashId);

  if (server.remote) {
    const remote = getRemote(server.remoteId);
    if (!remote) throw new Error('Machine distante introuvable');

    const parentDir = server.path.substring(0, server.path.lastIndexOf('/'));
    const trashDir = `${parentDir}/.trash`;
    const trashPath = `${trashDir}/${trashId}`;

    await execCommand(remote, `mkdir -p '${shEscape(trashDir)}'`, 10000);
    await execCommand(remote, `mv '${shEscape(server.path)}' '${shEscape(trashPath)}'`, 30000);

    item.remoteDirectory = parentDir;
    item.trashPath = trashPath;
  } else {
    const trashPath = join(getTrashPath(), trashId);
    renameSync(server.path, trashPath);
    item.trashPath = trashPath;
  }

  const items = readTrash();
  items.push(item);
  writeTrash(items);

  return trashId;
}

export function listTrash() {
  return readTrash();
}

export async function restoreFromTrash(trashId) {
  const items = readTrash();
  const idx = items.findIndex((i) => i.trashId === trashId);
  if (idx === -1) throw new Error('Élément introuvable dans la corbeille');

  const item = items[idx];

  if (item.remote) {
    const remote = getRemote(item.remoteId);
    if (!remote) throw new Error('Machine distante introuvable');

    const exists = await execCommand(remote, `test -d '${shEscape(item.trashPath)}' && echo "1" || echo "0"`);
    if (exists.stdout.trim() !== '1') throw new Error(`Dossier corbeille introuvable: ${item.trashPath}`);

    await execCommand(remote, `mkdir -p '${shEscape(item.originalPath)}'`, 10000);
    await execCommand(remote, `mv '${shEscape(item.trashPath)}'/* '${shEscape(item.trashPath)}'/.[!.]* '${shEscape(item.originalPath)}' 2>/dev/null; rmdir '${shEscape(item.trashPath)}' 2>/dev/null; true`, 30000);
  } else {
    if (!existsSync(item.trashPath)) throw new Error(`Dossier corbeille introuvable: ${item.trashPath}`);

    const parentDir = item.originalPath.substring(0, item.originalPath.lastIndexOf('/'));
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });

    renameSync(item.trashPath, item.originalPath);
  }

  items.splice(idx, 1);
  writeTrash(items);

  return item;
}

export async function deleteFromTrash(trashId) {
  const items = readTrash();
  const idx = items.findIndex((i) => i.trashId === trashId);
  if (idx === -1) throw new Error('Élément introuvable dans la corbeille');

  const item = items[idx];

  if (item.remote) {
    const remote = getRemote(item.remoteId);
    if (!remote) throw new Error('Machine distante introuvable');
    await execCommand(remote, `rm -rf '${shEscape(item.trashPath)}'`, 30000);
  } else {
    if (existsSync(item.trashPath)) {
      rmSync(item.trashPath, { recursive: true, force: true });
    }
  }

  items.splice(idx, 1);
  writeTrash(items);
}

export async function emptyTrash() {
  const items = readTrash();
  for (const item of items) {
    try {
      if (item.remote) {
        const remote = getRemote(item.remoteId);
        if (remote) {
          await execCommand(remote, `rm -rf '${shEscape(item.trashPath)}'`, 30000);
        }
      } else {
        if (existsSync(item.trashPath)) {
          rmSync(item.trashPath, { recursive: true, force: true });
        }
      }
    } catch {}
  }
  writeTrash([]);
}

export function cleanupExpiredItems() {
  const msLimit = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Clean trash items
  let items = readTrash();
  let changed = false;
  const kept = [];

  for (const item of items) {
    const deletedAt = new Date(item.deletedAt).getTime();
    if (now - deletedAt > msLimit) {
      try {
        if (item.remote) {
          const remote = getRemote(item.remoteId);
          if (remote) execCommand(remote, `rm -rf '${shEscape(item.trashPath)}'`, 30000);
        } else {
          if (existsSync(item.trashPath)) rmSync(item.trashPath, { recursive: true, force: true });
        }
      } catch {}
      changed = true;
    } else {
      kept.push(item);
    }
  }

  if (changed) writeTrash(kept);

  // Clean old backups
  if (existsSync(config.backupsDir)) {
    const files = readdirSync(config.backupsDir);
    for (const file of files) {
      if (!file.endsWith('.zip')) continue;
      const filePath = join(config.backupsDir, file);
      try {
        const mtime = statSync(filePath).mtimeMs;
        if (now - mtime > msLimit) {
          unlinkSync(filePath);
        }
      } catch {}
    }
  }
}