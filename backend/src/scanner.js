import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getLocalDirs } from './local-store.js';

export function scanServers() {
  const servers = [];
  const seenIds = new Set();
  const dirs = getLocalDirs();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serverPath = join(dir, entry.name);
      const metaPath = join(serverPath, 'server.json');
      const propsPath = join(serverPath, 'server.properties');

      if (!existsSync(metaPath)) continue;

      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        const props = existsSync(propsPath)
          ? parseProperties(readFileSync(propsPath, 'utf-8'))
          : {};

        let type = (meta.type && meta.type !== 'generic') ? meta.type : null;
        let version = (meta.version && meta.version !== 'unknown') ? meta.version : null;

        if (!type || !version) {
          const jarInfo = detectJarTypeAndVersion(serverPath);
          if (!type && jarInfo.type) type = jarInfo.type;
          if (!version && jarInfo.version) version = jarInfo.version;
        }

        if (!type) type = 'vanilla';
        if (!version) version = 'unknown';

        const sid = meta.id || entry.name;
        if (seenIds.has(sid)) {
          console.warn(`[Scanner] Duplicate server ID "${sid}" skipped (dir: ${dir}/${entry.name})`);
          continue;
        }
        seenIds.add(sid);

        servers.push({
          id: sid,
          name: meta.name || entry.name,
          path: serverPath,
          localDir: dir,
          type,
          version,
          loaderVersion: meta.loaderVersion || null,
          minRam: meta.minRam || 1,
          maxRam: meta.maxRam || 2,
          port: parseInt(props['server-port'], 10) || 25565,
          rcon: {
            enabled: props['enable-rcon'] === 'true',
            port: parseInt(props['rcon.port'], 10) || 25575,
            password: props['rcon.password'] || '',
          },
          jar: meta.jar || 'server.jar',
          autoStart: meta.autoStart || false,
          javaPath: meta.javaPath || 'java',
          status: 'stopped',
          pid: null,
        });
      } catch {
        continue;
      }
    }
  }

  return servers;
}

function detectJarTypeAndVersion(serverPath) {
  try {
    const files = readdirSync(serverPath);
    let detected = {};

    for (const file of files) {
      if (!file.endsWith('.jar')) continue;
      if (file === 'forge-installer.jar') continue;

      let match;

      match = file.match(/^forge[_-](\d+\.\d+(?:\.\d+)?)/);
      if (match) {
        detected.type = 'forge';
        detected.version = match[1];
        break;
      }

      match = file.match(/^fabric-(?:server-)?mc\.?(\d+\.\d+(?:\.\d+)?)/);
      if (match) {
        detected.type = 'fabric';
        detected.version = match[1];
        break;
      }

      match = file.match(/^paper[_-](\d+\.\d+(?:\.\d+)?)/);
      if (match) {
        detected.type = 'paper';
        detected.version = match[1];
        break;
      }
    }

    return detected;
  } catch {}
  return {};
}

function parseProperties(content) {
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    props[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return props;
}