import { useState, useEffect } from 'react';
import ServerControls from '../components/ServerControls';
import Console from '../components/Console';
import StatsChart from '../components/StatsChart';
import PlayerList from '../components/PlayerList';
import EditServerDialog from '../components/EditServerDialog';
import WhitelistPanel from '../components/WhitelistPanel';
import BanPanel from '../components/BanPanel';
import ModManager from '../components/ModManager';
import { Loader, History, RotateCcw, Puzzle } from 'lucide-react';

const NEEDS_LOADER = { forge: true, fabric: true };

export default function ServerDetail({ server, onBack }) {
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showUpdatePicker, setShowUpdatePicker] = useState(false);
  const [versions, setVersions] = useState([]);
  const [updateType, setUpdateType] = useState('vanilla');
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateLoader, setUpdateLoader] = useState('');
  const [loaders, setLoaders] = useState([]);
  const [loadersLoading, setLoadersLoading] = useState(false);
  const [manualVersion, setManualVersion] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (NEEDS_LOADER[updateType] && updateVersion) {
      fetchLoaders(updateType, updateVersion);
    } else {
      setLoaders([]);
    }
  }, [updateType, updateVersion]);

  async function fetchLoaders(type, mcVersion) {
    setLoadersLoading(true);
    try {
      const res = await fetch(`/api/loaders?type=${type}&mc=${mcVersion}`);
      const data = await res.json();
      setLoaders(data);
      if (data.length > 0) setUpdateLoader(data[0].id || data[0].build);
    } catch {} finally {
      setLoadersLoading(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/servers/${server.id}`, { method: 'DELETE' });
      if (res.ok) onBack();
    } catch {}
  }

  async function openUpdatePicker() {
    try {
      const res = await fetch('/api/versions');
      const data = await res.json();
      setVersions(data.versions || []);
      setUpdateType(server.type || 'vanilla');
      setUpdateVersion(server.version || data.latest?.release || '');
      setUpdateLoader(server.loaderVersion || '');
      setShowUpdatePicker(true);
    } catch {}
  }

  async function handleUpdate() {
    setUpdating(true);
    try {
      const payload = { type: updateType, version: updateVersion };
      if (NEEDS_LOADER[updateType] && updateLoader) payload.loaderVersion = updateLoader;
      await fetch(`/api/servers/${server.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setShowUpdatePicker(false);
      window.location.reload();
    } catch {} finally {
      setUpdating(false);
    }
  }

  async function openRollback() {
    setBackupsLoading(true);
    setShowRollback(true);
    setRollbackTarget(null);
    try {
      const res = await fetch(`/api/servers/${server.id}/backups`);
      const data = await res.json();
      setBackups(data);
    } catch {} finally {
      setBackupsLoading(false);
    }
  }

  async function handleRollback() {
    if (!rollbackTarget) return;
    setRestoring(true);
    try {
      await fetch(`/api/servers/${server.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: rollbackTarget }),
      });
      setShowRollback(false);
      window.location.reload();
    } catch {} finally {
      setRestoring(false);
    }
  }

  function formatDate(dateStr) {
    return dateStr.replace(/T/, ' ').replace(/\.\d+Z/, '').replace(/-/g, '/');
  }

  const releases = versions.filter((v) => v.type === 'release');

  return (
    <div>
      {showEdit && (
        <EditServerDialog
          server={server}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); window.location.reload(); }}
        />
      )}

      {showUpdatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Mettre à jour {server.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select value={updateType} onChange={(e) => setUpdateType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                  <option value="vanilla">Vanilla</option>
                  <option value="paper">Paper</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Version Minecraft</label>
                {manualVersion ? (
                  <div className="flex gap-2">
                    <input type="text" value={updateVersion} onChange={(e) => setUpdateVersion(e.target.value)} placeholder="ex: 1.20.1" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                    <button onClick={() => setManualVersion(false)} className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition">Liste</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={updateVersion} onChange={(e) => { const v = e.target.value; if (v === '__manual__') { setManualVersion(true); setUpdateVersion(''); } else { setUpdateVersion(v); } }} className={'flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500' + (updateVersion === '__manual__' ? ' text-yellow-400' : '')}>
                      <option value="__manual__">✏️ Saisie manuelle...</option>
                      {releases.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
                    </select>
                    <button onClick={() => { setManualVersion(true); setUpdateVersion(''); }} className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition">✏️</button>
                  </div>
                )}
              </div>
              {NEEDS_LOADER[updateType] && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {updateType === 'forge' ? 'Build Forge' : 'Version Fabric Loader'}
                  </label>
                  {loadersLoading ? (
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                      <Loader className="w-3 h-3 animate-spin" />
                      Chargement...
                    </div>
                  ) : loaders.length === 0 ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-yellow-400">
                      Aucun loader pour cette version
                    </div>
                  ) : (
                    <select value={updateLoader} onChange={(e) => setUpdateLoader(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                      {loaders.map((l) => (
                        <option key={l.id || l.build} value={l.id || l.build}>
                          {l.id || l.build} {l.stable ? '(stable)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">Une sauvegarde complète sera créée avant la mise à jour.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowUpdatePicker(false)} className="text-sm text-gray-400 hover:text-white transition">Annuler</button>
              <button onClick={handleUpdate} disabled={updating} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition">
                {updating ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {updating ? 'Mise à jour...' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md mx-4 p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Restaurer {server.name}</h3>
              <button onClick={() => setShowRollback(false)} className="text-gray-400 hover:text-white"><History className="w-5 h-5" /></button>
            </div>

            {backupsLoading ? (
              <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : backups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aucun backup disponible</p>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto">
                {backups.map((b, i) => (
                  <div key={i} className={`flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 ${rollbackTarget === b.name ? 'ring-2 ring-yellow-500' : ''}`}>
                    <div className="text-sm">
                      <span className="text-gray-300">{b.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{formatDate(b.date)}</span>
                    </div>
                    <button
                      onClick={() => setRollbackTarget(b.name)}
                      className={`px-2 py-1 text-xs rounded transition ${rollbackTarget === b.name ? 'bg-yellow-700 text-yellow-200' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {rollbackTarget === b.name ? 'Sélectionné' : 'Choisir'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {rollbackTarget && (
              <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-300">
                Le serveur sera arrêté, restauré, puis redémarré s'il était en ligne.
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowRollback(false)} className="text-sm text-gray-400 hover:text-white transition">Annuler</button>
              <button
                onClick={handleRollback}
                disabled={!rollbackTarget || restoring}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {restoring ? <Loader className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {restoring ? 'Restauration...' : 'Restaurer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1">
        ← Retour au dashboard
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <p className="text-sm text-gray-500">{server.type} {server.version}{server.loaderVersion ? ` (${server.loaderVersion})` : ''} · Port {server.port}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openUpdatePicker} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            Mettre à jour
          </button>
          <button onClick={openRollback} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            Restaurer
          </button>
          <button onClick={() => setShowEdit(true)} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            Modifier
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 rounded-lg transition">Confirmer la mise à la corbeille</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg transition">Mettre à la corbeille</button>
          )}
          <ServerControls server={server} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Ressources</h2>
            <StatsChart server={server} />
          </div>
        </div>
        <div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Joueurs</h2>
            <PlayerList server={server} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Whitelist</h2>
          <WhitelistPanel server={server} />
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Bannissements</h2>
          <BanPanel server={server} />
        </div>
      </div>

      {(server.type === 'fabric' || server.type === 'forge') && (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Puzzle className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Mods</h2>
            </div>
            <ModManager server={server} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Console</h2>
          <Console server={server} />
        </div>
      </div>
    </div>
  );
}