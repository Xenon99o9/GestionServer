import { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Scan, Globe, Edit3, X, Check, Loader, Cpu, MemoryStick as Memory } from 'lucide-react';

export default function RemoteManager({ onBack, machineStats }) {
  const [remotes, setRemotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [scanning, setScanning] = useState({});
  const [form, setForm] = useState({
    name: '',
    host: '',
    port: '22',
    username: 'root',
    authType: 'password',
    password: '',
    privateKey: '',
    directory: '/home/minecraft/servers',
    javaPath: 'java',
  });

  async function fetchRemotes() {
    try {
      const res = await fetch('/api/remotes');
      setRemotes(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchRemotes();
  }, []);

  function resetForm() {
    setForm({
      name: '',
      host: '',
      port: '22',
      username: 'root',
      authType: 'password',
      password: '',
      privateKey: '',
      directory: '/home/minecraft/servers',
    });
    setEditingId(null);
    setShowForm(false);
  }

  function editRemote(r) {
    setForm({
      name: r.name,
      host: r.host,
      port: String(r.port || 22),
      username: r.username,
      authType: r.authType,
      password: r.password || '',
      privateKey: r.privateKey || '',
      directory: r.directory,
      javaPath: r.javaPath || 'java',
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await fetch(`/api/remotes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erreur modification');
      } else {
        const res = await fetch('/api/remotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erreur création');
      }
      resetForm();
      fetchRemotes();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette machine distante ? Les serveurs associés seront retirés.')) return;
    try {
      const res = await fetch(`/api/remotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur suppression');
      fetchRemotes();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleScan(id) {
    setScanning((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/remotes/${id}/scan`, { method: 'POST' });
      if (!res.ok) throw new Error('Erreur scan');
      const discovered = await res.json();
      alert(`${discovered.length} serveur(s) découvert(s) sur cette machine`);
    } catch (err) {
      alert(err.message);
    }
    setScanning((prev) => ({ ...prev, [id]: false }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition text-lg">&larr;</button>
          <h1 className="text-2xl font-bold">Machines distantes</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Ajouter une machine
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Modifier la machine' : 'Nouvelle machine distante'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Hôte (IP ou domaine)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Port SSH</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Utilisateur SSH</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type d'authentification</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value })}
              >
                <option value="password">Mot de passe</option>
                <option value="key">Clé SSH</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dossier de scan</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.directory}
                onChange={(e) => setForm({ ...form, directory: e.target.value })}
                required
              />
            </div>
            {form.authType === 'password' ? (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Mot de passe SSH</label>
                <input
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Clé privée SSH</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500"
                  rows={4}
                  value={form.privateKey}
                  onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..."
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Chemin Java (optionnel)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                value={form.javaPath}
                onChange={(e) => setForm({ ...form, javaPath: e.target.value })}
                placeholder="java (par défaut)"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition"
              >
                <Check className="w-4 h-4" />
                {editingId ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {remotes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
          <Globe className="w-16 h-16" />
          <p className="text-xl">Aucune machine distante configurée</p>
          <p className="text-sm">Cliquez sur "Ajouter une machine" pour en configurer une</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {remotes.map((r) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="font-semibold text-lg">{r.name}</h3>
                    <p className="text-sm text-gray-400">
                      {r.username}@{r.host}:{r.port}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScan(r.id)}
                    disabled={scanning[r.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-medium transition"
                  >
                    {scanning[r.id] ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scan className="w-3.5 h-3.5" />
                    )}
                    Scanner
                  </button>
                  <button
                    onClick={() => editRemote(r)}
                    className="p-1.5 text-gray-400 hover:text-white transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-gray-800 rounded">
                  {r.authType === 'key' ? 'Clé SSH' : 'Mot de passe'}
                </span>
                <span>Dossier: {r.directory}</span>
              </div>

              {(() => {
                const m = machineStats.find((s) => s.id === r.id);
                if (!m) return null;
                const cpu = m.cpu;
                const ramPct = m.ramTotal > 0 ? Math.round((m.ram / m.ramTotal) * 100) : 0;
                const ramGb = m.ram ? (m.ram / 1024).toFixed(1) : '?';
                const ramTotalGb = m.ramTotal ? (m.ramTotal / 1024).toFixed(1) : '?';

                return (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1 text-gray-400"><Cpu className="w-3 h-3" />CPU</span>
                        <span className="text-gray-300">{cpu !== null ? `${cpu}%` : 'N/A'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(cpu ?? 0, 100)}%`,
                            backgroundColor: cpu > 80 ? '#ef4444' : cpu > 50 ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1 text-gray-400"><Memory className="w-3 h-3" />RAM</span>
                        <span className="text-gray-300">{m.ram !== null ? `${ramGb} / ${ramTotalGb} GB` : 'N/A'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(ramPct, 100)}%`,
                            backgroundColor: ramPct > 80 ? '#ef4444' : ramPct > 50 ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
