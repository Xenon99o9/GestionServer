import { NodeSSH } from 'node-ssh';
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const connections = new Map();

function buildConfig(remote) {
  const config = {
    host: remote.host,
    port: remote.port || 22,
    username: remote.username || 'root',
    readyTimeout: 10000,
  };
  if (remote.authType === 'key' && remote.privateKey) {
    config.privateKey = remote.privateKey;
  } else if (remote.password) {
    config.password = remote.password;
  }
  return config;
}

export async function connect(remote) {
  const existing = connections.get(remote.id);
  if (existing) {
    try {
      if (existing.isConnected()) return existing;
    } catch {}
    connections.delete(remote.id);
  }

  const ssh = new NodeSSH();
  await ssh.connect(buildConfig(remote));
  connections.set(remote.id, ssh);
  return ssh;
}

export function getConnection(remoteId) {
  return connections.get(remoteId) || null;
}

export async function disconnect(remoteId) {
  const ssh = connections.get(remoteId);
  if (ssh) {
    try { ssh.dispose(); } catch {}
    connections.delete(remoteId);
  }
}

export async function disconnectAll() {
  for (const [id] of connections) {
    await disconnect(id);
  }
}

export async function execCommand(remote, command, timeout = 15000) {
  const ssh = await connect(remote);
  const result = await ssh.execCommand(command, { timeout });
  return result;
}

export async function putFile(remote, source, remotePath) {
  const ssh = await connect(remote);
  if (Buffer.isBuffer(source)) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gs-'));
    const tmpFile = join(tmpDir, 'upload');
    writeFileSync(tmpFile, source);
    try {
      await ssh.putFile(tmpFile, remotePath);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
      try { rmdirSync(tmpDir); } catch {}
    }
  } else {
    await ssh.putFile(source, remotePath);
  }
}

export async function resolvePath(remote, rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return rawPath;
  if (rawPath.startsWith('~')) {
    const homeResult = await execCommand(remote, 'echo $HOME');
    const home = homeResult.stdout.trim();
    if (home) {
      const rest = rawPath.slice(1);
      return rest ? `${home}${rest}` : home;
    }
  }
  return rawPath;
}

export function shEscape(str) {
  return String(str).replace(/'/g, "'\\''");
}

export async function listDir(remote, dirPath) {
  const path = await resolvePath(remote, dirPath);
  const result = await execCommand(remote, `ls -1 '${shEscape(path)}'`);
  if (result.code !== 0) return [];
  return result.stdout.split('\n').filter(Boolean);
}

export async function listDirs(remote, dirPath) {
  const path = await resolvePath(remote, dirPath);
  const result = await execCommand(remote, `ls -1d '${shEscape(path)}'/*/ 2>/dev/null; true`);
  if (result.code !== 0 && result.stderr) return [];
  return result.stdout.split('\n').filter(Boolean).map((e) => {
    let name = e.replace(/\/$/, '');
    const idx = name.lastIndexOf('/');
    return idx >= 0 ? name.slice(idx + 1) : name;
  });
}

export async function readFile(remote, filePath) {
  const path = await resolvePath(remote, filePath);
  const result = await execCommand(remote, `cat '${shEscape(path)}'`);
  if (result.code !== 0) return null;
  return result.stdout;
}

export async function fileExists(remote, filePath) {
  const path = await resolvePath(remote, filePath);
  const result = await execCommand(remote, `test -f '${shEscape(path)}' && echo "1" || echo "0"`);
  return result.stdout.trim() === '1';
}

export async function dirExists(remote, dirPath) {
  const path = await resolvePath(remote, dirPath);
  const result = await execCommand(remote, `test -d '${shEscape(path)}' && echo "1" || echo "0"`);
  return result.stdout.trim() === '1';
}

export async function findRemoteJavaPid(remote, serverPath) {
  const path = await resolvePath(remote, serverPath);
  const result = await execCommand(remote, `
    target=$(readlink -f '${shEscape(path)}' 2>/dev/null || echo '${shEscape(path)}')
    for pid in $(ps -eo pid= 2>/dev/null); do
      cwd=$(readlink /proc/$pid/cwd 2>/dev/null) || continue
      cwd="\${cwd%  (deleted)}"
      [ "$cwd" = "$target" ] && echo "$pid" && break
    done
  `.trim().replace(/\n\s+/g, ' '));
  const pid = parseInt(result.stdout.trim(), 10);
  return isNaN(pid) ? null : pid;
}

export async function getMachineStats(remote) {
  const cpuResult = await execCommand(remote, `top -bn1 2>/dev/null | grep 'Cpu(s)' | awk '{print $2+$4}' || echo 0`);
  const cpu = parseFloat(cpuResult.stdout.trim()) || 0;

  const ramResult = await execCommand(remote, `free -m 2>/dev/null | awk '/Mem:/{print $3, $2}' || echo "0 0"`);
  const [ramUsed, ramTotal] = ramResult.stdout.trim().split(/\s+/).map(Number);

  return { cpu: Math.round(cpu * 10) / 10, ram: ramUsed || 0, ramTotal: ramTotal || 0 };
}
