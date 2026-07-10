import { Rcon } from 'rcon-client';

const connections = new Map();
const reconnectTimers = new Map();
const listeners = new Set();

export async function connectRcon(server) {
  const { id, name, rcon } = server;
  if (!rcon.enabled || !rcon.password) return;

  disconnectRcon(id);

  const host = server.remoteHost || '127.0.0.1';

  try {
    const conn = await Rcon.connect({
      host,
      port: rcon.port,
      password: rcon.password,
      timeout: 3000,
    });

    connections.set(id, conn);
    pollPlayers(id, conn, server);
  } catch {
    const timer = setTimeout(() => connectRcon(server), 5000);
    reconnectTimers.set(id, timer);
  }
}

export function disconnectRcon(id) {
  const timer = reconnectTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(id);
  }
  const conn = connections.get(id);
  if (conn) {
    conn.end().catch(() => {});
    connections.delete(id);
  }
}

function pollPlayers(id, conn, server) {
  if (!connections.has(id)) return;

  conn.send('list')
    .then((response) => {
      const players = parsePlayers(response);
      for (const listener of listeners) {
        listener(id, { players, tps: null });
      }
    })
    .catch(() => {
      connections.delete(id);
      const timer = setTimeout(() => connectRcon(server), 5000);
      reconnectTimers.set(id, timer);
    });

  setTimeout(() => {
    if (connections.has(id)) {
      pollPlayers(id, conn, server);
    }
  }, 5000);
}

function parsePlayers(response) {
  const match = response.match(/There are (\d+) of a max of (\d+) players online:\s*(.*)/);
  if (!match) return [];
  const list = match[3].trim();
  return list ? list.split(', ').map((n) => n.trim()).filter(Boolean) : [];
}

export function onRconData(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function sendRconCommand(id, command) {
  const conn = connections.get(id);
  if (!conn) return null;
  try {
    return await conn.send(command);
  } catch {
    return null;
  }
}
