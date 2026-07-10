import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import config from './config.js';
import { scanServers } from './scanner.js';
import {
  startServer,
  stopServer,
  restartServer,
  sendCommand,
  isRunning,
} from './server-manager.js';
import {
  startRemoteServer,
  stopRemoteServer,
  restartRemoteServer,
  sendRemoteCommand,
  isRemoteRunning,
  registerRemoteProcess,
} from './remote-manager.js';
import {
  getRemotes,
  getRemote,
  addRemote,
  updateRemote,
  removeRemote,
} from './remote-store.js';
import { scanRemoteServers } from './remote-scanner.js';
import { createServer as createNewServer, createRemoteServer, fetchVersions, generateServerProperties, getForgeBuilds, getFabricLoaders } from './server-creator.js';
import { updateServer } from './server-updater.js';
import { getList, addToList, removeFromList } from './server-list.js';
import { backupServer, deleteServer } from './backup.js';
import { startStatsCollection, onStats } from './stats-collector.js';
import { connectRcon, disconnectRcon, onRconData, sendRconCommand } from './rcon-client.js';
import { startLogWatcher, stopLogWatcher } from './log-watcher.js';
import { startMachineStatsCollection, onMachineStats, stopMachineStatsCollection } from './remote-stats.js';
import { execCommand, shEscape } from './remote-connector.js';
import { searchMods, getModVersions, installMod, listMods, listRemoteMods, removeMod, removeRemoteMod } from './mod-manager.js';
import { moveToTrash, listTrash, restoreFromTrash, deleteFromTrash, emptyTrash, cleanupExpiredItems } from './trash-manager.js';
import { getLocalDirs, addLocalDir, removeLocalDir } from './local-store.js';

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err);
});

const runningDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE', 'PUT'] },
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const serversMap = new Map();
let serversList = [];

const playersMap = new Map(); // serverId → Set<playerName>

function loadServers() {
  const scanned = scanServers();
  serversList = scanned;

  for (const s of scanned) {
    if (!serversMap.has(s.id)) {
      serversMap.set(s.id, s);
    } else {
      Object.assign(serversMap.get(s.id), s);
    }
  }

  for (const [id] of serversMap) {
    if (!scanned.find((s) => s.id === id)) {
      if (!serversMap.get(id)?.remote) {
        serversMap.delete(id);
      }
    }
  }
}

async function loadRemoteServers() {
  const remotes = getRemotes();
  await Promise.all(remotes.map(async (remote) => {
    try {
      const discovered = await scanRemoteServers(remote);
      for (const s of discovered) {
        if (!serversMap.has(s.id)) {
          serversMap.set(s.id, s);
          serversList.push(s);
        } else {
          Object.assign(serversMap.get(s.id), s);
        }
        if (s.pid) registerRemoteProcess(s.id, s.pid);
      }
    } catch (err) {
      console.error(`Erreur scan remote ${remote.name} (${remote.host}):`, err.message);
    }
  }));
}

function emitStatus(id, status, message) {
  const server = serversMap.get(id);
  if (server) {
    server.status = status;
    io.emit('server:status', { id, status, message, name: server.name });
    if (status === 'online') connectRcon(server);
  }
}

function emitLog(id, line) {
  io.emit('server:log', { id, line, timestamp: Date.now() });

  const joinMatch = line.match(/]:\s*(\w{2,16})(?:\[\/[\d.]+:\d+\])?\s+(?:logged in|joined the game)/);
  if (joinMatch) {
    const name = joinMatch[1];
    let set = playersMap.get(id);
    if (!set) {
      set = new Set();
      playersMap.set(id, set);
    }
    set.add(name);
    io.emit('server:players', { id, players: [...set] });
    return;
  }

  const leaveMatch = line.match(/]:\s*(\w{2,16})\s+(?:left the game|lost connection)/);
  if (leaveMatch) {
    const name = leaveMatch[1];
    const set = playersMap.get(id);
    if (set) {
      set.delete(name);
      io.emit('server:players', { id, players: [...set] });
    }
    return;
  }
}

function broadcastStats(statsArray) {
  io.emit('server:stats', statsArray);
}

function broadcastRcon(id, data) {
  io.emit('server:rcon', { id, ...data });
}

function broadcastMachineStats(statsArray) {
  io.emit('machine:stats', statsArray);
}

onStats(broadcastStats);
onRconData(broadcastRcon);
onMachineStats(broadcastMachineStats);

loadServers();

loadRemoteServers().then(() => {
  for (const server of serversList) {
    if (!server.remote) continue;
    startLogWatcher(server.id, server.path, emitLog, server);
    if (server.status === 'online') connectRcon(server);
  }
  startStatsCollection(serversMap);
  io.emit('servers:reload', serversList);
}).catch(() => {});

startMachineStatsCollection();

cleanupExpiredItems();
setInterval(cleanupExpiredItems, 60 * 60 * 1000);

for (const server of serversList) {
  if (server.remote) continue;
  if (server.autoStart) {
    startServer(server, emitLog, emitStatus);
  }
  startLogWatcher(server.id, server.path, emitLog, server);
}

// --- Version cache ---

let versionsCache = { data: null, time: 0 };
const VERSION_CACHE_TTL = 5 * 60 * 1000;

// --- API Routes ---

app.get('/api/versions', async (req, res) => {
  try {
    if (Date.now() - versionsCache.time > VERSION_CACHE_TTL) {
      versionsCache.data = await fetchVersions();
      versionsCache.time = Date.now();
    }
    res.json(versionsCache.data);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les versions' });
  }
});

app.get('/api/servers', async (req, res) => {
  const results = await Promise.all(serversList.map(async (s) => {
    const running = s.remote ? await isRemoteRunning(s) : isRunning(s.id);
    return { ...s, status: running ? (serversMap.get(s.id)?.status || 'online') : 'stopped' };
  }));
  res.json(results);
});

app.get('/api/servers/types', (req, res) => {
  res.json({
    vanilla: { name: 'Vanilla', supportsVersions: true, autoDownload: true },
    paper: { name: 'Paper', supportsVersions: true, autoDownload: true },
    spigot: { name: 'Spigot', supportsVersions: false, autoDownload: false },
    forge: { name: 'Forge', supportsVersions: true, autoDownload: false },
    fabric: { name: 'Fabric', supportsVersions: true, autoDownload: false },
    custom: { name: 'Custom JAR', supportsVersions: false, autoDownload: false },
  });
});

app.post('/api/servers/scan', (req, res) => {
  loadServers();
  io.emit('servers:reload', serversList);
  res.json(serversList);
});

app.post('/api/servers/create', async (req, res) => {
  try {
    let server;
    if (req.body.remoteId) {
      const remote = getRemote(req.body.remoteId);
      if (!remote) return res.status(400).json({ error: 'Machine distante introuvable' });
      server = await createRemoteServer(req.body, remote);
    } else {
      server = await createNewServer(req.body);
    }
    serversMap.set(server.id, server);
    serversList.push(server);
    startLogWatcher(server.id, server.path, emitLog, server);
    if (server.remote && server.status === 'online') connectRcon(server);
    io.emit('server:created', { id: server.id, name: server.name });
    res.status(201).json(server);
  } catch (err) {
    const isUserError = /requis|existe déjà|introuvable|Veuillez/i.test(err.message);
    res.status(isUserError ? 400 : 500).json({ error: err.message });
  }
});

app.get('/api/servers/:id', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  const running = server.remote ? await isRemoteRunning(server) : isRunning(server.id);
  res.json({
    ...server,
    status: running ? (server.status || 'online') : 'stopped',
  });
});

app.delete('/api/servers/:id', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  const makeBackup = req.query.backup !== 'false';
  const permanent = req.query.permanent === 'true';

  playersMap.delete(server.id);

  if (server.remote) {
    if (await isRemoteRunning(server)) {
      await new Promise((resolve) => stopRemoteServer(server, (id, status) => {
        if (status === 'stopped' || status === 'error') resolve();
        emitStatus(id, status);
      }));
    }
    stopLogWatcher(server.id);
    disconnectRcon(server.id);

    if (permanent) {
      const remote = getRemote(server.remoteId);
      if (remote) {
        await execCommand(remote, `rm -rf '${shEscape(server.path)}'`, 30000).catch(() => {});
      }
    } else {
      await moveToTrash(server, makeBackup).catch((err) => {
        console.error('[Trash] Erreur mise à la corbeille remote:', err.message);
      });
    }

    serversMap.delete(server.id);
    serversList = serversList.filter((s) => s.id !== server.id);
    io.emit('server:deleted', { id: server.id });
    return res.json({ success: true });
  }

  if (isRunning(server.id)) {
    await new Promise((resolve) => {
      stopServer(server.id, () => resolve());
    });
  }

  try {
    if (permanent) {
      await deleteServer(server, makeBackup);
    } else {
      await moveToTrash(server, makeBackup);
    }
    serversMap.delete(server.id);
    serversList = serversList.filter((s) => s.id !== server.id);
    stopLogWatcher(server.id);
    disconnectRcon(server.id);
    io.emit('server:deleted', { id: server.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/start', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  if (server.remote) {
    await startRemoteServer(server, emitLog, emitStatus);
  } else {
    startServer(server, emitLog, emitStatus);
  }
  res.json({ success: true });
});

app.post('/api/servers/:id/stop', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  if (server.remote) {
    await stopRemoteServer(server, emitStatus);
  } else {
    stopServer(server.id, emitStatus);
  }
  playersMap.delete(server.id);
  io.emit('server:players', { id: server.id, players: [] });
  disconnectRcon(server.id);
  res.json({ success: true });
});

app.post('/api/servers/:id/restart', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  if (server.remote) {
    await restartRemoteServer(server, emitLog, emitStatus);
  } else {
    restartServer(server, emitLog, emitStatus);
  }
  res.json({ success: true });
});

app.post('/api/servers/:id/command', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Commande requise' });

  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  if (server.remote) {
    const ok = await sendRemoteCommand(server, command);
    return res.json({ success: ok });
  }
  const sent = sendCommand(server.id, command);
  res.json({ success: sent });
});

app.post('/api/servers/:id/rcon', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Commande requise' });

  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  const response = await sendRconCommand(server.id, command);
  res.json({ success: response !== null, response });
});

app.put('/api/servers/:id', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  const body = req.body;

  const updated = { ...server };
  const propsFields = [
    'name', 'port', 'minRam', 'maxRam', 'jar', 'type', 'version', 'autoStart',
    'javaPath', 'loaderVersion',
    'difficulty', 'gamemode', 'maxPlayers', 'onlineMode', 'pvp', 'allowFlight',
    'hardcore', 'enableCommandBlock', 'announceAdvancements', 'motd',
    'spawnProtection', 'viewDistance', 'enforceWhitelist', 'maxWorldSize',
    'resourcePack', 'requireResourcePack', 'enableStatus',
  ];
  for (const key of propsFields) {
    if (body[key] !== undefined) updated[key] = body[key];
  }
  if (body.rcon !== undefined) updated.rcon = body.rcon;

  const propsOpts = {
    port: updated.port,
    enableRcon: updated.rcon?.enabled || false,
    rconPassword: updated.rcon?.password || '',
    rconPort: updated.rcon?.port || 25575,
    motd: updated.motd || `${updated.name} - GestionServer`,
    maxPlayers: updated.maxPlayers,
    onlineMode: updated.onlineMode,
    difficulty: updated.difficulty,
    gamemode: updated.gamemode,
    pvp: updated.pvp,
    allowFlight: updated.allowFlight,
    hardcore: updated.hardcore,
    enableCommandBlock: updated.enableCommandBlock,
    announceAdvancements: updated.announceAdvancements,
    spawnProtection: updated.spawnProtection,
    viewDistance: updated.viewDistance,
    enforceWhitelist: updated.enforceWhitelist,
    maxWorldSize: updated.maxWorldSize,
    resourcePack: updated.resourcePack,
    requireResourcePack: updated.requireResourcePack,
    enableStatus: updated.enableStatus,
  };

  try {
    if (server.remote) {
      const remoteCfg = getRemote(server.remoteId);
      if (!remoteCfg) return res.status(400).json({ error: 'Remote introuvable' });

      const newProps = generateServerProperties(propsOpts);
      const b64Props = Buffer.from(newProps, 'utf-8').toString('base64');
      await execCommand(remoteCfg, `echo '${b64Props}' | base64 -d > '${shEscape(server.path)}/server.properties'`);

      const metaJson = Buffer.from(JSON.stringify(updated, null, 2), 'utf-8').toString('base64');
      await execCommand(remoteCfg, `echo '${metaJson}' | base64 -d > '${shEscape(server.path)}/server.json'`);
    } else {
      const newProps = generateServerProperties(propsOpts);
      writeFileSync(join(server.path, 'server.properties'), newProps);

      writeFileSync(join(server.path, 'server.json'), JSON.stringify(updated, null, 2));
    }

    Object.assign(server, updated);
    serversMap.set(server.id, server);
    const idx = serversList.findIndex((s) => s.id === server.id);
    if (idx !== -1) serversList[idx] = server;

    if (body.rcon !== undefined) {
      disconnectRcon(server.id);
      if (server.status === 'online') connectRcon(server);
    }

    io.emit('servers:reload', serversList);
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/backup', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  if (server.remote) {
    return res.status(400).json({ error: 'Sauvegarde non supportée pour les serveurs distants' });
  }
  try {
    const path = await backupServer(server);
    res.json({ success: true, path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/update', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  const { type, version, loaderVersion } = req.body;
  if (!type || !version) return res.status(400).json({ error: 'Type et version requis' });

  try {
    await updateServer(server, type, version, emitLog, emitStatus, loaderVersion);
    io.emit('servers:reload', serversList);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/backups', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  try {
    if (server.remote) {
      const remote = getRemote(server.remoteId);
      if (!remote) return res.status(400).json({ error: 'Remote introuvable' });
      const result = await execCommand(remote, `ls -1 '${shEscape(server.path)}'/.backup-*.tar.gz 2>/dev/null || true`);
      const files = result.stdout.split('\n').filter(Boolean).map((f) => {
        const name = f.split('/').pop();
        return { name, path: f, date: name.replace('.backup-', '').replace('.tar.gz', '').replace(/-/g, ':') };
      });
      return res.json(files);
    }
    if (!existsSync(config.backupsDir)) return res.json([]);
    const files = readdirSync(config.backupsDir)
      .filter((f) => f.startsWith(server.name))
      .map((f) => ({ name: f, path: f, date: f.replace(server.name + '-', '').replace('.zip', '').replace(/-/g, ':') }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/rollback', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });

  const { backup } = req.body;
  if (!backup) return res.status(400).json({ error: 'Nom du backup requis' });
  const wasRunning = server.status === 'online';

  try {
    if (server.remote) {
      const remote = getRemote(server.remoteId);
      if (!remote) return res.status(400).json({ error: 'Remote introuvable' });

      if (wasRunning) {
        await new Promise((resolve) => stopRemoteServer(server, (id, status) => {
          if (status === 'stopped' || status === 'error') resolve();
          emitStatus(id, status);
        }));
      }

      const backupPath = `${server.path}/${backup}`;
      await execCommand(remote, `cd '${shEscape(server.path)}' && rm -rf ./* 2>/dev/null && tar xzf '${shEscape(backupPath)}'`, 60000);
      emitLog(server.id, `[INFO] Restauration terminée depuis ${backup}`);

      if (wasRunning) {
        const refreshed = serversMap.get(server.id);
        if (refreshed) startRemoteServer(refreshed, emitLog, emitStatus);
      }
    } else {
      const backupPath = join(config.backupsDir, backup);
      if (!existsSync(backupPath)) return res.status(400).json({ error: 'Backup introuvable' });

      if (wasRunning) {
        await new Promise((resolve) => stopServer(server.id, (id, status) => {
          if (status === 'stopped' || status === 'error') resolve();
          emitStatus(id, status);
        }));
      }

      const zip = new AdmZip(backupPath);
      const parentDir = dirname(server.path);
      rmSync(server.path, { recursive: true, force: true });
      zip.extractAllTo(parentDir, true);
      emitLog(server.id, `[INFO] Restauration terminée depuis ${backup}`);

      if (wasRunning) {
        const refreshed = serversMap.get(server.id);
        if (refreshed) startServer(refreshed, emitLog, emitStatus);
      }
    }

    loadServers();
    for (const s of serversMap.values()) {
      if (s.remote && !serversList.find(x => x.id === s.id)) {
        serversList.push(s);
      }
    }
    io.emit('servers:reload', serversList);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Loaders & Mods ---

app.get('/api/loaders', async (req, res) => {
  const { type, mc } = req.query;
  if (!type || !mc) return res.status(400).json({ error: 'type et mc requis' });
  try {
    if (type === 'forge') {
      const builds = await getForgeBuilds(mc);
      res.json(builds);
    } else if (type === 'fabric') {
      const loaders = await getFabricLoaders(mc);
      res.json(loaders);
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mods/search', async (req, res) => {
  const { query, loader, version } = req.query;
  if (!query) return res.status(400).json({ error: 'query requis' });
  try {
    const results = await searchMods(query, loader, version);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mods/versions', async (req, res) => {
  const { projectId, loader, version } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId requis' });
  try {
    const results = await getModVersions(projectId, loader, version);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:id/mods', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  try {
    const list = server.remote ? await listRemoteMods(server) : listMods(server);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/mods', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  const { projectId, versionId } = req.body;
  if (!projectId || !versionId) return res.status(400).json({ error: 'projectId et versionId requis' });
  try {
    const result = await installMod(server, projectId, versionId);
    emitLog(server.id, `[INFO] Mod installé: ${result.filename}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/servers/:id/mods/:file', async (req, res) => {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  try {
    const result = server.remote ? await removeRemoteMod(server, req.params.file) : removeMod(server, req.params.file);
    emitLog(server.id, `[INFO] Mod supprimé: ${req.params.file}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Trash / Corbeille ---

app.get('/api/trash', (req, res) => {
  try {
    const items = listTrash();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trash/:trashId/restore', async (req, res) => {
  try {
    const item = await restoreFromTrash(req.params.trashId);
    loadServers();
    await loadRemoteServers().catch(() => {});
    io.emit('servers:reload', serversList);
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trash/:trashId', async (req, res) => {
  try {
    await deleteFromTrash(req.params.trashId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trash/empty', async (req, res) => {
  try {
    await emptyTrash();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Whitelist & Bans ---

async function listEndpoint(req, res, listName) {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  try {
    const list = await getList(server, listName);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addEndpoint(req, res, listName, rconCmd) {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: 'Nom du joueur requis' });

  try {
    await addToList(server, listName, player);
    if (rconCmd && server.rcon?.enabled) {
      await sendRconCommand(server.id, `${rconCmd} ${player}`);
    }
    const list = await getList(server, listName);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeEndpoint(req, res, listName, rconCmd) {
  const server = serversMap.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Serveur introuvable' });
  const { player } = req.params;

  try {
    await removeFromList(server, listName, player);
    if (rconCmd && server.rcon?.enabled) {
      await sendRconCommand(server.id, `${rconCmd} ${player}`);
    }
    const list = await getList(server, listName);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/servers/:id/whitelist', (req, res) => listEndpoint(req, res, 'whitelist'));
app.post('/api/servers/:id/whitelist', (req, res) => addEndpoint(req, res, 'whitelist', 'whitelist add'));
app.delete('/api/servers/:id/whitelist/:player', (req, res) => removeEndpoint(req, res, 'whitelist', 'whitelist remove'));

app.get('/api/servers/:id/bans', (req, res) => listEndpoint(req, res, 'banned-players'));
app.post('/api/servers/:id/bans', (req, res) => addEndpoint(req, res, 'banned-players', 'ban'));
app.delete('/api/servers/:id/bans/:player', (req, res) => removeEndpoint(req, res, 'banned-players', 'pardon'));

// --- Remote Management Routes ---

app.get('/api/remotes', (req, res) => {
  res.json(getRemotes());
});

app.post('/api/remotes', async (req, res) => {
  try {
    const remote = addRemote(req.body);
    res.status(201).json(remote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/remotes/:id', async (req, res) => {
  const remote = updateRemote(req.params.id, req.body);
  if (!remote) return res.status(404).json({ error: 'Remote introuvable' });
  res.json(remote);
});

app.delete('/api/remotes/:id', (req, res) => {
  const deleted = removeRemote(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Remote introuvable' });

  serversList = serversList.filter((s) => s.remoteId !== req.params.id);
  for (const [id, server] of serversMap) {
    if (server.remoteId === req.params.id) {
      stopLogWatcher(id);
      disconnectRcon(id);
      serversMap.delete(id);
    }
  }
  io.emit('servers:reload', serversList);
  res.json({ success: true });
});

app.post('/api/remotes/:id/scan', async (req, res) => {
  const remote = getRemote(req.params.id);
  if (!remote) return res.status(404).json({ error: 'Remote introuvable' });

  try {
    const discovered = await scanRemoteServers(remote);

    for (const s of discovered) {
      if (!serversMap.has(s.id)) {
        serversMap.set(s.id, s);
        serversList.push(s);
      } else {
        Object.assign(serversMap.get(s.id), s);
      }
      if (s.pid) registerRemoteProcess(s.id, s.pid);
      startLogWatcher(s.id, s.path, emitLog, s);
    }

    io.emit('servers:reload', serversList);
    res.json(discovered);
  } catch (err) {
    res.status(500).json({ error: 'Erreur scan distant: ' + err.message });
  }
});

// --- Local Dirs ---

app.get('/api/local-dirs', (req, res) => {
  try {
    const dirs = getLocalDirs();
    res.json({ dirs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/local-dirs', async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'Chemin requis' });
  try {
    const dirs = addLocalDir(path);
    loadServers();
    io.emit('servers:reload', serversList);
    res.json({ dirs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/local-dirs/:encodedPath', async (req, res) => {
  const dirPath = decodeURIComponent(req.params.encodedPath);
  try {
    const ok = removeLocalDir(dirPath);
    if (!ok) return res.status(400).json({ error: 'Dossier introuvable' });
    loadServers();
    io.emit('servers:reload', serversList);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.IO ---

io.on('connection', (socket) => {
  socket.emit('servers:init', serversList);
});

// --- Start ---

export function initBackend(port = config.port, staticDir = null) {
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        res.sendFile(join(staticDir, 'index.html'));
      }
    });
  }

  httpServer.listen(port, () => {
    console.log(`GestionServer backend démarré sur http://localhost:${port}`);
  });
}

if (runningDirectly) {
  initBackend();
}
