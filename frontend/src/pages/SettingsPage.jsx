import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, Trash2, Loader, AlertTriangle } from 'lucide-react';

export default function SettingsPage({ onBack }) {
  const [dirs, setDirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [error, setError] = useState('');

  const fetchDirs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/local-dirs');
      const data = await res.json();
      setDirs(data.dirs || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDirs(); }, [fetchDirs]);

  async function handleAdd() {
    if (!newPath.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/local-dirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur inconnue');
      }
      setNewPath('');
      await fetchDirs();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(dirPath) {
    try {
      const res = await fetch(`/api/local-dirs/${encodeURIComponent(dirPath)}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmRemove(null);
        await fetchDirs();
      }
    } catch {}
  }

  return (
    <div>
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-semibold">Supprimer le dossier</h3>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              Êtes-vous sûr de vouloir retirer <code className="text-gray-300 bg-gray-800 px-1 rounded">{confirmRemove}</code> de la liste ?
            </p>
            <p className="text-xs text-yellow-500 mb-6">Les serveurs qui s'y trouvent ne seront plus détectés.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Annuler</button>
              <button onClick={() => handleRemove(confirmRemove)} className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 rounded-lg font-medium transition">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1">
        ← Retour au dashboard
      </button>

      <div className="flex items-center gap-3 mb-6">
        <FolderOpen className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold">Dossiers de serveurs</h1>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Ajouter un dossier</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => { setNewPath(e.target.value); setAddError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="/chemin/vers/mes/serveurs"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newPath.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            {adding ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>
        {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        <p className="text-xs text-gray-500 mt-2">
          Le dossier doit contenir des sous-dossiers avec un <code className="text-gray-400">server.json</code>.
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Dossiers scannés ({loading ? '...' : dirs.length})
        </h2>

        {loading ? (
          <div className="flex justify-center py-8"><Loader className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : dirs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Aucun dossier configuré</p>
        ) : (
          <div className="space-y-2">
            {dirs.map((dir, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm truncate block">{dir}</span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmRemove(dir)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg shrink-0 transition"
                  title="Retirer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}