import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function StatsChart({ server }) {
  const { stats } = server;
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!stats) return;
    setHistory((prev) => {
      const next = [...prev, { time: new Date().toLocaleTimeString(), cpu: stats.cpu, ram: stats.ram }];
      return next.slice(-60);
    });
  }, [stats]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats ? `${stats.cpu}%` : '-'}</div>
          <div className="text-xs text-gray-500">CPU</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{stats ? `${stats.ram} MB` : '-'}</div>
          <div className="text-xs text-gray-500">RAM</div>
        </div>
      </div>

      {history.length > 1 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={history}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="cpu" stroke="#60a5fa" strokeWidth={2} dot={false} name="CPU %" />
            <Line type="monotone" dataKey="ram" stroke="#a78bfa" strokeWidth={2} dot={false} name="RAM MB" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
