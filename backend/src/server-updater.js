import { join } from 'path';
import { execSync } from 'child_process';
import { ensureTemplateJar, buildMeta, generateServerProperties, runForgeInstaller, findForgeJar } from './server-creator.js';
import { execCommand, putFile } from './remote-connector.js';
import { backupServer } from './backup.js';
import { stopServer, startServer } from './server-manager.js';
import { stopRemoteServer, startRemoteServer } from './remote-manager.js';
import { getRemote } from './remote-store.js';
import { writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync, rmSync } from 'fs';

export async function updateServer(server, newType, newVersion, emitLog, emitStatus, loaderVersion) {
  const wasRunning = server.status === 'online';

  if (server.remote) {
    return await updateRemoteServer(server, newType, newVersion, emitLog, emitStatus, wasRunning, loaderVersion);
  }

  return await updateLocalServer(server, newType, newVersion, emitLog, emitStatus, wasRunning, loaderVersion);
}

async function updateLocalServer(server, newType, newVersion, emitLog, emitStatus, wasRunning, loaderVersion) {
  emitLog(server.id, `[INFO] Sauvegarde du serveur avant mise à jour...`);
  const backupPath = await backupServer(server);
  emitLog(server.id, `[INFO] Sauvegarde créée: ${backupPath}`);

  if (wasRunning) {
    emitLog(server.id, `[INFO] Arrêt du serveur...`);
    await new Promise((resolve) => stopServer(server.id, () => resolve()));
  }

  emitLog(server.id, `[INFO] Téléchargement de ${newType} ${newVersion}...`);
  const templatePath = await ensureTemplateJar(newType, newVersion, loaderVersion);

  const javaBin = server.javaPath || 'java';

  if (newType === 'forge') {
    const installerDest = join(server.path, 'forge-installer.jar');
    copyFileSync(templatePath, installerDest);
    await runForgeInstaller(server.path, 'forge-installer.jar', javaBin);
    const jarName = await findForgeJar(server.path, newVersion);

    const metaPath = join(server.path, 'server.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.type = newType;
    meta.version = newVersion;
    meta.jar = jarName;
    meta.loaderVersion = loaderVersion || null;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    emitLog(server.id, `[INFO] Mise à jour Forge terminée (${newType} ${newVersion})`);
    Object.assign(server, { type: newType, version: newVersion, jar: jarName, loaderVersion });
  } else if (newType === 'fabric') {
    const jarDest = join(server.path, 'server.jar');
    copyFileSync(templatePath, jarDest);

    const metaPath = join(server.path, 'server.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.type = newType;
    meta.version = newVersion;
    meta.jar = 'server.jar';
    meta.loaderVersion = loaderVersion || null;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    emitLog(server.id, `[INFO] Mise à jour Fabric terminée (${newType} ${newVersion})`);
    Object.assign(server, { type: newType, version: newVersion, jar: 'server.jar', loaderVersion });
  } else {
    const jarDest = join(server.path, 'server.jar');
    copyFileSync(templatePath, jarDest);

    const metaPath = join(server.path, 'server.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.type = newType;
    meta.version = newVersion;
    meta.jar = 'server.jar';
    meta.loaderVersion = null;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    emitLog(server.id, `[INFO] Mise à jour terminée (${newType} ${newVersion})`);
    Object.assign(server, { type: newType, version: newVersion, jar: 'server.jar', loaderVersion: null });
  }

  if (wasRunning) {
    emitLog(server.id, `[INFO] Redémarrage du serveur...`);
    await new Promise(r => setTimeout(r, 1000));
    await startWithTimeout(server, emitLog, emitStatus);
  }
}

function startWithTimeout(server, emitLog, emitStatus) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      emitLog(server.id, '[WARN] Timeout au démarrage (30s)');
      resolve();
    }, 30000);
    startServer(server, emitLog, (id, status) => {
      if (status === 'online' || status === 'error') {
        clearTimeout(timeout);
        resolve();
      }
      emitStatus(id, status);
    });
  });
}

async function updateRemoteServer(server, newType, newVersion, emitLog, emitStatus, wasRunning, loaderVersion) {
  const remote = getRemote(server.remoteId);
  if (!remote) throw new Error('Machine distante introuvable');

  emitLog(server.id, `[INFO] Sauvegarde du serveur distant avant mise à jour...`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `.backup-${timestamp}.tar.gz`;
  await execCommand(remote, `cd '${server.path}' && tar czf '${backupFile}' --exclude='.backup-*' . 2>/dev/null`, 120000);
  emitLog(server.id, `[INFO] Backup distant créé: ${backupFile}`);

  if (wasRunning) {
    emitLog(server.id, `[INFO] Arrêt du serveur distant...`);
    await new Promise((resolve) => stopRemoteServer(server, (id, status) => {
      if (status === 'stopped' || status === 'error') resolve();
      emitStatus(id, status);
    }));
  }

  emitLog(server.id, `[INFO] Téléchargement de ${newType} ${newVersion}...`);
  const templatePath = await ensureTemplateJar(newType, newVersion, loaderVersion);

  const javaPath = remote.javaPath || server.javaPath || 'java';

  if (newType === 'forge') {
    const remoteInstaller = `${server.path}/forge-installer.jar`;
    await putFile(remote, templatePath, remoteInstaller);
    await execCommand(remote, `cd '${server.path}' && ${javaPath} -jar forge-installer.jar --installServer`, 120000);
    await execCommand(remote, `rm -f '${server.path}/forge-installer.jar' '${server.path}/run.sh' '${server.path}/run.bat'`);

    const jarName = `forge-${newVersion}.jar`;
    // Verify the jar exists, fallback to any .jar
    await execCommand(remote, `test -f '${server.path}/${jarName}' || (ls '${server.path}'/*.jar 2>/dev/null | head -1 | xargs -I{} basename {}  > '${server.path}/.jarname')`);
    const actualJar = jarName;

    const meta = { ...server, type: newType, version: newVersion, jar: actualJar, loaderVersion: loaderVersion || null };
    const b64Meta = Buffer.from(JSON.stringify(meta, null, 2), 'utf-8').toString('base64');
    await execCommand(remote, `echo '${b64Meta}' | base64 -d > '${server.path}/server.json'`);

    emitLog(server.id, `[INFO] Mise à jour Forge distante terminée`);
    Object.assign(server, { type: newType, version: newVersion, jar: actualJar, loaderVersion });
  } else {
    const jarRemotePath = `${server.path}/server.jar`;
    await putFile(remote, templatePath, jarRemotePath);

    const meta = { ...server, type: newType, version: newVersion, jar: 'server.jar', loaderVersion: newType === 'fabric' ? (loaderVersion || null) : null };
    const b64Meta = Buffer.from(JSON.stringify(meta, null, 2), 'utf-8').toString('base64');
    await execCommand(remote, `echo '${b64Meta}' | base64 -d > '${server.path}/server.json'`);

    emitLog(server.id, `[INFO] Mise à jour distante terminée (${newType} ${newVersion})`);
    Object.assign(server, { type: newType, version: newVersion, jar: 'server.jar', loaderVersion: newType === 'fabric' ? (loaderVersion || null) : null });
  }

  // Regenerate server.properties
  const props = generateServerProperties({
    port: server.port,
    enableRcon: server.rcon?.enabled || false,
    rconPassword: server.rcon?.password || '',
    rconPort: server.rcon?.port || 25575,
    motd: server.motd || `${server.name} - GestionServer`,
    maxPlayers: server.maxPlayers,
    onlineMode: server.onlineMode,
    difficulty: server.difficulty,
    gamemode: server.gamemode,
    pvp: server.pvp,
    allowFlight: server.allowFlight,
    hardcore: server.hardcore,
    enableCommandBlock: server.enableCommandBlock,
    announceAdvancements: server.announceAdvancements,
    spawnProtection: server.spawnProtection,
    viewDistance: server.viewDistance,
    enforceWhitelist: server.enforceWhitelist,
    maxWorldSize: server.maxWorldSize,
    resourcePack: server.resourcePack,
    requireResourcePack: server.requireResourcePack,
    enableStatus: server.enableStatus,
  });
  const b64Props = Buffer.from(props, 'utf-8').toString('base64');
  await execCommand(remote, `echo '${b64Props}' | base64 -d > '${server.path}/server.properties'`);

  if (wasRunning) {
    emitLog(server.id, `[INFO] Redémarrage du serveur distant...`);
    await new Promise(r => setTimeout(r, 1000));
    await startRemoteServer(server, emitLog, emitStatus);
  }
}