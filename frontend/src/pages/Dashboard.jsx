import ServerCard from '../components/ServerCard';

export default function Dashboard({ servers, onSelect }) {
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
        <div className="text-6xl">🗄️</div>
        <p className="text-xl">Aucun serveur trouvé</p>
        <p className="text-sm">Cliquez sur "Nouveau serveur" pour en créer un</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {servers.map((server) => (
          <ServerCard key={server.id} server={server} onClick={() => onSelect(server.id)} />
        ))}
      </div>
    </div>
  );
}
