import { mkdirSync, writeFileSync, copyFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from './config.js';
import { execCommand, resolvePath, putFile, shEscape } from './remote-connector.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = join(__dirname, '..', 'templates');

export async function createServer(options) {
  const {
    name, type = 'vanilla', version = 'latest', jarPath = null,
    minRam = 1, maxRam = 2, port = 25565,
    enableRcon = false, rconPassword = '', rconPort = 25575,
    loaderVersion = null, targetDir = null,
  } = options;

  const id = randomUUID().slice(0, 8);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = targetDir || config.serversDir;
  const serverPath = join(baseDir, safeName);

  if (existsSync(serverPath)) {
    throw new Error(`Un dossier nommé "${safeName}" existe déjà`);
  }

  mkdirSync(serverPath, { recursive: true });
  mkdirSync(join(serverPath, 'logs'));
  mkdirSync(join(serverPath, 'plugins'));
  mkdirSync(join(serverPath, 'mods'));

  let dirCreated = true;
  let jarFilename = 'server.jar';

  try {
    if (jarPath) {
      const src = resolve(jarPath);
      copyFileSync(src, join(serverPath, jarFilename));
    } else {
      const downloaded = await downloadServerJar(type, version, serverPath, loaderVersion);
      jarFilename = downloaded;
      if (type === 'forge') {
        await runForgeInstaller(serverPath, downloaded, options.javaPath || 'java');
        jarFilename = await findForgeJar(serverPath, version, loaderVersion);
      }
    }

    const serverProperties = generateServerProperties({ ...options, port, enableRcon, rconPassword, rconPort, motd: options.motd || `${name} - GestionServer` });
    writeFileSync(join(serverPath, 'server.properties'), serverProperties);
    writeFileSync(join(serverPath, 'eula.txt'), 'eula=true\n');

    const meta = buildMeta(id, name, type, version, minRam, maxRam, jarFilename, port, enableRcon, rconPassword, rconPort, { ...options, loaderVersion });
    writeFileSync(join(serverPath, 'server.json'), JSON.stringify(meta, null, 2));

    return { ...meta, path: serverPath, status: 'stopped', pid: null };
  } catch (err) {
    if (dirCreated) {
      rmSync(serverPath, { recursive: true, force: true });
    }
    throw err;
  }
}

export async function createRemoteServer(options, remote) {
  const {
    name, type = 'vanilla', version = 'latest', jarPath = null,
    minRam = 1, maxRam = 2, port = 25565,
    enableRcon = false, rconPassword = '', rconPort = 25575,
    loaderVersion = null,
  } = options;

  const id = randomUUID().slice(0, 8);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseDir = await resolvePath(remote, remote.directory);
  const serverPath = `${baseDir}/${safeName}`;

  const exists = await execCommand(remote, `test -d '${serverPath}' && echo "1" || echo "0"`);
  if (exists.stdout.trim() === '1') {
    throw new Error(`Un dossier nommé "${safeName}" existe déjà sur la machine distante`);
  }

  await execCommand(remote, `mkdir -p '${serverPath}/logs' '${serverPath}/plugins' '${serverPath}/mods'`);
  let dirCreated = true;

  try {
    const javaPath = options.javaPath || remote.javaPath || 'java';
    const templatePath = await ensureTemplateJar(type, version, loaderVersion);
    const jarRemotePath = `${serverPath}/${type === 'forge' ? 'forge-installer.jar' : 'server.jar'}`;
    await putFile(remote, templatePath, jarRemotePath);

    let finalJar = 'server.jar';
    if (type === 'forge') {
      await execCommand(remote, `cd '${serverPath}' && ${javaPath} -jar forge-installer.jar --installServer`, 120000);
      await execCommand(remote, `rm -f '${serverPath}/forge-installer.jar' '${serverPath}/run.sh' '${serverPath}/run.bat'`);
      const jarName = `forge-${loaderVersion}.jar`;
      finalJar = jarName;
      await execCommand(remote, `test -f '${serverPath}/${jarName}' || (ls '${serverPath}'/*.jar 2>/dev/null | head -1 | xargs -I{} basename {} > '${serverPath}/.jarname')`);
    }

    const props = generateServerProperties({ ...options, port, enableRcon, rconPassword, rconPort, motd: options.motd || `${name} - GestionServer` });
    const b64Props = Buffer.from(props, 'utf-8').toString('base64');
    await execCommand(remote, `echo '${b64Props}' | base64 -d > '${serverPath}/server.properties'`);
    await execCommand(remote, `echo 'eula=true' > '${serverPath}/eula.txt'`);

    const meta = buildMeta(id, name, type, version, minRam, maxRam, finalJar, port, enableRcon, rconPassword, rconPort, { ...options, loaderVersion });
    const b64Meta = Buffer.from(JSON.stringify(meta, null, 2), 'utf-8').toString('base64');
    await execCommand(remote, `echo '${b64Meta}' | base64 -d > '${serverPath}/server.json'`);

    return { ...meta, path: serverPath, status: 'stopped', pid: null, remote: true, remoteId: remote.id };
  } catch (err) {
    if (dirCreated) {
      await execCommand(remote, `rm -rf '${serverPath}'`, 30000).catch(() => {});
    }
    throw err;
  }
}

export function buildMeta(id, name, type, version, minRam, maxRam, jar, port, enableRcon, rconPassword, rconPort, extras = {}) {
  const {
    difficulty, gamemode, maxPlayers, onlineMode, pvp, allowFlight,
    hardcore, enableCommandBlock, announceAdvancements, motd,
    spawnProtection, viewDistance, enforceWhitelist, maxWorldSize,
    resourcePack, requireResourcePack, enableStatus, javaPath,
    loaderVersion,
  } = extras;

  return {
    id, name, type, version, minRam, maxRam, jar, port,
    rcon: { enabled: enableRcon, port: rconPort, password: rconPassword },
    autoStart: false,
    javaPath: javaPath || 'java',
    loaderVersion: loaderVersion || null,
    createdAt: new Date().toISOString(),
    ...(difficulty !== undefined && { difficulty }),
    ...(gamemode !== undefined && { gamemode }),
    ...(maxPlayers !== undefined && { maxPlayers }),
    ...(onlineMode !== undefined && { onlineMode }),
    ...(pvp !== undefined && { pvp }),
    ...(allowFlight !== undefined && { allowFlight }),
    ...(hardcore !== undefined && { hardcore }),
    ...(enableCommandBlock !== undefined && { enableCommandBlock }),
    ...(announceAdvancements !== undefined && { announceAdvancements }),
    ...(motd !== undefined && { motd }),
    ...(spawnProtection !== undefined && { spawnProtection }),
    ...(viewDistance !== undefined && { viewDistance }),
    ...(enforceWhitelist !== undefined && { enforceWhitelist }),
    ...(maxWorldSize !== undefined && { maxWorldSize }),
    ...(resourcePack !== undefined && { resourcePack }),
    ...(requireResourcePack !== undefined && { requireResourcePack }),
    ...(enableStatus !== undefined && { enableStatus }),
  };
}

export function generateServerProperties(opts = {}) {
  const {
    port = 25565,
    enableRcon = false, rconPassword = '', rconPort = 25575,
    motd = 'GestionServer',
    maxPlayers = 20,
    onlineMode = true,
    difficulty = 'easy',
    gamemode = 'survival',
    pvp = true,
    allowFlight = false,
    hardcore = false,
    enableCommandBlock = false,
    announceAdvancements = true,
    spawnProtection = 16,
    viewDistance = 10,
    simulationDistance = 10,
    enforceWhitelist = false,
    maxWorldSize = 29999984,
    resourcePack = '',
    requireResourcePack = false,
    enableStatus = true,
  } = opts;

  return [
    'minecraft.api.auth.host=https://authserver.mojang.com',
    'minecraft.api.session.host=https://sessionserver.mojang.com',
    'minecraft.api.services.host=https://api.minecraftservices.com',
    'motd=' + motd,
    'server-port=' + port,
    'enable-rcon=' + enableRcon,
    'rcon.password=' + (enableRcon ? rconPassword : ''),
    'rcon.port=' + rconPort,
    'broadcast-rcon-to-ops=true',
    'max-players=' + maxPlayers,
    'online-mode=' + onlineMode,
    'difficulty=' + difficulty,
    'gamemode=' + gamemode,
    'pvp=' + pvp,
    'allow-flight=' + allowFlight,
    'hardcore=' + hardcore,
    'enable-command-block=' + enableCommandBlock,
    'announce-player-achievements=' + announceAdvancements,
    'spawn-protection=' + spawnProtection,
    'view-distance=' + viewDistance,
    'simulation-distance=' + simulationDistance,
    'enforce-whitelist=' + enforceWhitelist,
    'max-world-size=' + maxWorldSize,
    ...(resourcePack ? ['resource-pack=' + resourcePack] : []),
    ...(requireResourcePack ? ['require-resource-pack=' + requireResourcePack] : []),
    'enable-status=' + enableStatus,
    '',
  ].join('\n');
}

export async function ensureTemplateJar(type, version, loaderVersion) {
  if (!existsSync(templatesDir)) mkdirSync(templatesDir, { recursive: true });

  let filename;
  if (type === 'fabric') {
    filename = `fabric-${version}-${loaderVersion}.jar`;
  } else if (type === 'forge') {
    if (!loaderVersion) throw new Error('loaderVersion requis pour Forge');
    filename = `forge-${loaderVersion}-installer.jar`;
  } else {
    filename = `${type}-${version}.jar`;
  }
  const templatePath = join(templatesDir, filename);

  if (existsSync(templatePath)) return templatePath;

  const url = await getDownloadUrl(type, version, loaderVersion);
  if (!url) throw new Error(`Téléchargement auto non supporté pour ${type}`);

  console.log(`[Templates] Téléchargement de ${type} ${version}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Échec du téléchargement: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(templatePath, buffer);
  console.log(`[Templates] ${type} ${version} → ${templatePath}`);

  return templatePath;
}

async function downloadServerJar(type, version, destPath, loaderVersion) {
  const templatePath = await ensureTemplateJar(type, version, loaderVersion);
  const dest = join(destPath, type === 'forge' ? 'forge-installer.jar' : 'server.jar');
  copyFileSync(templatePath, dest);
  return type === 'forge' ? 'forge-installer.jar' : 'server.jar';
}

export async function runForgeInstaller(serverPath, jarFile, javaBin) {
  const jarPath = join(serverPath, jarFile);
  const jp = shEscape(jarPath);
  console.log(`[Forge] Exécution de l'installer dans ${serverPath}...`);
  await execAsync(`${javaBin} -jar '${jp}' --installServer`, { cwd: serverPath, timeout: 120000 });
  // Cleanup installer and scripts
  for (const f of ['forge-installer.jar', 'run.sh', 'run.bat']) {
    try { rmSync(join(serverPath, f), { force: true }); } catch {}
  }
  console.log(`[Forge] Installer terminé`);
}

export async function findForgeJar(serverPath, version, loaderVersion) {
  const expected = `forge-${loaderVersion || version}.jar`;
  if (existsSync(join(serverPath, expected))) return expected;
  const jars = readdirSync(serverPath).filter(f => f.endsWith('.jar') && f !== 'forge-installer.jar');
  if (jars.length > 0) return jars[0];
  return 'server.jar';
}

export async function getDownloadUrl(type, version, loaderVersion) {
  switch (type) {
    case 'vanilla': {
      const hash = await getVanillaHash(version);
      return `https://piston-data.mojang.com/v1/objects/${hash}/server.jar`;
    }
    case 'paper':
      return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/latest/downloads/paper-${version}-latest.jar`;
    case 'fabric':
      if (!loaderVersion) throw new Error('loaderVersion requis pour Fabric');
      return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/server/jar`;
    case 'forge':
      if (!loaderVersion) throw new Error('loaderVersion requis pour Forge');
      return `https://maven.minecraftforge.net/net/minecraftforge/forge/${loaderVersion}/forge-${loaderVersion}-installer.jar`;
    default:
      return null;
  }
}

export async function fetchVersions() {
  const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const data = await res.json();
  return {
    latest: data.latest,
    versions: data.versions.map((v) => ({ id: v.id, type: v.type, url: v.url })),
  };
}

export async function getForgeBuilds(mcVersion) {
  const res = await fetch('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
  const xml = await res.text();
  const versions = [];
  const regex = /<version>([^<]+)<\/version>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const v = match[1];
    if (v.startsWith(mcVersion + '-')) {
      versions.push({ id: v, build: v.replace(mcVersion + '-', '') });
    }
  }
  versions.sort((a, b) => {
    const na = a.build.split('.').map(Number);
    const nb = b.build.split('.').map(Number);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      if ((na[i] || 0) !== (nb[i] || 0)) return (nb[i] || 0) - (na[i] || 0);
    }
    return 0;
  });
  return versions;
}

export async function getFabricLoaders(mcVersion) {
  const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  const data = await res.json();
  return data.map((e) => ({
    id: e.loader.version,
    stable: e.loader.stable,
    maven: e.loader.maven,
  }));
}

async function getVanillaHash(version) {
  const data = await fetchVersions();
  const entry = data.versions.find((v) => v.id === version) || data.versions.find((v) => v.id === data.latest.release);
  if (!entry) throw new Error(`Version "${version}" introuvable`);
  const verRes = await fetch(entry.url);
  const verData = await verRes.json();
  return verData.downloads.server.sha1;
}