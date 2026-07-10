import { getMachineStats } from './remote-connector.js';
import { getRemotes } from './remote-store.js';

const listeners = new Set();
let interval = null;

export function startMachineStatsCollection() {
  if (interval) return;

  interval = setInterval(async () => {
    const stats = [];

    const remotes = getRemotes();

    for (const remote of remotes) {
      try {
        const machineStats = await getMachineStats(remote);
        stats.push({
          id: remote.id,
          name: remote.name,
          host: remote.host,
          ...machineStats,
        });
      } catch (err) {
        stats.push({
          id: remote.id,
          name: remote.name,
          host: remote.host,
          cpu: null,
          ram: null,
          ramTotal: null,
        });
      }
    }

    for (const listener of listeners) {
      listener(stats);
    }
  }, 5000);
}

export function stopMachineStatsCollection() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function onMachineStats(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
