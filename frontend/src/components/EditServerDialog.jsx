import { useState } from 'react';
import { X, Loader } from 'lucide-react';

const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];
const GAMEMODES = ['survival', 'creative', 'adventure', 'spectator'];

function Section({ title, children }) {
  return (
    <div className="border-t border-gray-800 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children, colSpan }) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded bg-gray-800 border-gray-600" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function EditServerDialog({ server, onClose, onSaved }) {
  const s = server;
  const [form, setForm] = useState({
    name: s.name || '',
    port: s.port || 25565,
    motd: s.motd || '',
    maxPlayers: s.maxPlayers ?? 20,
    onlineMode: s.onlineMode ?? true,
    enableStatus: s.enableStatus ?? true,
    maxWorldSize: s.maxWorldSize ?? 29999984,
    difficulty: s.difficulty || 'easy',
    gamemode: s.gamemode || 'survival',
    pvp: s.pvp ?? true,
    allowFlight: s.allowFlight ?? false,
    hardcore: s.hardcore ?? false,
    enableCommandBlock: s.enableCommandBlock ?? false,
    announceAdvancements: s.announceAdvancements ?? true,
    spawnProtection: s.spawnProtection ?? 16,
    enforceWhitelist: s.enforceWhitelist ?? false,
    minRam: s.minRam || 1,
    maxRam: s.maxRam || 2,
    viewDistance: s.viewDistance ?? 10,
    resourcePack: s.resourcePack || '',
    requireResourcePack: s.requireResourcePack ?? false,
    enableRcon: s.rcon?.enabled ?? false,
    rconPassword: s.rcon?.password || '',
    rconPort: s.rcon?.port || 25575,
    javaPath: s.javaPath || '',
    loaderVersion: s.loaderVersion || '',
    type: s.type || 'vanilla',
    version: s.version || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        minRam: Number(form.minRam),
        maxRam: Number(form.maxRam),
        port: Number(form.port),
        maxPlayers: Number(form.maxPlayers),
        spawnProtection: Number(form.spawnProtection),
        viewDistance: Number(form.viewDistance),
        maxWorldSize: Number(form.maxWorldSize),
        rconPort: Number(form.rconPort),
        rcon: { enabled: form.enableRcon, password: form.rconPassword, port: Number(form.rconPort) },
      };
      delete payload.enableRcon;
      delete payload.rconPassword;
      delete payload.rconPort;

      const res = await fetch(`/api/servers/${server.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erreur inconnue');
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function num(field) {
    return (e) => update(field, parseInt(e.target.value) || 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold">Modifier {server.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <Section title="Général">
              <Field label="Nom" colSpan={2}>
                <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </Field>
              <Field label="Type">
                <select value={form.type} onChange={(e) => update('type', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                  <option value="vanilla">Vanilla</option>
                  <option value="paper">Paper</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="custom">Custom JAR</option>
                </select>
              </Field>
              <Field label="Version">
                <input type="text" value={form.version} onChange={(e) => update('version', e.target.value)} placeholder="ex: 1.21.4" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </Field>
              <p className="col-span-2 text-xs text-yellow-600 -mt-2">Le type et la version sont informatifs. Pour changer le type/version du serveur, utilisez « Mettre à jour ».</p>
              <Field label="Port"><input type="number" min={1024} max={65535} value={form.port} onChange={num('port')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <Field label="Joueurs max"><input type="number" min={1} max={1000} value={form.maxPlayers} onChange={num('maxPlayers')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <Field label="MOTD" colSpan={2}>
                <input type="text" value={form.motd} onChange={(e) => update('motd', e.target.value)} placeholder={`${server.name} - GestionServer`} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </Field>
              <Field label="Chemin Java" colSpan={2}>
                <input type="text" value={form.javaPath} onChange={(e) => update('javaPath', e.target.value)} placeholder="java" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </Field>
              <Field label="Taille max du monde"><input type="number" min={1} value={form.maxWorldSize} onChange={num('maxWorldSize')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <div className="flex flex-col gap-2 pt-1">
                <Toggle checked={form.onlineMode} onChange={(v) => update('onlineMode', v)} label="Mode en ligne (premium)" />
                <Toggle checked={form.enableStatus} onChange={(v) => update('enableStatus', v)} label="Visible dans la liste publique" />
              </div>
            </Section>

            <Section title="Gameplay">
              <Field label="Difficulté">
                <select value={form.difficulty} onChange={(e) => update('difficulty', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Mode de jeu">
                <select value={form.gamemode} onChange={(e) => update('gamemode', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                  {GAMEMODES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Protection du spawn"><input type="number" min={0} max={64} value={form.spawnProtection} onChange={num('spawnProtection')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <div className="flex flex-col gap-2 pt-1">
                <Toggle checked={form.pvp} onChange={(v) => update('pvp', v)} label="PvP" />
                <Toggle checked={form.allowFlight} onChange={(v) => update('allowFlight', v)} label="Vol autorisé" />
                <Toggle checked={form.hardcore} onChange={(v) => update('hardcore', v)} label="Hardcore" />
                <Toggle checked={form.enableCommandBlock} onChange={(v) => update('enableCommandBlock', v)} label="Command blocks" />
                <Toggle checked={form.announceAdvancements} onChange={(v) => update('announceAdvancements', v)} label="Annoncer les succès" />
              </div>
            </Section>

            <Section title="Whitelist">
              <Toggle checked={form.enforceWhitelist} onChange={(v) => update('enforceWhitelist', v)} label="Forcer la whitelist" />
            </Section>

            <Section title="RCON">
              <Toggle checked={form.enableRcon} onChange={(v) => update('enableRcon', v)} label="Activer RCON" />
              {form.enableRcon && (
                <>
                  <Field label="Mot de passe"><input type="text" value={form.rconPassword} onChange={(e) => update('rconPassword', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
                  <Field label="Port"><input type="number" min={1024} max={65535} value={form.rconPort} onChange={num('rconPort')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
                </>
              )}
            </Section>

            <Section title="Ressources">
              <Field label="RAM min (GB)"><input type="number" min={1} max={32} value={form.minRam} onChange={num('minRam')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <Field label="RAM max (GB)"><input type="number" min={1} max={64} value={form.maxRam} onChange={num('maxRam')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <Field label="Distance de vue"><input type="number" min={2} max={32} value={form.viewDistance} onChange={num('viewDistance')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" /></Field>
              <Field label="Resource pack (URL)" colSpan={2}>
                <input type="text" value={form.resourcePack} onChange={(e) => update('resourcePack', e.target.value)} placeholder="https://..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
              </Field>
              {form.resourcePack && (
                <div className="col-span-2">
                  <Toggle checked={form.requireResourcePack} onChange={(v) => update('requireResourcePack', v)} label="Forcer le resource pack" />
                </div>
              )}
            </Section>

          </div>

          {error && <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Annuler</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}