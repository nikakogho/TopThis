import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './server.js';
import { validateClientHello } from './socket.js';

describe('TopThis server', () => {
  const instances: Awaited<ReturnType<typeof createServer>>[] = [];

  afterEach(async () => {
    await Promise.all(
      instances.splice(0).map(async ({ io, app }) => {
        await io.close();
        await app.close();
      }),
    );
  });

  it('exposes a public health response and attaches Socket.IO', async () => {
    const server = await createServer();
    instances.push(server);

    const response = await server.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: 'TopThis Server', status: 'ok' });
    expect(server.io).toBeDefined();
  });

  it('rejects malformed socket hello payloads without accepting client state', () => {
    expect(validateClientHello({ protocolVersion: 1, isAdmin: true })).toMatchObject({ ok: false });
    expect(
      validateClientHello({ protocolVersion: 1, guestProfile: { displayName: 'Kai' } }),
    ).toEqual({
      ok: true,
      response: { protocolVersion: 1, server: 'TopThis Server', status: 'ready' },
    });
  });

  it('does not require compiled client assets when static serving is enabled', async () => {
    const server = await createServer({
      serveClient: true,
      clientDistPath: join(process.cwd(), 'apps', 'web', 'not-built-for-this-test'),
    });
    instances.push(server);

    expect((await server.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});
