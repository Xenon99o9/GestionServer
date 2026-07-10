import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execCommand } from './remote-connector.js';
import { getRemote } from './remote-store.js';

function readJsonLocal(path) {
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return []; }
}

function writeJsonLocal(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

async function readJsonRemote(remote, path) {
  const result = await execCommand(remote, `cat '${path}' 2>/dev/null || echo '[]'`);
  try { return JSON.parse(result.stdout); } catch { return []; }
}

async function writeJsonRemote(remote, path, data) {
  const b64 = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  await execCommand(remote, `echo '${b64}' | base64 -d > '${path}'`);
}

function getListPath(server, listName) {
  if (server.remote) return `${server.path}/${listName}.json`;
  return join(server.path, `${listName}.json`);
}

function getRemoteCfg(server) {
  if (!server.remote) return null;
  return getRemote(server.remoteId);
}

export async function getList(server, listName) {
  const path = getListPath(server, listName);
  const remote = getRemoteCfg(server);
  if (remote) return readJsonRemote(remote, path);
  return readJsonLocal(path);
}

export async function addToList(server, listName, playerName) {
  const path = getListPath(server, listName);
  const remote = getRemoteCfg(server);
  const list = remote ? await readJsonRemote(remote, path) : readJsonLocal(path);

  const exists = list.some((e) => e.name === playerName || e.uuid === playerName);
  if (exists) return false;

  list.push({ name: playerName, uuid: '', created: new Date().toISOString() });

  if (remote) {
    await writeJsonRemote(remote, path, list);
  } else {
    writeJsonLocal(path, list);
  }
  return true;
}

export async function removeFromList(server, listName, playerName) {
  const path = getListPath(server, listName);
  const remote = getRemoteCfg(server);
  let list = remote ? await readJsonRemote(remote, path) : readJsonLocal(path);

  const before = list.length;
  list = list.filter((e) => e.name !== playerName && (e.uuid || '') !== playerName);
  if (list.length === before) return false;

  if (remote) {
    await writeJsonRemote(remote, path, list);
  } else {
    writeJsonLocal(path, list);
  }
  return true;
}