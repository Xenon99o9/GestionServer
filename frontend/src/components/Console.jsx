import { useRef, useEffect, useState } from 'react';
import { Send, ArrowDownToLine } from 'lucide-react';

export default function Console({ server }) {
  const { id, logs = [] } = server;
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs, autoScroll]);

  function scrollToBottom() {
    setAutoScroll(true);
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }

  async function sendCommand(e) {
    e.preventDefault();
    if (!input.trim()) return;
    await fetch(`/api/servers/${id}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: input }),
    });
    setInput('');
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="bg-black rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs leading-relaxed"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 50);
        }}
      >
        {logs.length === 0 ? (
          <span className="text-gray-600">En attente des logs...</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="text-gray-300">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && logs.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-14 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition shadow-lg"
          title="Revenir en bas"
        >
          <ArrowDownToLine className="w-4 h-4 text-gray-300" />
        </button>
      )}

      <form onSubmit={sendCommand} className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Envoyer une commande..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        />
        <button type="submit" className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
