import { useState, useEffect, useCallback } from 'react';
import { Search, Loader, Download, Trash2, Package, ExternalLink } from 'lucide-react';

export default function ModManager({ server }) {
  const [activeTab, setActiveTab] = useState('installed');
  const [mods, setMods] = useState([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetchMods = useCallback(async () => {
    setModsLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/mods`);
      const data = await res.json();
      setMods(data);
    } catch {} finally {
      setModsLoading(false);
    }
  }, [server.id]);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ query: query.trim() });
      if (server.type === 'fabric' || server.type === 'forge') params.set('loader', server.type);
      if (server.version) params.set('version', server.version);
      const res = await fetch(`/api/mods/search?${params}`);
      const data = await res.json();
      setSearchResults(data);
      setActiveTab('search');
    } catch {} finally {
      setSearching(false);
    }
  }

  async function getVersions(projectId) {
    if (expanded === projectId) {
      setExpanded(null);
      return;
    }
    try {
      const params = new URLSearchParams({ projectId });
      if (server.type === 'fabric' || server.type === 'forge') params.set('loader', server.type);
      if (server.version) params.set('version', server.version);
      const res = await fetch(`/api/mods/versions?${params}`);
      const data = await res.json();
      setSearchResults((prev) =>
        prev.map((m) =>
          m.projectId === projectId ? { ...m, _versions: data } : m
        )
      );
      setExpanded(projectId);
    } catch {}
  }

  async function doInstall(projectId, versionId) {
    setInstalling(projectId);
    try {
      const res = await fetch(`/api/servers/${server.id}/mods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, versionId }),
      });
      if (res.ok) {
        fetchMods();
        setActiveTab('installed');
      }
    } catch {} finally {
      setInstalling(null);
    }
  }

  async function doRemove(filename) {
    try {
      await fetch(`/api/servers/${server.id}/mods/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      fetchMods();
    } catch {}
  }

  function formatDownloads(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="Rechercher un mod sur Modrinth..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={doSearch}
          disabled={searching}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-sm transition"
        >
          {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-3 py-1.5 text-xs rounded-lg transition ${activeTab === 'installed' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
        >
          Installés ({mods.length})
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-3 py-1.5 text-xs rounded-lg transition ${activeTab === 'search' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
        >
          Résultats ({searchResults.length})
        </button>
      </div>

      {activeTab === 'installed' && (
        <div>
          {modsLoading ? (
            <div className="flex justify-center py-6"><Loader className="w-5 h-5 animate-spin text-gray-500" /></div>
          ) : mods.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Aucun mod installé</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {mods.map((m) => (
                <div key={m.filename} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-sm truncate">{m.name}</span>
                  </div>
                  <button
                    onClick={() => doRemove(m.filename)}
                    className="p-1 text-red-400 hover:text-red-300 shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {searching ? 'Recherche...' : 'Cherchez un mod pour commencer'}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((m) => (
                <div key={m.projectId} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    {m.iconUrl ? (
                      <img src={m.iconUrl} alt="" className="w-8 h-8 rounded shrink-0" />
                    ) : (
                      <Package className="w-8 h-8 p-1 bg-gray-700 rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium truncate">{m.title}</h4>
                          <p className="text-xs text-gray-500">{m.author}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => getVersions(m.projectId)}
                            className="p-1 text-gray-400 hover:text-white"
                            title="Voir les versions"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span>{formatDownloads(m.downloads)} téléchargements</span>
                        <span>{m.serverSide === 'required' ? 'Serveur: Oui' : m.serverSide === 'optional' ? 'Serveur: Optionnel' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {m._versions && expanded === m.projectId && (
                    <div className="mt-2 pl-11 space-y-1">
                      {m._versions.length === 0 ? (
                        <p className="text-xs text-gray-500">Aucune version compatible</p>
                      ) : (
                        m._versions.slice(0, 5).map((v) => (
                          <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5">
                            <div className="min-w-0">
                              <span className="text-xs text-gray-300 truncate block">{v.name}</span>
                              <span className="text-xs text-gray-600">{v.gameVersions.join(', ')}</span>
                            </div>
                            <button
                              onClick={() => doInstall(m.projectId, v.id)}
                              disabled={installing === m.projectId}
                              className="flex items-center gap-1 px-2 py-1 bg-green-800 hover:bg-green-700 disabled:opacity-50 rounded text-xs transition"
                            >
                              {installing === m.projectId ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              Installer
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}