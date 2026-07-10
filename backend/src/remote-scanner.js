import { listDirs, readFile, fileExists, findRemoteJavaPid, resolvePath, execCommand, shEscape } from './remote-connector.js';

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

async function detectRemoteJarTypeAndVersion(remote, serverPath) {
  try {
    const result = await execCommand(remote, `ls -1 '${serverPath}'/*.jar 2>/dev/null || true`, 10000);
    const jars = result.stdout.split('\n').filter(Boolean).map(f => f.split('/').pop());
    if (jars.length === 0) return {};

    let detected = {};

    for (const filename of jars) {
      if (filename === 'forge-installer.jar') continue;

      let match;

      match = filename.match(/^forge[_-](\d+\.\d+(?:\.\d+)?)/);
      if (match) {
        detected.type = 'forge';
        detected.version = match[1];
        break;
      }

      match = filename.match(/^fabric-(?:server-)?mc\.?(\d+\.\d+(?:\.\d+)?)/);
      if (match) {
        detected.type = 'fabric';
        detected.version = match[1];
        break;
      }

      match = filename.match(/^paper[_-](\d+\.\d+(?:\.\d+)?)/);
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

export async function scanRemoteServers(remote) {
  const servers = [];

  console.log(`[RemoteScan] Scanning remote ${remote.name} (${remote.host}) directory: ${remote.directory}`);

  const dirNames = await listDirs(remote, remote.directory);
  console.log(`[RemoteScan] Found ${dirNames.length} subdirectories in ${remote.directory}`, dirNames);

  const resolvedDir = await resolvePath(remote, remote.directory);

  for (const entry of dirNames) {
    const serverPath = `${resolvedDir}/${entry}`;
    const metaPath = `${serverPath}/server.json`;
    const propsPath = `${serverPath}/server.properties`;

    console.log(`[RemoteScan] Checking ${entry}...`);

    const metaExists = await fileExists(remote, metaPath);
    const propsExists = await fileExists(remote, propsPath);

    if (!metaExists && !propsExists) {
      console.log(`[RemoteScan]   -> Skipped: no server.json or server.properties`);
      continue;
    }

    try {
      let meta = {};
      let props = {};

      if (metaExists) {
        const metaContent = await readFile(remote, metaPath);
        if (metaContent) meta = JSON.parse(metaContent);
        console.log(`[RemoteScan]   -> Found server.json`);
      }

      if (propsExists) {
        const propsContent = await readFile(remote, propsPath);
        if (propsContent) props = parseProperties(propsContent);
        console.log(`[RemoteScan]   -> Found server.properties, port=${props['server-port']}`);
      }

      const serverId = meta.id || entry;

      const existingPid = await findRemoteJavaPid(remote, serverPath);

      let type = (meta.type && meta.type !== 'generic') ? meta.type : null;
      let version = (meta.version && meta.version !== 'unknown') ? meta.version : null;

      if (!type || !version) {
        const jarInfo = await detectRemoteJarTypeAndVersion(remote, serverPath);
        if (!type && jarInfo.type) type = jarInfo.type;
        if (!version && jarInfo.version) version = jarInfo.version;
      }

      if (!type) type = 'vanilla';
      if (!version) version = 'unknown';

      servers.push({
        id: serverId,
        name: meta.name || entry,
        path: serverPath,
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
        remote: true,
        remoteId: remote.id,
        remoteHost: remote.host,
        status: existingPid ? 'online' : 'stopped',
        pid: existingPid,
      });

      if (existingPid) {
        console.log(`[RemoteScan]   -> Already running with PID ${existingPid}`);
      }

      console.log(`[RemoteScan]   -> Server detected: ${entry} (${serverId})`);
    } catch (err) {
      console.log(`[RemoteScan]   -> Error: ${err.message}`);
      continue;
    }
  }

  console.log(`[RemoteScan] Scan complete: ${servers.length} server(s) found`);
  return servers;
}