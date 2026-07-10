import pidusage from 'pidusage';
import { isRunning, getProcessInfo } from './server-manager.js';
import { isRemoteRunning, getRemoteProcess } from './remote-manager.js';
import { execCommand } from './remote-connector.js';
import { getRemote } from './remote-store.js';
import config from './config.js';

let interval = null;
const listeners = new Set();

export function startStatsCollection(serversMap) {
  if (interval) return;

  interval = setInterval(async () => {
    const stats = [];

    for (const [id, server] of serversMap.entries()) {
      if (server.remote) {
        const alive = await isRemoteRunning(server);
        if (!alive) continue;

        const proc = getRemoteProcess(id);
        if (!proc) continue;

        const remote = getRemote(server.remoteId);
        if (!remote) continue;

        try {
          const result = await execCommand(
            remote,
            `ps -p ${proc.pid} -o %cpu= -o rss= --no-headers 2>/dev/null`,
          );
          const parts = result.stdout.trim().split(/\s+/);
          const cpu = parseFloat(parts[0]) || 0;
          const rssKb = parseInt(parts[1], 10) || 0;
          stats.push({
            id,
            cpu: Math.round(cpu * 10) / 10,
            ram: Math.round((rssKb / 1024) * 100) / 100,
            uptime: Math.floor((Date.now() - proc.startTime) / 1000),
          });
        } catch {
          stats.push({ id, cpu: 0, ram: 0, uptime: 0 });
        }
        continue;
      }

      if (!isRunning(id)) continue;

      const info = getProcessInfo(id);
      if (!info || !info.pid) continue;

      try {
        const usage = await pidusage(info.pid);
        stats.push({
          id,
          cpu: Math.round(usage.cpu * 10) / 10,
          ram: Math.round(usage.memory / 1024 / 1024 * 100) / 100,
          uptime: info.uptime,
        });
      } catch {
        stats.push({ id, cpu: 0, ram: 0, uptime: info.uptime });
      }
    }

    for (const listener of listeners) {
      listener(stats);
    }
  }, config.statsInterval);
}

export function stopStatsCollection() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function onStats(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
