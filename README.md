<div align="center">
  <img src="frontend/src/assets/hero.png" alt="GestionServer" width="120" />
  <h1>GestionServer</h1>
  <p><strong>Gérez vos serveurs Minecraft depuis une application de bureau</strong></p>
  <p>
    <img src="https://img.shields.io/badge/plateforme-Windows%20%7C%20Linux-blue" alt="Platform" />
    <img src="https://img.shields.io/badge/Minecraft-1.20--1.21-green" alt="Minecraft" />
    <img src="https://img.shields.io/badge/licence-MIT-orange" alt="License" />
  </p>
</div>

---

## Fonctionnalités

- **Multi-plateforme** — Windows et Linux (AppImage / pacman / exe)
- **Serveurs locaux et distants** — Gérez des serveurs sur votre machine ou sur un serveur distant (SSH)
- **Multi-types** — Vanilla, Paper, Forge, Fabric
- **Corbeille** — Mettez à la corbeille au lieu de supprimer définitivement, restaurez plus tard
- **Rollback** — Sauvegardes automatiques et restauration en un clic
- **Mods** — Cherchez et installez des mods depuis Modrinth
- **Console** — Terminal intégré avec logs en direct
- **RCON** — Commandes à distance sans ouvrir le jeu
- **Statistiques** — CPU, RAM, joueurs connectés
- **Whitelist & Bans** — Gérez les accès à vos serveurs

## Installation

### Depuis une Release (recommandé)

Téléchargez la dernière version depuis la [page Releases](https://github.com/Xenon99o9/GestionServer/releases) :

| Plateforme | Format |
|------------|--------|
| **Linux** (toutes distributions) | `.AppImage` |
| **Linux Arch** | `.pacman` |
| **Windows** | `.exe` (installateur NSIS) |

### Depuis les sources

```bash
git clone https://github.com/Xenon99o9/GestionServer.git
cd GestionServer
npm install
npm run build:electron
```

`npm install` installe automatiquement les dépendances du backend, du frontend et d'Electron. Le build produit l'exécutable dans le dossier `dist/`.

## Développement

```bash
# Lancer en mode web (navigateur)
npm run dev

# Lancer en mode application de bureau
npm run dev:electron
```

- Le backend Express tourne sur le port **3001**
- Le frontend React (Vite) est sur le port **5173** en mode dev
- Les logs backend s'affichent dans le terminal

## Architecture

```
GestionServer/
├── backend/
│   ├── src/
│   │   ├── index.js          # Serveur Express + Socket.IO
│   │   ├── config.js         # Configuration
│   │   ├── scanner.js        # Scan des serveurs locaux
│   │   ├── server-manager.js # Démarrage/arrêt des serveurs
│   │   ├── server-creator.js # Création de serveurs (Vanilla, Paper, Forge, Fabric)
│   │   ├── server-updater.js # Mise à jour de serveurs
│   │   ├── trash-manager.js  # Gestion de la corbeille
│   │   ├── backup.js         # Sauvegardes et rollback
│   │   ├── rcon-client.js    # Connexion RCON
│   │   ├── log-watcher.js    # Surveillance des logs
│   │   ├── stats-collector.js# Stats CPU/RAM
│   │   ├── mod-manager.js    # Gestion des mods (Modrinth)
│   │   └── remote-*.js       # Gestion des serveurs distants (SSH)
│   ├── templates/            # Jars téléchargés à la demande
│   └── package.json
├── frontend/
│   └── src/
│       ├── components/       # Composants React
│       ├── pages/            # Pages de l'application
│       └── ...
├── electron/
│   ├── main.js               # Process principal Electron
│   └── preload.js            # Bridge de sécurité
└── package.json              # Scripts + config electron-builder
```

## Technologies

- **Backend** — Node.js, Express, Socket.IO, node-ssh
- **Frontend** — React 19, Vite, Tailwind CSS, Recharts
- **Desktop** — Electron
- **Mods** — Modrinth API

## Licence

MIT
