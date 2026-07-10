import { Play, Square, RotateCcw } from 'lucide-react';

export default function ServerControls({ server }) {
  const { id, status } = server;
  const isRunning = status === 'online' || status === 'starting';

  async function action(endpoint) {
    await fetch(`/api/servers/${id}/${endpoint}`, { method: 'POST' });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => action('start')}
        disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
      >
        <Play className="w-4 h-4" /> Start
      </button>
      <button
        onClick={() => action('stop')}
        disabled={!isRunning}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
      >
        <Square className="w-4 h-4" /> Stop
      </button>
      <button
        onClick={() => action('restart')}
        disabled={!isRunning}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
      >
        <RotateCcw className="w-4 h-4" /> Restart
      </button>
    </div>
  );
}
