import { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Loader, Box, Globe } from 'lucide-react';

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg text-sm font-medium transition">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Suppression...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms) {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes}min`;
}

export default function TrashPage({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trash');
      const data = await res.json();
      setItems(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  async function handleRestore(trashId) {
    setRestoreLoading(trashId);
    try {
      const res = await fetch(`/api/trash/${encodeURIComponent(trashId)}/restore`, { method: 'POST' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.trashId !== trashId));
      }
    } catch {} finally {
      setRestoreLoading(null);
    }
  }

  async function handleDelete(trashId) {
    setActionLoading(trashId);
    try {
      const res = await fetch(`/api/trash/${encodeURIComponent(trashId)}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.trashId !== trashId));
      }
    } catch {} finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  }

  async function handleEmpty() {
    setActionLoading('empty');
    try {
      await fetch('/api/trash/empty', { method: 'POST' });
      setItems([]);
    } catch {} finally {
      setActionLoading(null);
      setConfirmEmpty(false);
    }
  }

  const now = Date.now();

  return (
    <div>
      {confirmDelete && (
        <ConfirmModal
          title="Supprimer définitivement"
          message={`Êtes-vous sûr de vouloir supprimer définitivement « ${confirmDelete.name} » ? Cette action est irréversible.`}
          onConfirm={() => handleDelete(confirmDelete.trashId)}
          onCancel={() => setConfirmDelete(null)}
          loading={actionLoading === confirmDelete.trashId}
        />
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Vider la corbeille"
          message="Tous les éléments de la corbeille seront supprimés définitivement. Cette action est irréversible."
          onConfirm={handleEmpty}
          onCancel={() => setConfirmEmpty(false)}
          loading={actionLoading === 'empty'}
        />
      )}

      <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1">
        ← Retour au dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-bold">Corbeille</h1>
          {!loading && items.length > 0 && (
            <span className="text-sm text-gray-500">({items.length} élément{items.length > 1 ? 's' : ''})</span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            disabled={actionLoading === 'empty'}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-300 disabled:opacity-50 rounded-lg text-sm transition"
          >
            {actionLoading === 'empty' ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Vider la corbeille
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Trash2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">La corbeille est vide</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const deletedAt = new Date(item.deletedAt).getTime();
            const age = now - deletedAt;
            const expiresIn = Math.max(0, 30 * 24 * 60 * 60 * 1000 - age);

            return (
              <div key={item.trashId} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.remote ? (
                        <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Box className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400 capitalize shrink-0">
                        {item.type}{item.version ? ` ${item.version}` : ''}{item.loaderVersion ? ` (${item.loaderVersion})` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Supprimé le {formatDate(item.deletedAt)}</span>
                      <span>Port {item.port}</span>
                      {item.remote && item.remoteHost ? (
                        <span>Distant: {item.remoteHost}</span>
                      ) : (
                        <span>Local</span>
                      )}
                      <span className="text-yellow-600">Expire dans {formatDuration(expiresIn)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(item.trashId)}
                      disabled={restoreLoading === item.trashId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-xs font-medium transition"
                    >
                      {restoreLoading === item.trashId ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Restaurer
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item)}
                      disabled={actionLoading === item.trashId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 disabled:opacity-50 rounded-lg text-xs font-medium transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}