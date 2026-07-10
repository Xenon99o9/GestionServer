import { readdirSync, unlinkSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execCommand, putFile, shEscape } from './remote-connector.js';
import { getRemote } from './remote-store.js';

const MODRINTH_API = 'https://api.modrinth.com/v2';

export async function searchMods(query, loader, gameVersion, limit = 20) {
  const facets = [];
  facets.push(['project_type:mod']);
  if (loader) facets.push([`categories:${loader}`]);
  if (gameVersion) facets.push([`versions:${gameVersion}`]);

  const params = new URLSearchParams({
    query,
    facets: JSON.stringify(facets),
    limit: String(limit),
  });

  const res = await fetch(`${MODRINTH_API}/search?${params}`);
  if (!res.ok) throw new Error(`Modrinth search error: ${res.status}`);
  const data = await res.json();

  return data.hits.map((h) => ({
    projectId: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    iconUrl: h.icon_url,
    author: h.author,
    versions: h.versions,
    downloads: h.downloads,
    follows: h.follows,
    clientSide: h.client_side,
    serverSide: h.server_side,
  }));
}

export async function getModVersions(projectId, loader, gameVersion) {
  const params = new URLSearchParams();
  if (loader) params.append('loaders', JSON.stringify([loader]));
  if (gameVersion) params.append('game_versions', JSON.stringify([gameVersion]));

  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version?${params}`);
  if (!res.ok) throw new Error(`Modrinth versions error: ${res.status}`);
  const data = await res.json();

  return data.map((v) => ({
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    datePublished: v.date_published,
    gameVersions: v.game_versions,
    loaders: v.loaders,
    files: v.files.map((f) => ({
      url: f.url,
      filename: f.filename,
      size: f.size,
    })),
  }));
}

export async function installMod(server, projectId, versionId) {
  // Fetch version info to get the download URL
  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version/${versionId}`);
  if (!res.ok) throw new Error(`Version introuvable: ${res.status}`);
  const version = await res.json();

  const file = version.files?.[0];
  if (!file) throw new Error('Aucun fichier disponible pour cette version');

  // Download the mod JAR
  const dlRes = await fetch(file.url);
  if (!dlRes.ok) throw new Error(`Échec téléchargement mod: ${dlRes.status}`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());

  if (server.remote) {
    const remote = getRemote(server.remoteId);
    if (!remote) throw new Error('Remote introuvable');

    const remotePath = `${server.path}/mods/${file.filename}`;
    await putFile(remote, buffer, remotePath);
  } else {
    const modsDir = join(server.path, 'mods');
    if (!existsSync(modsDir)) mkdirSync(modsDir, { recursive: true });
    writeFileSync(join(modsDir, file.filename), buffer);
  }

  return { filename: file.filename, name: version.name, versionNumber: version.version_number };
}

export function listMods(server) {
  const modsDir = join(server.path, 'mods');
  if (!existsSync(modsDir)) return [];
  return readdirSync(modsDir)
    .filter((f) => f.endsWith('.jar'))
    .map((f) => ({ filename: f, name: f.replace(/\.jar$/, '') }));
}

export async function listRemoteMods(server) {
  const remote = getRemote(server.remoteId);
  if (!remote) throw new Error('Remote introuvable');
  const result = await execCommand(remote, `ls -1 '${shEscape(server.path)}/mods/'*.jar 2>/dev/null || true`);
  return result.stdout.split('\n').filter(Boolean).map((f) => {
    const filename = f.split('/').pop();
    return { filename, name: filename.replace(/\.jar$/, '') };
  });
}

export function removeMod(server, filename) {
  const modPath = join(server.path, 'mods', filename);
  if (!existsSync(modPath)) throw new Error(`Mod "${filename}" introuvable`);
  unlinkSync(modPath);
  return { success: true };
}

export async function removeRemoteMod(server, filename) {
  const remote = getRemote(server.remoteId);
  if (!remote) throw new Error('Remote introuvable');
  await execCommand(remote, `rm -f '${shEscape(server.path)}/mods/${shEscape(filename)}'`);
  return { success: true };
}