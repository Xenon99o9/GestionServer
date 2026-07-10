import { Server, Cpu, MemoryStick as Memory, Users, Wifi, WifiOff, Globe } from 'lucide-react';

const statusColors = {
  online: 'bg-green-500',
  starting: 'bg-yellow-500 animate-pulse',
  stopped: 'bg-gray-600',
  error: 'bg-red-500',
};

const statusLabels = {
  online: 'En ligne',
  starting: 'Démarrage...',
  stopped: 'Arrêté',
  error: 'Erreur',
};

export default function ServerCard({ server, onClick }) {
  const { name, type, version, status, stats, rcon, port, players } = server;
  const color = statusColors[status] || statusColors.stopped;
  const label = statusLabels[status] || status;

  return (
    <button onClick={onClick} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-600 transition text-left w-full">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-green-400" />
          <span className="font-semibold">{name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        {server.remote && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">
            <Globe className="w-3 h-3" />Distant
          </span>
        )}
        <span className="px-2 py-0.5 bg-gray-800 rounded">{type}</span>
        {version && <span className="px-2 py-0.5 bg-gray-800 rounded">{version}</span>}
        <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{port}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <Cpu className="w-4 h-4 mx-auto mb-1 text-blue-400" />
          <div className="text-sm font-medium">{stats ? `${stats.cpu}%` : '-'}</div>
          <div className="text-[10px] text-gray-500">CPU</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <Memory className="w-4 h-4 mx-auto mb-1 text-purple-400" />
          <div className="text-sm font-medium">{stats ? `${stats.ram} MB` : '-'}</div>
          <div className="text-[10px] text-gray-500">RAM</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          {players && players.length > 0 ? (
            <div className="flex -space-x-1.5 justify-center mb-1">
              {players.slice(0, 5).map((p) => (
                <img
                  key={p}
                  src={`https://mc-heads.net/avatar/${p}/24`}
                  alt={p}
                  title={p}
                  className="w-6 h-6 rounded-full border border-gray-900"
                />
              ))}
              {players.length > 5 && (
                <span className="w-6 h-6 rounded-full bg-gray-700 border border-gray-900 flex items-center justify-center text-[10px] text-gray-300 font-medium">
                  +{players.length - 5}
                </span>
              )}
            </div>
          ) : (
            <Users className="w-4 h-4 mx-auto mb-1 text-green-400" />
          )}
          <div className="text-sm font-medium">
            {players ? players.length : (rcon ? rcon.players?.length || 0 : '-')}
          </div>
          <div className="text-[10px] text-gray-500">Joueurs</div>
        </div>
      </div>
    </button>
  );
}
