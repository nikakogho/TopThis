import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import { createServer } from './server.js';
import { LeaderboardResponseSchema } from '@topthis/shared';
import { validateClientHello } from './socket.js';

type Ack = { ok: boolean; view?: any; error?: { code: string; message: string } };
const waitFor = <T>(
  socket: ClientSocket,
  event: string,
  predicate: (value: T) => boolean,
  timeout = 1_500,
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const listener = (value: T) => {
      if (predicate(value)) {
        clearTimeout(timer);
        socket.off(event, listener);
        resolve(value);
      }
    };
    socket.on(event, listener);
  });
const ack = (socket: ClientSocket, event: string, payload: unknown) =>
  new Promise<Ack>((resolve) => socket.emit(event, payload, resolve));

describe('TopThis server', () => {
  const instances: Awaited<ReturnType<typeof createServer>>[] = [];
  const clients: ClientSocket[] = [];
  const paths: string[] = [];
  afterEach(async () => {
    clients.splice(0).forEach((client) => client.close());
    await Promise.all(
      instances.splice(0).map(async ({ io, app }) => {
        await io.close();
        await app.close();
      }),
    );
    paths.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
  });
  async function connect(
    practice: ConstructorParameters<typeof createServer>[0]['practice'] = {},
  ): Promise<ClientSocket> {
    const server = await createServer({ practice });
    instances.push(server);
    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const address = server.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const client = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    clients.push(client);
    await new Promise<void>((resolve) => client.once('connect', resolve));
    return client;
  }

  it('exposes health and validates hello', async () => {
    const server = await createServer();
    instances.push(server);
    expect((await server.app.inject({ method: 'GET', url: '/health' })).json()).toEqual({
      service: 'TopThis Server',
      status: 'ok',
    });
    expect(validateClientHello({ protocolVersion: 1, isAdmin: true })).toMatchObject({ ok: false });
  });
  it('does not require compiled client assets when static serving is enabled', async () => {
    const server = await createServer({
      serveClient: true,
      clientDistPath: join(process.cwd(), 'apps', 'web', 'not-built-for-this-test'),
    });
    instances.push(server);
    expect((await server.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('serves an injected production client without masking API, health, or Socket.IO', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'topthis-vite-dist-'));
    paths.push(dist);
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<main>TopThis production client</main>');
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log("asset");');
    const server = await createServer({
      serveClient: true,
      clientDistPath: dist,
      databasePath: ':memory:',
    });
    instances.push(server);

    const root = await server.app.inject({ method: 'GET', url: '/' });
    expect(root.statusCode).toBe(200);
    expect(root.body).toContain('TopThis production client');
    const index = await server.app.inject({ method: 'GET', url: '/index.html' });
    expect(index.statusCode).toBe(200);
    const asset = await server.app.inject({ method: 'GET', url: '/assets/app-abc123.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain('console.log');
    expect((await server.app.inject({ method: 'GET', url: '/health' })).json()).toMatchObject({
      status: 'ok',
    });
    expect(
      (await server.app.inject({ method: 'GET', url: '/api/leaderboard' })).json(),
    ).toMatchObject({
      total: 0,
    });

    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const address = server.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const client = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    clients.push(client);
    await new Promise<void>((resolve) => client.once('connect', resolve));
    expect(client.connected).toBe(true);
  });

  it.each([1, 2, 3])('creates a private %i-bot practice view', async (botCount) => {
    const client = await connect({ seed: 0, turnDurationMs: 5_000, botDelayMs: 5_000 });
    const created = await ack(client, 'practice:create', { displayName: 'Ari', botCount });
    expect(created.ok).toBe(true);
    const view = created.view!;
    expect(view.players).toHaveLength(botCount + 1);
    expect(view.hand).toHaveLength(10);
    expect(view.challengeCard.description).toBeTypeOf('string');
    expect(view.yourPlayerId).toMatch(/^p/);
    expect(view.turnEndsAt).toBeGreaterThan(Date.now() - 100);
    for (const player of view.players) {
      expect(player).toMatchObject({
        isBot: expect.any(Boolean),
        handCount: expect.any(Number),
        capturedCardCount: expect.any(Number),
      });
      expect(player).not.toHaveProperty('hand');
      expect(player).not.toHaveProperty('legalCardInstanceIds');
      expect(player).not.toHaveProperty('cards');
    }
  });

  it('rejects invalid create and commands without a session', async () => {
    const client = await connect();
    expect(
      await ack(client, 'practice:create', { displayName: 'Ari', botCount: 1, seed: 0 }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
    expect(
      await ack(client, 'practice:skip', {
        commandId: 'c1',
        matchId: 'm1',
        expectedStateVersion: 0,
        expectedTurnId: 'turn-1',
      }),
    ).toMatchObject({ ok: false, error: { code: 'NO_SESSION' } });
  });

  it('accepts a legal human play and rejects illegal, stale, duplicate, and forged commands', async () => {
    const client = await connect({ seed: 0, turnDurationMs: 5_000, botDelayMs: 5_000 });
    const created = await ack(client, 'practice:create', { displayName: 'Ari', botCount: 1 });
    const view = created.view!;
    expect(view.currentPlayerId).toBe(view.yourPlayerId);
    const legal = view.legalCardInstanceIds[0];
    expect(legal).toBeTruthy();
    const illegal = view.hand.find(
      (card: any) => !view.legalCardInstanceIds.includes(card.instanceId),
    );
    expect(illegal).toBeTruthy();
    const invalid = await ack(client, 'practice:play', {
      commandId: 'illegal',
      matchId: view.matchId,
      expectedStateVersion: view.stateVersion,
      expectedTurnId: view.turnId,
      cardInstanceId: illegal.instanceId,
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: 'COMMAND_REJECTED', message: 'illegal_play' },
    });
    const played = await ack(client, 'practice:play', {
      commandId: 'play1',
      matchId: view.matchId,
      expectedStateVersion: view.stateVersion,
      expectedTurnId: view.turnId,
      cardInstanceId: legal,
    });
    expect(played).toMatchObject({ ok: true });
    const stale = await ack(client, 'practice:skip', {
      commandId: 'stale',
      matchId: view.matchId,
      expectedStateVersion: view.stateVersion,
      expectedTurnId: view.turnId,
    });
    expect(stale).toMatchObject({ ok: false, error: { message: 'stale_version' } });
    const duplicate = await ack(client, 'practice:play', {
      commandId: 'play1',
      matchId: view.matchId,
      expectedStateVersion: played.view.stateVersion,
      expectedTurnId: played.view.turnId,
      cardInstanceId: legal,
    });
    expect(duplicate).toMatchObject({ ok: false, error: { message: 'duplicate' } });
    const forged = await ack(client, 'practice:skip', {
      commandId: 'forged',
      matchId: view.matchId,
      expectedStateVersion: played.view.stateVersion,
      expectedTurnId: played.view.turnId,
      playerId: 'p999',
    });
    expect(forged).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
  });

  it('uses the bot command path then advances a low-target completed round', async () => {
    const client = await connect({
      seed: 0,
      targetScore: 2,
      turnDurationMs: 5_000,
      botDelayMs: 5,
      roundResultDelayMs: 10,
      botSkipChance: 1,
    });
    const created = await ack(client, 'practice:create', { displayName: 'Ari', botCount: 1 });
    const view = created.view!;
    expect(view.currentPlayerId).toBe(view.yourPlayerId);
    const next = waitFor<any>(client, 'practice:state', (state) => state.phase === 'round_result');
    const played = await ack(client, 'practice:play', {
      commandId: 'play',
      matchId: view.matchId,
      expectedStateVersion: view.stateVersion,
      expectedTurnId: view.turnId,
      cardInstanceId: view.legalCardInstanceIds[0],
    });
    expect(played.ok).toBe(true);
    const round = await next;
    expect(round.stateVersion).toBeGreaterThan(view.stateVersion);
    expect(round.roundResult.capturedCardCount).toBeGreaterThanOrEqual(2);
    const completed = await waitFor<any>(
      client,
      'practice:state',
      (state) => state.phase === 'completed',
    );
    expect(completed.winnerIds).toContain(completed.yourPlayerId);
  });

  it('submits an engine timeout when the human turn expires', async () => {
    const client = await connect({
      seed: 0,
      turnDurationMs: 15,
      botDelayMs: 1_000,
      roundResultDelayMs: 1_000,
    });
    const created = await ack(client, 'practice:create', { displayName: 'Ari', botCount: 1 });
    expect(created.view.currentPlayerId).toBe(created.view.yourPlayerId);
    const timedOut = await waitFor<any>(
      client,
      'practice:state',
      (state) => state.phase === 'round_result',
      1_000,
    );
    expect(timedOut.stateVersion).toBeGreaterThan(created.view.stateVersion);
    expect(timedOut.roundResult).toBeDefined();
  });

  it('validates leaderboard queries and returns stable paginated ranks', async () => {
    const server = await createServer({ databasePath: ':memory:' });
    instances.push(server);
    const a = server.guests.create('Alpha').guest;
    const b = server.guests.create('Bravo').guest;
    const c = server.guests.create('Charlie').guest;
    server.guests.completeMatch({
      matchId: 'leaderboard-test',
      mode: 'private',
      seed: 1,
      commandLog: [],
      players: [
        { guestId: a.id, score: 3 },
        { guestId: b.id, score: 2 },
        { guestId: c.id, score: 1 },
      ],
    });
    expect(
      (await server.app.inject({ method: 'GET', url: '/api/leaderboard?page=0' })).statusCode,
    ).toBe(400);
    expect(
      (await server.app.inject({ method: 'GET', url: '/api/leaderboard?pageSize=101' })).statusCode,
    ).toBe(400);
    const first = LeaderboardResponseSchema.parse(
      (
        await server.app.inject({ method: 'GET', url: '/api/leaderboard?page=1&pageSize=2' })
      ).json(),
    );
    const second = LeaderboardResponseSchema.parse(
      (
        await server.app.inject({ method: 'GET', url: '/api/leaderboard?page=2&pageSize=2' })
      ).json(),
    );
    expect(first.entries.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(second.entries.map((entry) => entry.rank)).toEqual([3]);
    expect([...first.entries, ...second.entries].map((entry) => entry.guestId)).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
  });
});
