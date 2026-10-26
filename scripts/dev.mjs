// Startar backend (Express + WS) och Vite samtidigt under utveckling.
import { spawn } from 'node:child_process';

const colors = { server: '\x1b[36m', client: '\x1b[35m', reset: '\x1b[0m' };

function run(name, cmd, args, color) {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `${color}[${name}]${colors.reset} `;
  for (const stream of ['stdout', 'stderr']) {
    proc[stream].on('data', (chunk) => {
      const text = chunk.toString().trimEnd();
      if (text) process.stdout.write(text.split('\n').map((l) => tag + l).join('\n') + '\n');
    });
  }
  proc.on('exit', (code) => {
    process.stdout.write(tag + `avslutad (kod ${code})\n`);
    process.exit(code ?? 0);
  });
  return proc;
}

run('server', process.execPath, ['--watch', '--experimental-sqlite', 'server/src/main.js'], colors.server);
run('client', 'npx', ['vite', '--host', '0.0.0.0'], colors.client);
