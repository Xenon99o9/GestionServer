import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORE_PATH = join(__dirname, '..', 'local-dirs.json');

function loadAll() {
  if (!existsSync(STORE_PATH)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveAll(dirs) {
  writeFileSync(STORE_PATH, JSON.stringify(dirs, null, 2), 'utf-8');
}

export function getLocalDirs() {
  return loadAll();
}

export function addLocalDir(dirPath) {
  const dirs = loadAll();
  const normalized = dirPath.replace(/\/+$/, '');
  if (dirs.includes(normalized)) throw new Error('Ce dossier est déjà dans la liste');
  dirs.push(normalized);
  saveAll(dirs);
  return dirs;
}

export function removeLocalDir(dirPath) {
  const dirs = loadAll();
  const normalized = dirPath.replace(/\/+$/, '');
  const filtered = dirs.filter((d) => d !== normalized);
  if (filtered.length === dirs.length) return false;
  saveAll(filtered);
  return true;
}