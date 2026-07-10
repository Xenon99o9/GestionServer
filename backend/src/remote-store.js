import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORE_PATH = join(__dirname, '..', 'remotes.json');

function loadAll() {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveAll(remotes) {
  writeFileSync(STORE_PATH, JSON.stringify(remotes, null, 2), 'utf-8');
}

export function getRemotes() {
  return loadAll();
}

export function getRemote(id) {
  return loadAll().find((r) => r.id === id) || null;
}

export function addRemote(data) {
  const remotes = loadAll();
  const remote = {
    id: uuid().slice(0, 8),
    name: data.name || 'Machine distante',
    host: data.host,
    port: parseInt(data.port, 10) || 22,
    username: data.username || 'root',
    authType: data.authType || 'password',
    password: data.password || null,
    privateKey: data.privateKey || null,
    directory: data.directory || '/',
    javaPath: data.javaPath || 'java',
    createdAt: new Date().toISOString(),
  };
  remotes.push(remote);
  saveAll(remotes);
  return remote;
}

export function updateRemote(id, data) {
  const remotes = loadAll();
  const idx = remotes.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = {
    ...remotes[idx],
    name: data.name ?? remotes[idx].name,
    host: data.host ?? remotes[idx].host,
    port: data.port !== undefined ? parseInt(data.port, 10) : remotes[idx].port,
    username: data.username ?? remotes[idx].username,
    authType: data.authType ?? remotes[idx].authType,
    password: data.password !== undefined ? data.password : remotes[idx].password,
    privateKey: data.privateKey !== undefined ? data.privateKey : remotes[idx].privateKey,
    directory: data.directory ?? remotes[idx].directory,
    javaPath: data.javaPath ?? remotes[idx].javaPath,
  };
  remotes[idx] = updated;
  saveAll(remotes);
  return updated;
}

export function removeRemote(id) {
  const remotes = loadAll();
  const filtered = remotes.filter((r) => r.id !== id);
  if (filtered.length === remotes.length) return false;
  saveAll(filtered);
  return true;
}
