import { execCommand, connect, findRemoteJavaPid, shEscape } from './remote-connector.js';
import { getRemote } from './remote-store.js';
import { sendRconCommand } from './rcon-client.js';

const remoteProcesses = new Map();

const COMMAND_TIMEOUT = 30000;

function getRemoteForServer(server) {
  if (!server.remote || !server.remoteId) return null;
  return getRemote(server.remoteId);
}

export async function startRemoteServer(server, emitLog, emitStatus) {
  const remote = getRemoteForServer(server);
  if (!remote) {
    emitStatus(server.id, 'error', 'Configuration distante introuvable');
    return;
  }

  const javaPath = server.javaPath || remote.javaPath || 'java';
  const sp = shEscape(server.path);
  const logFile = `'${sp}/.startup.log'`;
  const cmd = `rm -f '${sp}/world/session.lock' 2>/dev/null; cd '${sp}' 2>/dev/null; nohup ${javaPath} -Xms${server.minRam}G -Xmx${server.maxRam}G -jar ${server.jar} --nogui > ${logFile} 2>&1 & echo $!`;

  try {
    emitStatus(server.id, 'starting', 'Démarrage du serveur distant...');

    const result = await execCommand(remote, cmd);
    let pid = parseInt(result.stdout.trim(), 10);

    if (isNaN(pid) && !(pid = await findRemoteJavaPid(remote, server.path))) {
      emitStatus(server.id, 'error', 'Impossible de démarrer le processus distant');
      return;
    }
    if (pid !== parseInt(result.stdout.trim(), 10)) {
      emitLog(server.id, `[INFO] PID corrigé: ${pid} (au lieu de ${result.stdout.trim()})`);
    }

    // Wait 3s then verify process is still alive
    await execCommand(remote, `sleep 3`);
    const alive = await execCommand(remote, `kill -0 ${pid} 2>/dev/null && echo "1" || echo "0"`);
    if (alive.stdout.trim() !== '1') {
      const logResult = await execCommand(remote, `cat ${logFile} 2>/dev/null || echo "(aucun log)"`);
      emitStatus(server.id, 'error', 'Le serveur distant a crashé au démarrage');
      emitLog(server.id, `[ERROR] Log de démarrage:\n${logResult.stdout}`);
      return;
    }

    // Check if "Done" appears in startup log
    const done = await execCommand(remote, `grep -q "Done (" ${logFile} && echo "1" || echo "0"`);
    if (done.stdout.trim() === '1') {
      emitLog(server.id, '[INFO] Serveur prêt (Done détecté)');
    }

    remoteProcesses.set(server.id, { pid, startTime: Date.now(), stopped: false });
    server.pid = pid;
    emitStatus(server.id, 'online', 'Serveur distant démarré');

    setTimeout(() => {
      emitLog(server.id, '[INFO] Serveur distant démarré avec PID ' + pid);
    }, 500);
  } catch (err) {
    emitStatus(server.id, 'error', 'Erreur démarrage distant: ' + err.message);
  }
}

export async function stopRemoteServer(server, emitStatus) {
  const remote = getRemoteForServer(server);
  if (!remote) {
    emitStatus(server.id, 'error', 'Configuration distante introuvable');
    return;
  }

  let proc = remoteProcesses.get(server.id);
  if (!proc) {
    const foundPid = await findRemoteJavaPid(remote, server.path);
    if (foundPid) {
      remoteProcesses.set(server.id, { pid: foundPid, startTime: Date.now(), stopped: false });
      proc = remoteProcesses.get(server.id);
    } else {
      emitStatus(server.id, 'stopped', 'Aucun processus trouvé');
      return;
    }
  }

  try {
    const killCmd = `kill ${proc.pid} 2>/dev/null; sleep 2; kill -0 ${proc.pid} 2>/dev/null && kill -9 ${proc.pid} 2>/dev/null; echo "done"`;
    await execCommand(remote, killCmd);
    remoteProcesses.delete(server.id);
    server.pid = null;
    emitStatus(server.id, 'stopped', 'Serveur distant arrêté');
  } catch (err) {
    emitStatus(server.id, 'error', 'Erreur arrêt distant: ' + err.message);
  }
}

export async function restartRemoteServer(server, emitLog, emitStatus) {
  await stopRemoteServer(server, emitStatus);
  await new Promise((r) => setTimeout(r, 1000));
  await startRemoteServer(server, emitLog, emitStatus);
}

export async function sendRemoteCommand(server, command) {
  if (server.rcon?.enabled) {
    const response = await sendRconCommand(server.id, command);
    return response !== null;
  }

  const remote = getRemoteForServer(server);
  if (!remote) return false;

  const proc = remoteProcesses.get(server.id);
  if (!proc) return false;

  try {
    const result = await execCommand(
      remote,
      `echo '${command.replace(/'/g, "'\\''")}' > /proc/${proc.pid}/fd/0 2>/dev/null; echo "sent"`,
    );
    return result.stdout.trim() === 'sent';
  } catch {
    return false;
  }
}

export async function isRemoteRunning(server) {
  const remote = getRemoteForServer(server);
  if (!remote) return false;

  const proc = remoteProcesses.get(server.id);
  if (!proc) return false;

  try {
    const result = await execCommand(remote, `kill -0 ${proc.pid} 2>/dev/null && echo "alive" || echo "dead"`);
    const alive = result.stdout.trim() === 'alive';

    if (!alive) {
      remoteProcesses.delete(server.id);
      server.pid = null;
    }

    return alive;
  } catch {
    remoteProcesses.delete(server.id);
    server.pid = null;
    return false;
  }
}

export function getRemoteProcess(serverId) {
  return remoteProcesses.get(serverId) || null;
}

export function getRemoteProcesses() {
  return remoteProcesses;
}

export function registerRemoteProcess(serverId, pid) {
  if (!remoteProcesses.has(serverId)) {
    remoteProcesses.set(serverId, { pid, startTime: Date.now(), stopped: false });
  }
}
