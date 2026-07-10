import { watchFile, readFileSync, existsSync, watch } from 'fs';
import { join } from 'path';
import { execCommand, connect } from './remote-connector.js';
import { getRemote } from './remote-store.js';

const watchers = new Map();

export function startLogWatcher(serverId, serverPath, onLine, server) {
  if (watchers.has(serverId)) return;

  if (server && server.remote) {
    startRemoteLogWatcher(serverId, server, onLine);
    return;
  }

  const logPath = join(serverPath, 'logs', 'latest.log');
  const logsDir = join(serverPath, 'logs');

  let lastSize = 0;

  function attachWatcher() {
    if (!existsSync(logPath)) return false;
    try {
      lastSize = readFileSync(logPath).length;
    } catch { lastSize = 0; }

    const w = watchFile(logPath, { interval: 500 }, () => {
      try {
        const content = readFileSync(logPath, 'utf-8');
        const newContent = content.slice(lastSize);
        lastSize = content.length;

        for (const line of newContent.split('\n').filter(Boolean)) {
          onLine(serverId, line);
        }
      } catch {}
    });

    watchers.set(serverId, { type: 'local', watcher: w, logPath });
    return true;
  }

  if (attachWatcher()) return;

  if (!existsSync(logsDir)) return;

  const dirWatcher = watch(logsDir, (eventType, filename) => {
    if (filename === 'latest.log' && attachWatcher()) {
      dirWatcher.close();
    }
  });

  watchers.set(serverId, { type: 'local-pending', dirWatcher, logsDir });
}

function startRemoteLogWatcher(serverId, server, onLine) {
  const remote = getRemote(server.remoteId);
  if (!remote) return;

  const logFile = `'${server.path}/logs/latest.log'`;
  let lastSize = 0;

  let failures = 0;

  const interval = setInterval(async () => {
    try {
      const sizeResult = await execCommand(
        remote,
        `test -f ${logFile} && wc -c < ${logFile} || echo 0`,
      );
      const currentSize = parseInt(sizeResult.stdout.trim(), 10) || 0;

      if (currentSize > lastSize) {
        const tailResult = await execCommand(
          remote,
          `tail -c +$((lastSize + 1)) ${logFile} 2>/dev/null`,
        );
        lastSize = currentSize;

        for (const line of tailResult.stdout.split('\n').filter(Boolean)) {
          onLine(serverId, line);
        }
      } else if (currentSize < lastSize) {
        lastSize = 0;
      }

      failures = 0;
    } catch {
      failures++;
      if (failures >= 5) {
        console.warn(`[LogWatcher] Remote ${serverId} unreachable, stopping watcher`);
        clearInterval(interval);
        watchers.delete(serverId);
      }
    }
  }, 1500);

  watchers.set(serverId, { type: 'remote', interval, remoteId: server.remoteId });
}

export function stopLogWatcher(serverId) {
  const entry = watchers.get(serverId);
  if (!entry) return;
  if (entry.type === 'remote') {
    clearInterval(entry.interval);
  } else if (entry.type === 'local-pending') {
    entry.dirWatcher.close();
  } else {
    entry.watcher.close();
  }
  watchers.delete(serverId);
}
