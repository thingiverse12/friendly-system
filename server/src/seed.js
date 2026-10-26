import { getOne } from './db.js';
import { createUser } from './auth.js';
import { seedOfficialContent } from './cases/index.js';

// Demoanvändare för lokal utveckling och provspelning. Byt lösenord i produktion.
export function createDemoUserIfNeeded() {
  if (getOne('SELECT 1 FROM users WHERE username = ?', ['demo'])) return;
  try {
    createUser({ username: 'demo', displayName: 'Anna Karlsson', password: 'demopass123', role: 'user' });
    // eslint-disable-next-line no-console
    console.log('Demokonto skapat: demo / demopass123');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Demoanvändare kunde inte skapas:', err.message);
  }
}

export function seedAll() {
  seedOfficialContent();
  createDemoUserIfNeeded();
}
