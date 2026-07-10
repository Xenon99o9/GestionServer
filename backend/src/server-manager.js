import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, rmSync } from 'fs';

const processes = new Map();

export function startServer(server, onLog, onStatusChange) {
  const { id, path: serverPath, jar, maxRam, minRam } = server;
  const jarPath = resolve(serverPath, jar);

  if (!existsSync(jarPath)) {
    onStatusChange(id, 'error', `Jar introuvable: ${jarPath}`);
    return;
  }

  if (processes.has(id)) {
    onStatusChange(id, 'error', 'Serveur déjà en cours');
    return;
  }

  onStatusChange(id, 'starting');

  const lockPath = resolve(serverPath, 'world', 'session.lock');
  if (existsSync(lockPath)) rmSync(lockPath);

  const javaBin = server.javaPath || 'java';

  const proc = spawn(javaBin, [
    `-Xms${minRam}G`,
    `-Xmx${maxRam}G`,
    '-jar', jarPath,
    '--nogui',
  ], {
    cwd: serverPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  processes.set(id, {
    proc,
    startTime: Date.now(),
    stopped: false,
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onLog(id, line);

      if (line.includes('Done (') || line.includes('For help, type "help"')) {
        onStatusChange(id, 'online');
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onLog(id, `[STDERR] ${line}`);
    }
  });

  proc.on('exit', (code) => {
    const entry = processes.get(id);
    if (entry) {
      entry.stopped = true;
      processes.delete(id);
    }
    onStatusChange(id, 'stopped', `Exit code: ${code}`);
  });

  proc.on('error', (err) => {
    processes.delete(id);
    onStatusChange(id, 'error', err.message);
  });
}

export function stopServer(id, onStatusChange) {
  const entry = processes.get(id);
  if (!entry) {
    onStatusChange(id, 'stopped');
    return;
  }

  const { proc } = entry;

  try {
    proc.stdin.write('stop\n');
  } catch {}

  const forceKill = setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch {}
  }, 10000);

  proc.once('exit', () => {
    clearTimeout(forceKill);
    entry.stopped = true;
    processes.delete(id);
    onStatusChange(id, 'stopped');
  });
}

export function restartServer(server, onLog, onStatusChange) {
  stopServer(server.id, (id, status) => {
    if (status === 'stopped') {
      setTimeout(() => startServer(server, onLog, onStatusChange), 1000);
    }
  });
}

export function sendCommand(id, command) {
  const entry = processes.get(id);
  if (!entry) return false;
  try {
    entry.proc.stdin.write(`${command}\n`);
    return true;
  } catch {
    return false;
  }
}

export function getProcessInfo(id) {
  const entry = processes.get(id);
  if (!entry) return null;
  return {
    pid: entry.proc.pid,
    startTime: entry.startTime,
    uptime: Date.now() - entry.startTime,
  };
}

export function isRunning(id) {
  return processes.has(id) && !processes.get(id).stopped;
}
