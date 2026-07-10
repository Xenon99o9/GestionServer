import { User } from 'lucide-react';

export default function PlayerList({ server }) {
  const { rcon, status, players } = server;
  const list = players || rcon?.players || [];

  if (status !== 'online') {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600">
        <User className="w-8 h-8 mb-2" />
        <p className="text-sm">Serveur hors ligne</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600">
        <User className="w-8 h-8 mb-2" />
        <p className="text-sm">Aucun joueur connecté</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 mb-2">{list.length} joueur{list.length > 1 ? 's' : ''} connecté{list.length > 1 ? 's' : ''}</p>
      {list.map((player, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <img
            src={`https://mc-heads.net/avatar/${player}/32`}
            alt={player}
            title={player}
            className="w-6 h-6 rounded-full"
          />
          <span className="text-sm">{player}</span>
        </div>
      ))}
    </div>
  );
}
