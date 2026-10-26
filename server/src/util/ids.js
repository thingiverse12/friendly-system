import crypto from 'node:crypto';
import { config } from '../config.js';

export function id(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomRoomCode() {
  const alphabet = config.room.codeAlphabet;
  const bytes = crypto.randomBytes(config.room.codeLength);
  let out = '';
  for (let i = 0; i < config.room.codeLength; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// Idempotenta klientanrop: samma åtgärd med samma nyckel ska aldrig utföras två gånger.
export function idempotencyKey(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 24);
}
