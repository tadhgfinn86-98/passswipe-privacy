/**
 * `npm run dev` — starts the Vite dev server and launches Electron pointed at
 * it, so one command gives you the real desktop window with live reload.
 * Closing the window shuts the dev server down too.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';

const server = await createServer({ server: { port: 5173, strictPort: true } });
await server.listen();

const { port } = server.config.server;
const url = `http://localhost:${port}`;
console.log(`\n  Matched Betting Terminal — dev server on ${url}`);
console.log('  Launching the Electron window... (close the window to stop)\n');

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

const shutdown = async (code = 0) => {
  await server.close().catch(() => {});
  process.exit(code);
};

child.on('close', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => {
  child.kill();
  shutdown(0);
});
