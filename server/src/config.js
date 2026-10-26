// Centraliserad konfiguration. Hämtas från miljövariabler med säkra dev-standardvärden.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'mordgatan.sqlite');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

export const config = {
  port: Number(process.env.PORT || 8787),
  env: process.env.NODE_ENV || 'development',
  sessionTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 dagar
  // AI-leverantör. Om ingen nyckel finns används den inbyggda deterministiska motorn.
  ai: {
    provider: process.env.AI_PROVIDER || 'local', // 'local' | 'openai-compatible'
    baseUrl: process.env.AI_BASE_URL || '',
    model: process.env.AI_MODEL || '',
    apiKey: process.env.AI_API_KEY || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 12000),
  },
  budgets: {
    aiCallsPerUserPerHour: Number(process.env.AI_HOUR_BUDGET || 60),
    aiCallsPerRoomPerHour: Number(process.env.AI_ROOM_HOUR_BUDGET || 200),
  },
  room: {
    codeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    codeLength: 8,
  },
};

export function aiConfigured() {
  return config.ai.provider !== 'local' && Boolean(config.ai.apiKey && config.ai.baseUrl);
}
