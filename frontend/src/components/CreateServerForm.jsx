import { useState, useEffect } from 'react';
import { X, Loader, Globe, HardDrive, FolderOpen } from 'lucide-react';

const SERVER_TYPES = [
  { value: 'vanilla', label: 'Vanilla', needsVersion: true },
  { value: 'paper', label: 'Paper', needsVersion: true },
  { value: 'fabric', label: 'Fabric', needsVersion: true, needsLoader: true },
  { value: 'forge', label: 'Forge', needsVersion: true, needsLoader: true },
  { value: 'custom', label: 'Custom JAR', needsVersion: false },
];

export default function CreateServerForm({ onCreated, onCancel }) {
  const [location, setLocation] = useState('local');
  const [localDirs, setLocalDirs] = useState([]);
  const [localDirsLoading, setLocalDirsLoading] = useState(true);
  const [remotes, setRemotes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [loaders, setLoaders] = useState([]);
  const [loadersLoading, setLoadersLoading] = useState(false);
  const [manualVersion, setManualVersion] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'paper',
    version: '',
    loaderVersion: '',
    minRam: 1,
    maxRam: 2,
    port: 25565,
    remoteId: '',
    targetDir: '',
    enableRcon: true,
    rconPassword: Math.random().toString(36).slice(2, 10),
    rconPort: 25575,
    jarPath: '',
    javaPath: '',
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchVersions();
    fetchRemotes();
    fetchLocalDirs();
  }, []);

  async function fetchLocalDirs() {
    setLocalDirsLoading(true);
    try {
      const res = await fetch('/api/local-dirs');
      const data = await res.json();
      const dirs = data.dirs || [];
      setLocalDirs(dirs);
      if (dirs.length > 0) setForm((prev) => ({ ...prev, targetDir: dirs[0] }));
    } catch {} finally {
      setLocalDirsLoading(false);
    }
  }

  async function fetchVersions() {
    try {
      const res = await fetch('/api/versions');
      const data = await res.json();
      setVersions(data.versions || []);
      if (data.versions?.length > 0) {
        const latest = data.latest?.release;
        if (latest && data.versions.find((v) => v.id === latest)) {
          setForm((prev) => ({ ...prev, version: latest }));
        } else {
          setForm((prev) => ({ ...prev, version: data.versions[0].id }));
        }
      }
    } catch {} finally {
      setVersionsLoading(false);
    }
  }

  async function fetchRemotes() {
    try {
      const res = await fetch('/api/remotes');
      const data = await res.json();
      setRemotes(data);
    } catch {}
  }

  useEffect(() => {
    const st = SERVER_TYPES.find((t) => t.value === form.type);
    if (st?.needsLoader && form.version) {
      fetchLoaders(form.type, form.version);
    } else {
      setLoaders([]);
    }
  }, [form.type, form.version]);

  async function fetchLoaders(type, mcVersion) {
    setLoadersLoading(true);
    try {
      const res = await fetch(`/api/loaders?type=${type}&mc=${mcVersion}`);
      const data = await res.json();
      setLoaders(data);
      if (data.length > 0) {
        setForm((prev) => ({ ...prev, loaderVersion: data[0].id || data[0].build }));
      }
    } catch {} finally {
      setLoadersLoading(false);
    }
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const releases = versions.filter((v) => v.type === 'release');
  const snapshots = versions.filter((v) => v.type === 'snapshot');
  const selectedType = SERVER_TYPES.find((t) => t.value === form.type);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const payload = { ...form };
      delete payload.remoteId;
      delete payload.targetDir;
      if (location === 'remote') {
        if (!form.remoteId) throw new Error('Veuillez sélectionner une machine distante');
        payload.remoteId = form.remoteId;
      } else {
        if (!form.targetDir) throw new Error('Veuillez sélectionner un dossier de destination');
        payload.targetDir = form.targetDir;
      }
      if (payload.type !== 'custom') delete payload.jarPath;
      if (!selectedType?.needsLoader) delete payload.loaderVersion;

      const res = await fetch('/api/servers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur inconnue');
      }

      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Créer un serveur</h1>
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Emplacement</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setLocation('local'); update('remoteId', ''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  location === 'local'
                    ? 'bg-green-700 text-white ring-2 ring-green-500'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <HardDrive className="w-4 h-4" />
                Local
              </button>
              <button
                type="button"
                onClick={() => { setLocation('remote'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  location === 'remote'
                    ? 'bg-blue-700 text-white ring-2 ring-blue-500'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                Machine distante
              </button>
            </div>
          </div>

          {location === 'remote' && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Machine distante</label>
              <select
                value={form.remoteId}
                onChange={(e) => update('remoteId', e.target.value)}
                required={location === 'remote'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Sélectionner une machine...</option>
                {remotes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.host})
                  </option>
                ))}
              </select>
            </div>
          )}

          {location === 'local' && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Dossier de destination</label>
              {localDirsLoading ? (
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                  <Loader className="w-3 h-3 animate-spin" />
                  Chargement...
                </div>
              ) : localDirs.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-yellow-400 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  <span>Aucun dossier configuré — ajoutez-en dans <strong>Dossiers</strong></span>
                </div>
              ) : (
                <select
                  value={form.targetDir}
                  onChange={(e) => update('targetDir', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                >
                  {localDirs.map((d, i) => (
                    <option key={i} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Nom du serveur</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              placeholder="Mon Serveur"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              {SERVER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Version</label>
            {selectedType?.needsVersion ? (
              versionsLoading ? (
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                  <Loader className="w-3 h-3 animate-spin" />
                  Chargement...
                </div>
              ) : manualVersion ? (
                <div className="flex gap-2">
                  <input type="text" value={form.version} onChange={(e) => update('version', e.target.value)} placeholder="ex: 1.20.1" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  <button type="button" onClick={() => setManualVersion(false)} className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition">Liste</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={form.version}
                    onChange={(e) => { const v = e.target.value; if (v === '__manual__') { setManualVersion(true); update('version', ''); } else { update('version', v); } }}
                    required
                    className="flex-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="__manual__">✏️ Saisie manuelle...</option>
                    {releases.length > 0 && (
                      <optgroup label="─ Releases ─">
                        {releases.map((v) => (
                          <option key={v.id} value={v.id}>{v.id}</option>
                        ))}
                      </optgroup>
                    )}
                    {snapshots.length > 0 && (
                      <optgroup label="─ Snapshots ─">
                        {snapshots.map((v) => (
                          <option key={v.id} value={v.id}>{v.id}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button type="button" onClick={() => { setManualVersion(true); update('version', ''); }} className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition">✏️</button>
                </div>
              )
            ) : (
              <input
                type="text"
                value="N/A"
                disabled
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm opacity-40"
              />
            )}
          </div>

          {selectedType?.needsLoader && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">
                {form.type === 'forge' ? 'Build Forge' : 'Version du loader Fabric'}
              </label>
              {loadersLoading ? (
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                  <Loader className="w-3 h-3 animate-spin" />
                  Chargement des loaders...
                </div>
              ) : loaders.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-yellow-400">
                  Aucun loader trouvé pour cette version
                </div>
              ) : (
                <select
                  value={form.loaderVersion}
                  onChange={(e) => update('loaderVersion', e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                >
                  {loaders.map((l) => (
                    <option key={l.id || l.build} value={l.id || l.build}>
                      {l.id || l.build} {l.stable ? '(stable)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">RAM min (GB)</label>
            <input
              type="number"
              min={1}
              max={32}
              value={form.minRam}
              onChange={(e) => update('minRam', parseInt(e.target.value) || 1)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">RAM max (GB)</label>
            <input
              type="number"
              min={1}
              max={64}
              value={form.maxRam}
              onChange={(e) => update('maxRam', parseInt(e.target.value) || 2)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Port</label>
            <input
              type="number"
              min={1024}
              max={65535}
              value={form.port}
              onChange={(e) => update('port', parseInt(e.target.value) || 25565)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {form.type === 'custom' && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Chemin du JAR</label>
              <input
                type="text"
                value={form.jarPath}
                onChange={(e) => update('jarPath', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                placeholder="/chemin/vers/server.jar"
              />
            </div>
          )}

          {location === 'remote' && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Chemin Java (optionnel, hérité de la machine distante)</label>
              <input
                type="text"
                value={form.javaPath}
                onChange={(e) => update('javaPath', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                placeholder="java"
              />
            </div>
          )}

          <div className="col-span-2 border-t border-gray-800 pt-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">RCON</h3>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="enableRcon"
                checked={form.enableRcon}
                onChange={(e) => update('enableRcon', e.target.checked)}
                className="rounded bg-gray-800 border-gray-600"
              />
              <label htmlFor="enableRcon" className="text-sm">Activer RCON</label>
            </div>

            {form.enableRcon && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Mot de passe RCON</label>
                  <input
                    type="text"
                    value={form.rconPassword}
                    onChange={(e) => update('rconPassword', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port RCON</label>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={form.rconPort}
                    onChange={(e) => update('rconPort', parseInt(e.target.value) || 25575)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            {creating ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {creating ? 'Création...' : 'Créer le serveur'}
          </button>
        </div>
      </form>
    </div>
  );
}