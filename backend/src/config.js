import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  port: parseInt(process.env.PORT, 10) || 3001,
  serversDir: resolve(__dirname, '..', process.env.SERVERS_DIR || './servers'),
  backupsDir: resolve(__dirname, '..', process.env.BACKUPS_DIR || './backups'),
  trashDir: resolve(__dirname, '..', process.env.TRASH_DIR || './trash'),
  statsInterval: 2000,
  logTailLines: 100,
};
