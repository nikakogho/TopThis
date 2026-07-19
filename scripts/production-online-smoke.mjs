import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const requireFromServer = createRequire(new URL('../apps/server/package.json', import.meta.url));
const { io } = requireFromServer('socket.io-client');

async function freePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local port');
  const { port } = address;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function eventually(read, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`${label} did not become ready: ${String(lastError)}`);
}

async function socketPractice(baseUrl) {
  const socket = io(baseUrl, { transports: ['websocket'], reconnection: false });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Practice socket connection timed out')),
        5_000,
      );
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const ack = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Practice acknowledgement timed out')),
        5_000,
      );
      socket.emit('practice:create', { displayName: 'Production Smoke', botCount: 1 }, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
    if (!ack?.ok || !ack.view?.matchId || !Array.isArray(ack.view.hand))
      throw new Error('Practice session did not return a recipient-safe state');
  } finally {
    socket.close();
  }
}

const temp = await mkdtemp(join(tmpdir(), 'topthis-production-smoke-'));
let child;
let childExit;
try {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['apps/server/dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      TOPTHIS_DATABASE_PATH: join(temp, 'topthis.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  childExit = once(child, 'exit');
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  child.once('exit', (code) => {
    if (code !== 0) output += `\nProduction process exited early with ${code}`;
  });

  const health = await eventually(async () => {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) throw new Error(`health ${response.status}`);
    const body = await response.json();
    if (body.status !== 'ok') throw new Error('unexpected health body');
    return body;
  }, 'production health');
  if (health.service !== 'TopThis Server') throw new Error('Wrong production health service');

  const root = await fetch(`${baseUrl}/`);
  if (!root.ok || !(await root.text()).includes('<div id="root">'))
    throw new Error('Built client was not served');
  const asset = await fetch(`${baseUrl}/cards/fire.epic.png`);
  if (!asset.ok || !asset.headers.get('content-type')?.startsWith('image/png'))
    throw new Error('Built card asset was not served');
  const guest = await fetch(`${baseUrl}/api/guests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Production Guest' }),
  });
  if (!guest.ok || !(await guest.json()).token) throw new Error('Guest creation failed');
  await socketPractice(baseUrl);
  process.stdout.write('Production listener smoke passed.\n');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    const exited = await Promise.race([
      childExit.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!exited && child.exitCode === null) {
      child.kill('SIGKILL');
      await childExit;
    }
  }
  await rm(temp, { recursive: true, force: true });
}
