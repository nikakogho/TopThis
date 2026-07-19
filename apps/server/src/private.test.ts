import { afterEach, describe, expect, it } from 'vitest';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import {
  GuestCreateResponseSchema,
  type GuestCreateResponse,
  type LobbyAck,
  type LobbyLeaveAck,
  type PrivateMatchAck,
  type PrivateMatchExitAck,
  type PrivateMatchLeaveAck,
  type PrivateMatchView,
  type QueueAck,
} from '@topthis/shared';
import { createServer, type TopThisServer } from './server.js';

type PrivateOptions = NonNullable<Parameters<typeof createServer>[0]>['private'];

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  predicate: (value: T) => boolean,
  timeoutMs = 1_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const listener = (value: T) => {
      if (!predicate(value)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      resolve(value);
    };
    socket.on(event, listener);
  });
}

function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out acknowledging ${event}`)), 1_000);
    socket.emit(event, payload, (value: T) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });
}

async function eventually<T>(read: () => T | undefined, timeoutMs = 1_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await delay(2);
  }
  throw new Error('Timed out waiting for state');
}

describe('private multiplayer integration', () => {
  let server: TopThisServer | undefined;
  let baseUrl = '';
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    if (server) {
      await server.io.close();
      await server.app.close();
      server = undefined;
    }
  });

  async function start(options: PrivateOptions = {}): Promise<void> {
    server = await createServer({
      databasePath: ':memory:',
      private: { seed: 0, ...options },
    });
    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const address = server.app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function createGuest(displayName: string): Promise<GuestCreateResponse> {
    if (!server) throw new Error('Server not started');
    const response = await server.app.inject({
      method: 'POST',
      url: '/api/guests',
      payload: { displayName },
    });
    expect(response.statusCode).toBe(200);
    return GuestCreateResponseSchema.parse(response.json());
  }

  async function connect(
    token?: string,
    initialEvent?: 'lobby:state' | 'match:state',
  ): Promise<{ socket: ClientSocket; initial?: Promise<unknown> }> {
    const socket = clientIo(baseUrl, {
      autoConnect: false,
      transports: ['websocket'],
      auth: token ? { guestToken: token } : {},
      reconnection: false,
    });
    clients.push(socket);
    const initial = initialEvent
      ? waitForEvent<unknown>(socket, initialEvent, () => true)
      : undefined;
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await connected;
    return { socket, initial };
  }

  async function makeLobby(
    count: 2 | 3,
    options: PrivateOptions,
  ): Promise<{
    guests: GuestCreateResponse[];
    sockets: ClientSocket[];
    states: PrivateMatchView[];
  }> {
    await start(options);
    const guests = await Promise.all(
      Array.from({ length: count }, (_, index) => createGuest(`Player ${index + 1}`)),
    );
    const sockets: ClientSocket[] = [];
    for (const guest of guests) sockets.push((await connect(guest.token)).socket);
    const created = await emitAck<LobbyAck>(sockets[0]!, 'lobby:create', {
      settings: { playerCount: count, targetScore: 10, turnDurationSeconds: 5 },
    });
    if (!created.ok) throw new Error(created.error.message);
    for (let index = 1; index < count; index++) {
      const joined = await emitAck<LobbyAck>(sockets[index]!, 'lobby:join', {
        code: created.view.code.toLowerCase(),
      });
      expect(joined.ok).toBe(true);
    }
    for (const socket of sockets) {
      const ready = await emitAck<LobbyAck>(socket, 'lobby:ready', { ready: true });
      expect(ready.ok).toBe(true);
    }
    const statePromises = sockets.map((socket) =>
      waitForEvent<PrivateMatchView>(socket, 'match:state', () => true),
    );
    const started = await emitAck<LobbyAck>(sockets[0]!, 'lobby:start', {});
    expect(started.ok).toBe(true);
    return { guests, sockets, states: await Promise.all(statePromises) };
  }

  it('validates guest HTTP identity and rejects unauthenticated private events', async () => {
    await start();
    if (!server) throw new Error('Server not started');
    expect(
      (
        await server.app.inject({
          method: 'POST',
          url: '/api/guests',
          payload: { displayName: '!!!' },
        })
      ).statusCode,
    ).toBe(400);
    const issued = await createGuest('Ada');
    const me = await server.app.inject({
      method: 'GET',
      url: '/api/guests/me',
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ guest: issued.guest });
    expect(JSON.stringify(me.json())).not.toContain(issued.token);
    expect((await server.app.inject({ method: 'GET', url: '/api/guests/me' })).statusCode).toBe(
      401,
    );

    const anonymous = (await connect()).socket;
    expect(await emitAck<LobbyAck>(anonymous, 'lobby:create', {})).toMatchObject({
      ok: false,
      error: { code: 'AUTH_REQUIRED' },
    });
  });

  it('allows anonymous Practice but rejects explicitly invalid socket tokens', async () => {
    await start();
    const anonymous = (await connect()).socket;
    expect(
      await emitAck<{ ok: boolean }>(anonymous, 'practice:create', {
        displayName: 'Practice Player',
        botCount: 1,
      }),
    ).toMatchObject({ ok: true });

    const undefinedToken = clientIo(baseUrl, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { guestToken: undefined },
      reconnection: false,
    });
    clients.push(undefinedToken);
    const anonymousConnect = new Promise<void>((resolve, reject) => {
      undefinedToken.once('connect', resolve);
      undefinedToken.once('connect_error', reject);
    });
    undefinedToken.connect();
    await anonymousConnect;
    expect(
      await emitAck<{ ok: boolean }>(undefinedToken, 'practice:create', {
        displayName: 'Undefined Token',
        botCount: 1,
      }),
    ).toMatchObject({ ok: true });

    const invalid = clientIo(baseUrl, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { guestToken: 'not-a-valid-topthis-token' },
      reconnection: false,
    });
    clients.push(invalid);
    const rejected = new Promise<Error>((resolve) => invalid.once('connect_error', resolve));
    invalid.connect();
    await expect(rejected).resolves.toMatchObject({ message: 'INVALID_GUEST_TOKEN' });
    expect(invalid.connected).toBe(false);
  });

  it('enforces lobby authorization and closes a lobby when its host disconnects', async () => {
    await start({ disconnectGraceMs: 20 });
    const host = await createGuest('Host');
    const joiner = await createGuest('Joiner');
    const hostSocket = (await connect(host.token)).socket;
    const joinerSocket = (await connect(joiner.token)).socket;
    expect(await emitAck<LobbyAck>(joinerSocket, 'lobby:join', { code: 'ABCDEF' })).toMatchObject({
      ok: false,
      error: { code: 'LOBBY_UNAVAILABLE' },
    });
    const created = await emitAck<LobbyAck>(hostSocket, 'lobby:create', {
      settings: { playerCount: 2, targetScore: 10, turnDurationSeconds: 5 },
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(
      await emitAck<LobbyAck>(joinerSocket, 'lobby:join', { code: created.view.code }),
    ).toMatchObject({ ok: true });
    expect(
      await emitAck<LobbyAck>(joinerSocket, 'lobby:settings', {
        settings: { playerCount: 2, targetScore: 20, turnDurationSeconds: 5 },
      }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect(await emitAck<LobbyAck>(joinerSocket, 'lobby:start', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_HOST' },
    });

    const explicitlyRemoved = waitForEvent<import('@topthis/shared').LobbyView>(
      hostSocket,
      'lobby:state',
      (view) => view.players.length === 1,
    );
    expect(await emitAck<LobbyLeaveAck>(joinerSocket, 'lobby:leave', {})).toEqual({ ok: true });
    expect((await explicitlyRemoved).hostGuestId).toBe(host.guest.id);
    expect(
      await emitAck<LobbyAck>(joinerSocket, 'lobby:join', { code: created.view.code }),
    ).toMatchObject({ ok: true });

    const disconnected = waitForEvent<import('@topthis/shared').LobbyView>(
      hostSocket,
      'lobby:state',
      (view) => view.players.length === 1,
    );
    joinerSocket.close();
    expect((await disconnected).hostGuestId).toBe(host.guest.id);
    const replacement = (await connect(joiner.token)).socket;
    expect(
      await emitAck<LobbyAck>(replacement, 'lobby:join', { code: created.view.code }),
    ).toMatchObject({ ok: true });

    const closed = waitForEvent<{ code: string }>(
      replacement,
      'lobby:closed',
      (view) => view.code === created.view.code,
    );
    hostSocket.close();
    await closed;
    expect(await emitAck<LobbyAck>(replacement, 'lobby:create', {})).toMatchObject({ ok: true });
  });

  it('closes and releases a lobby when its host explicitly leaves', async () => {
    await start();
    const host = await createGuest('Leaving Host');
    const joiner = await createGuest('Released Joiner');
    const hostSocket = (await connect(host.token)).socket;
    const joinerSocket = (await connect(joiner.token)).socket;
    const created = await emitAck<LobbyAck>(hostSocket, 'lobby:create', {});
    if (!created.ok) throw new Error(created.error.message);
    expect(
      await emitAck<LobbyAck>(joinerSocket, 'lobby:join', { code: created.view.code }),
    ).toMatchObject({ ok: true });
    const closed = waitForEvent<{ code: string }>(
      joinerSocket,
      'lobby:closed',
      (view) => view.code === created.view.code,
    );
    expect(await emitAck<LobbyLeaveAck>(hostSocket, 'lobby:leave', {})).toEqual({ ok: true });
    await closed;
    expect(await emitAck<LobbyAck>(joinerSocket, 'lobby:create', {})).toMatchObject({ ok: true });
  });

  it('keeps three private hands isolated, survives socket replacement, and completes', async () => {
    const { guests, sockets, states } = await makeLobby(3, {
      targetScore: 3,
      turnDurationMs: 500,
      roundResultDelayMs: 15,
      disconnectGraceMs: 100,
    });
    const byGuest = new Map(guests.map((guest, index) => [guest.guest.id, sockets[index]!]));
    let latest = states[0]!;
    for (const socket of sockets) {
      socket.on('match:state', (view: PrivateMatchView) => {
        if (view.stateVersion >= latest.stateVersion) latest = view;
      });
    }

    for (const state of states) {
      expect(state.hand).toHaveLength(10);
      expect(state.players).toHaveLength(3);
      const ownIds = new Set(state.hand.map((card) => card.instanceId));
      for (const other of states.filter(
        (candidate) => candidate.yourPlayerId !== state.yourPlayerId,
      )) {
        expect(other.hand.some((card) => ownIds.has(card.instanceId))).toBe(false);
      }
      for (const player of state.players) {
        expect(player).not.toHaveProperty('hand');
        expect(player).not.toHaveProperty('legalCardInstanceIds');
      }
    }

    const current = states.find((state) => state.yourPlayerId === state.currentPlayerId)!;
    const currentSocket = byGuest.get(current.yourPlayerId)!;
    const opponentCard = states.find((state) => state.yourPlayerId !== current.yourPlayerId)!
      .hand[0]!;
    const forgedPayload = {
      commandId: 'forged1',
      matchId: current.matchId,
      expectedStateVersion: current.stateVersion,
      expectedTurnId: current.turnId!,
      cardInstanceId: opponentCard.instanceId,
    };
    expect(
      await emitAck<PrivateMatchAck>(currentSocket, 'match:play', forgedPayload),
    ).toMatchObject({
      ok: false,
      error: { code: 'COMMAND_REJECTED' },
    });
    expect(
      await emitAck<PrivateMatchAck>(currentSocket, 'match:skip', {
        commandId: 'forged-player1',
        matchId: current.matchId,
        expectedStateVersion: current.stateVersion,
        expectedTurnId: current.turnId!,
        playerId: states.find((state) => state.yourPlayerId !== current.yourPlayerId)!.yourPlayerId,
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });

    const firstSkip = {
      commandId: 'accepted1',
      matchId: current.matchId,
      expectedStateVersion: current.stateVersion,
      expectedTurnId: current.turnId!,
    };
    const accepted = await emitAck<PrivateMatchAck>(currentSocket, 'match:skip', firstSkip);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(await emitAck<PrivateMatchAck>(currentSocket, 'match:skip', firstSkip)).toMatchObject({
      ok: false,
      error: { message: 'duplicate' },
    });
    expect(
      await emitAck<PrivateMatchAck>(currentSocket, 'match:skip', {
        ...firstSkip,
        commandId: 'stale1',
      }),
    ).toMatchObject({ ok: false, error: { message: 'stale_version' } });

    const reconnectGuest = guests[2]!;
    const originalHand = states[2]!.hand.map((card) => card.instanceId);
    const replacement = await connect(reconnectGuest.token, 'match:state');
    const reconnected = (await replacement.initial) as PrivateMatchView;
    expect(reconnected.hand.map((card) => card.instanceId)).toEqual(originalHand);
    byGuest.set(reconnectGuest.guest.id, replacement.socket);
    replacement.socket.on('match:state', (view: PrivateMatchView) => {
      if (view.stateVersion >= latest.stateVersion) latest = view;
    });

    let driver = accepted.view;
    for (let index = 0; index < 20 && driver.phase !== 'completed'; index++) {
      if (driver.phase === 'round_result') {
        const version = driver.stateVersion;
        driver = await eventually(() =>
          latest.stateVersion > version && latest.phase !== 'round_result' ? latest : undefined,
        );
        continue;
      }
      const actor = byGuest.get(driver.currentPlayerId!);
      if (!actor) throw new Error('Missing active player socket');
      const result = await emitAck<PrivateMatchAck>(actor, 'match:skip', {
        commandId: `drive${index}`,
        matchId: driver.matchId,
        expectedStateVersion: driver.stateVersion,
        expectedTurnId: driver.turnId!,
      });
      if (!result.ok) throw new Error(result.error.message);
      driver = result.view;
    }
    expect(driver.phase).toBe('completed');
    expect(driver.winnerIds).toHaveLength(1);
    expect(driver.placements).toHaveLength(3);
    expect(driver.placements?.[0]).toBe(driver.winnerIds?.[0]);
  });

  it('releases only completed ownership so a guest can immediately host or queue again', async () => {
    const game = await makeLobby(2, {
      targetScore: 1,
      turnDurationMs: 10,
      roundResultDelayMs: 5,
      disconnectGraceMs: 100,
    });
    const active = game.states.find((state) => state.yourPlayerId === state.currentPlayerId)!;
    const activeSocket = game.sockets.find(
      (socket, index) => game.guests[index]!.guest.id === active.yourPlayerId,
    )!;
    expect(await emitAck<PrivateMatchLeaveAck>(activeSocket, 'match:leave', {})).toMatchObject({
      ok: false,
      error: { code: 'MATCH_ACTIVE' },
    });
    expect(
      await emitAck<PrivateMatchLeaveAck>(activeSocket, 'match:leave', { matchId: active.matchId }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });

    const completed = await waitForEvent<PrivateMatchView>(
      game.sockets[0]!,
      'match:state',
      (view) => view.phase === 'completed',
      1_000,
    );
    expect(await emitAck<PrivateMatchLeaveAck>(game.sockets[0]!, 'match:leave', {})).toEqual({
      ok: true,
    });
    expect(await emitAck<PrivateMatchLeaveAck>(game.sockets[0]!, 'match:leave', {})).toMatchObject({
      ok: false,
      error: { code: 'NO_SESSION' },
    });
    expect(await emitAck<LobbyAck>(game.sockets[0]!, 'lobby:create', {})).toMatchObject({
      ok: true,
    });
    expect(await emitAck<LobbyLeaveAck>(game.sockets[0]!, 'lobby:leave', {})).toEqual({ ok: true });
    expect(await emitAck<QueueAck>(game.sockets[0]!, 'queue:enter', {})).toMatchObject({
      ok: true,
      status: { queued: true, position: 1 },
    });
    expect(await emitAck<QueueAck>(game.sockets[0]!, 'queue:leave', {})).toMatchObject({
      ok: true,
    });

    // Releasing one guest must not break another guest's completed-match reconnect.
    game.sockets[1]!.close();
    const replacement = await connect(game.guests[1]!.token, 'match:state');
    const restored = (await replacement.initial) as PrivateMatchView;
    expect(restored.matchId).toBe(completed.matchId);
    expect(restored.phase).toBe('completed');
    expect(await emitAck<PrivateMatchLeaveAck>(replacement.socket, 'match:leave', {})).toEqual({
      ok: true,
    });
  });

  it('starts a six-seat private match with five opaque server bots', async () => {
    let ratedCompletions = 0;
    await start({
      targetScore: 1,
      turnDurationMs: 5,
      botDelayMs: 1,
      roundResultDelayMs: 1,
      onComplete: () => {
        ratedCompletions += 1;
      },
    });
    const host = await createGuest('Six Seat Host');
    const socket = (await connect(host.token)).socket;
    const created = await emitAck<LobbyAck>(socket, 'lobby:create', {
      settings: { playerCount: 6, botCount: 5, targetScore: 10, turnDurationSeconds: 5 },
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(await emitAck<LobbyAck>(socket, 'lobby:ready', { ready: true })).toMatchObject({
      ok: true,
    });
    const state = waitForEvent<PrivateMatchView>(
      socket,
      'match:state',
      (view) => view.players.length === 6,
    );
    const completion = waitForEvent<PrivateMatchView>(
      socket,
      'match:state',
      (view) => view.phase === 'completed',
      2_000,
    );
    const transition = waitForEvent<PrivateMatchView>(
      socket,
      'match:state',
      (view) => view.stateVersion > 0,
      2_000,
    );
    expect(await emitAck<LobbyAck>(socket, 'lobby:start', {})).toMatchObject({ ok: true });
    const view = await state;
    expect(view.players.filter((player) => player.isBot)).toHaveLength(5);
    expect(view.players.filter((player) => player.isBot).every((player) => player.connected)).toBe(
      true,
    );
    expect(
      view.players.filter((player) => player.isBot).every((player) => !('hand' in player)),
    ).toBe(true);
    const transitioned = await transition;
    expect(transitioned.stateVersion).toBeGreaterThan(view.stateVersion);
    expect((await completion).winnerIds).toHaveLength(1);
    expect(ratedCompletions).toBe(0);
  });

  it('validates active exit and immediately releases the departed guest', async () => {
    const game = await makeLobby(2, {
      targetScore: 10,
      turnDurationMs: 500,
      roundResultDelayMs: 5,
    });
    const exiting = game.sockets[0]!;
    expect(
      await emitAck<PrivateMatchExitAck>(exiting, 'match:exit', { playerId: 'forged' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(await emitAck<PrivateMatchExitAck>(exiting, 'match:exit', {})).toEqual({ ok: true });
    expect(await emitAck<LobbyAck>(exiting, 'lobby:create', {})).toMatchObject({ ok: true });
  });

  it('uses private turn timeouts and advances abandoned seats through normal commands', async () => {
    const normal = await makeLobby(2, {
      targetScore: 3,
      turnDurationMs: 20,
      roundResultDelayMs: 1_000,
      disconnectGraceMs: 200,
    });
    const timedOut = await waitForEvent<PrivateMatchView>(
      normal.sockets[0]!,
      'match:state',
      (view) => view.phase === 'round_result',
      500,
    );
    expect(timedOut.stateVersion).toBeGreaterThan(normal.states[0]!.stateVersion);
  });

  it('removes a disconnected active seat immediately and releases its guest', async () => {
    const game = await makeLobby(2, {
      targetScore: 3,
      turnDurationMs: 500,
      roundResultDelayMs: 5,
      disconnectGraceMs: 15,
    });
    const currentIndex = game.states.findIndex(
      (state) => state.yourPlayerId === state.currentPlayerId,
    );
    const remainingIndex = currentIndex === 0 ? 1 : 0;
    const remaining = game.sockets[remainingIndex]!;
    const completed = waitForEvent<PrivateMatchView>(
      remaining,
      'match:state',
      (view) => view.phase === 'completed',
      1_000,
    );
    game.sockets[currentIndex]!.close();
    const final = await completed;
    const departed = game.guests[currentIndex]!.guest;
    expect(final.players.some((player) => player.id === departed.id)).toBe(false);
    expect(final.winnerIds).toContain(game.guests[remainingIndex]!.guest.id);

    const replacement = (await connect(game.guests[currentIndex]!.token)).socket;
    expect(await emitAck<LobbyAck>(replacement, 'lobby:create', {})).toMatchObject({ ok: true });
  });

  it('matches authenticated guests FIFO, isolates hands, and persists the completed result once', async () => {
    await start({ targetScore: 1, turnDurationMs: 10, roundResultDelayMs: 5 });
    const first = await createGuest('Queue One');
    const second = await createGuest('Queue Two');
    const firstSocket = (await connect(first.token)).socket;
    const secondSocket = (await connect(second.token)).socket;
    const queued = await emitAck<QueueAck>(firstSocket, 'queue:enter', {});
    expect(queued).toEqual({ ok: true, status: { queued: true, position: 1, playersNeeded: 1 } });
    expect(await emitAck<LobbyAck>(firstSocket, 'lobby:create', {})).toMatchObject({
      ok: false,
      error: { code: 'ALREADY_ACTIVE' },
    });
    const firstState = waitForEvent<PrivateMatchView>(
      firstSocket,
      'match:state',
      (view) => view.matchMode === 'matchmaking',
    );
    const secondState = waitForEvent<PrivateMatchView>(
      secondSocket,
      'match:state',
      (view) => view.matchMode === 'matchmaking',
    );
    await emitAck<QueueAck>(secondSocket, 'queue:enter', {});
    const [one, two] = await Promise.all([firstState, secondState]);
    expect(one.matchId).toBe(two.matchId);
    expect(
      one.hand.some((card) => two.hand.some((other) => other.instanceId === card.instanceId)),
    ).toBe(false);
    for (const player of one.players) expect(player).not.toHaveProperty('hand');
    const completed = waitForEvent<PrivateMatchView>(
      firstSocket,
      'match:state',
      (view) => view.phase === 'completed',
      1_000,
    );
    await completed;
    if (!server) throw new Error('Server not started');
    const leaderboard = await server.app.inject({
      method: 'GET',
      url: '/api/leaderboard?page=1&pageSize=20',
    });
    expect(leaderboard.statusCode).toBe(200);
    expect(leaderboard.json()).toMatchObject({ total: 2, entries: [{ rank: 1 }, { rank: 2 }] });
    expect(
      leaderboard.json().entries.every((entry: { gamesPlayed: number }) => entry.gamesPlayed === 1),
    ).toBe(true);
    await delay(30);
    expect(
      (await server.app.inject({ method: 'GET', url: '/api/leaderboard?page=1&pageSize=20' }))
        .json()
        .entries.every((entry: { gamesPlayed: number }) => entry.gamesPlayed === 1),
    ).toBe(true);
  });

  it('allows a queued guest to leave and safely removes a disconnecting queue socket', async () => {
    await start();
    const guest = await createGuest('Queue Leave');
    const socket = (await connect(guest.token)).socket;
    expect(await emitAck<QueueAck>(socket, 'queue:enter', {})).toMatchObject({
      ok: true,
      status: { position: 1 },
    });
    expect(await emitAck<QueueAck>(socket, 'queue:leave', {})).toEqual({
      ok: true,
      status: { queued: false, playersNeeded: 1 },
    });
    await emitAck<QueueAck>(socket, 'queue:enter', {});
    socket.close();
    const replacement = (await connect(guest.token)).socket;
    expect(await emitAck<QueueAck>(replacement, 'queue:enter', {})).toMatchObject({
      ok: true,
      status: { position: 1 },
    });
  });
});
