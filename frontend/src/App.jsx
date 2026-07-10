import { useState, useEffect } from 'react';
import socket from './socket';
import Dashboard from './pages/Dashboard';
import ServerDetail from './pages/ServerDetail';
import CreateServerForm from './components/CreateServerForm';
import RemoteManager from './pages/RemoteManager';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import { Server, Plus, Box, Globe, Trash2, Settings } from 'lucide-react';

export default function App() {
  const [servers, setServers] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState({});
  const [rconData, setRconData] = useState({});
  const [playerData, setPlayerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [machineStats, setMachineStats] = useState([]);

  useEffect(() => {
    function onInit(list) {
      setServers(list);
      setLoading(false);
    }

    function onStatus({ id, status }) {
      setStatuses((prev) => ({ ...prev, [id]: status }));
    }

    function onStats(arr) {
      setStats((prev) => {
        const next = { ...prev };
        for (const s of arr) next[s.id] = s;
        return next;
      });
    }

    function onMachineStats(arr) {
      setMachineStats(arr);
    }

    function onLog({ id, line }) {
      setLogs((prev) => {
        const existing = prev[id] || [];
        return { ...prev, [id]: [...existing.slice(-199), line] };
      });
    }

    function onRcon({ id, players, tps }) {
      setRconData((prev) => ({ ...prev, [id]: { players, tps } }));
    }

    function onPlayers({ id, players }) {
      setPlayerData((prev) => ({ ...prev, [id]: players }));
    }

    function onCreated({ id, name }) {
      fetchServers();
    }

    function onDeleted({ id }) {
      setServers((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) {
        setPage('dashboard');
        setSelectedId(null);
      }
    }

    function onReload(list) {
      setServers(list);
    }

    socket.on('servers:init', onInit);
    socket.on('servers:reload', onReload);
    socket.on('server:status', onStatus);
    socket.on('server:stats', onStats);
    socket.on('machine:stats', onMachineStats);
    socket.on('server:log', onLog);
    socket.on('server:rcon', onRcon);
    socket.on('server:players', onPlayers);
    socket.on('server:created', onCreated);
    socket.on('server:deleted', onDeleted);

    if (!loading) fetchServers();

    const fallbackTimer = setTimeout(() => {
      if (loading) {
        fetchServers();
      }
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
      socket.off('servers:init', onInit);
      socket.off('servers:reload', onReload);
      socket.off('server:status', onStatus);
      socket.off('server:stats', onStats);
      socket.off('machine:stats', onMachineStats);
      socket.off('server:log', onLog);
      socket.off('server:rcon', onRcon);
      socket.off('server:players', onPlayers);
      socket.off('server:created', onCreated);
      socket.off('server:deleted', onDeleted);
    };
  }, []);

  async function fetchServers() {
    try {
      const res = await fetch('/api/servers');
      const data = await res.json();
      setServers(data);
      setLoading(false);
    } catch {}
  }

  function navigate(page, id) {
    setPage(page);
    setSelectedId(id);
  }

  const mergedServers = servers.map((s) => ({
    ...s,
    ...(statuses[s.id] ? { status: statuses[s.id] } : {}),
    stats: stats[s.id],
    logs: logs[s.id] || [],
    rcon: rconData[s.id],
    players: playerData[s.id] || (rconData[s.id]?.players || null),
  }));

  const selectedServer = mergedServers.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate('dashboard')} className="flex items-center gap-2 text-lg font-bold hover:text-green-400 transition">
          <Box className="w-6 h-6 text-green-400" />
          GestionServer
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('trash')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">
            <Trash2 className="w-4 h-4 text-red-400" />
            Corbeille
          </button>
          <button onClick={() => navigate('settings')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">
            <Settings className="w-4 h-4 text-gray-400" />
            Dossiers
          </button>
          <button onClick={() => navigate('remotes')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
            <Globe className="w-4 h-4" />
            Machines distantes
          </button>
          <button onClick={() => navigate('create')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            Nouveau serveur
          </button>
          <span className="text-sm text-gray-500">{servers.length} serveur{servers.length > 1 ? 's' : ''}</span>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
          </div>
        ) : page === 'dashboard' ? (
          <Dashboard servers={mergedServers} onSelect={(id) => navigate('detail', id)} />
        ) : page === 'detail' && selectedServer ? (
          <ServerDetail
            server={selectedServer}
            onBack={() => navigate('dashboard')}
          />
        ) : page === 'remotes' ? (
          <RemoteManager onBack={() => navigate('dashboard')} machineStats={machineStats} />
        ) : page === 'trash' ? (
          <TrashPage onBack={() => navigate('dashboard')} />
        ) : page === 'settings' ? (
          <SettingsPage onBack={() => navigate('dashboard')} />
        ) : page === 'create' ? (
          <CreateServerForm
            onCreated={() => navigate('dashboard')}
            onCancel={() => navigate('dashboard')}
          />
        ) : (
          <Dashboard servers={mergedServers} onSelect={(id) => navigate('detail', id)} />
        )}
      </main>
    </div>
  );
}
