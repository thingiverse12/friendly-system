// Vercel serverless-entrypoint. Hela Express-appen exponeras som en funktion.
// Modultillstånd bevaras mellan anrop i en varm instans, därför singleton via globalThis.
import { createApp } from '../server/src/app.js';

if (!globalThis.__mordgatanApp) {
  globalThis.__mordgatanApp = createApp();
}

export default globalThis.__mordgatanApp;
