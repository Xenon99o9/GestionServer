import { useState, useEffect } from 'react';
import { Plus, X, Loader, ShieldOff } from 'lucide-react';

export default function BanPanel({ server }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPlayer, setNewPlayer] = useState('');
  const [adding, setAdding] = useState(false);

  async function fetchList() {
    try {
      const res = await fetch(`/api/servers/${server.id}/bans`);
      const data = await res.json();
      setList(data);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); }, [server.id]);

  async function addPlayer() {
    if (!newPlayer.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: newPlayer.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setList(data);
        setNewPlayer('');
      }
    } catch {} finally {
      setAdding(false);
    }
  }

  async function removePlayer(player) {
    try {
      const res = await fetch(`/api/servers/${server.id}/bans/${player}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setList(data);
      }
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={newPlayer}
          onChange={(e) => setNewPlayer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
          placeholder="Bannir un joueur..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        />
        <button
          onClick={addPlayer}
          disabled={adding || !newPlayer.trim()}
          className="p-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
        >
          {adding ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader className="w-5 h-5 animate-spin text-gray-500" /></div>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Aucun bannissement</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {list.map((entry, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <img src={`https://mc-heads.net/avatar/${entry.name}/24`} alt="" className="w-5 h-5 rounded-full" />
                <span className="text-sm">{entry.name}</span>
                {entry.reason && <span className="text-xs text-gray-500">— {entry.reason}</span>}
              </div>
              <button onClick={() => removePlayer(entry.name)} className="text-gray-500 hover:text-green-400 transition" title="Pardon">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}