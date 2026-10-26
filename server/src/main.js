import http from 'node:http';
import { config } from './config.js';
import { createApp } from './app.js';
import { attachWebSocket } from './realtime/hub.js';

const app = createApp();
const server = http.createServer(app);
attachWebSocket(server); // WebSocket-stöd kräver en långlivad process – används ej i serverless.

server.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Mordgåtan lyssnar på http://0.0.0.0:${config.port} (${config.env})`);
});

export { app, server };
