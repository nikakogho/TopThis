import {
  ClientHandshakeSchema,
  LobbyAckSchema,
  LobbyLeaveAckSchema,
  QueueAckSchema,
  QueueIntentSchema,
  PrivateMatchAckSchema,
  PrivateMatchLeaveAckSchema,
  PublicServerHandshakeSchema,
  SocketErrorSchema,
  type PublicServerHandshake,
  type SocketError,
} from '@topthis/shared';
import type { Socket } from 'socket.io';
import { PracticeService } from './practice.js';
import { PrivateService } from './private.js';

export const SOCKET_EVENTS = {
  clientHello: 'client:hello',
  serverHello: 'server:hello',
  serverError: 'server:error',
  lobbyCreate: 'lobby:create',
  lobbyJoin: 'lobby:join',
  lobbyReady: 'lobby:ready',
  lobbySettings: 'lobby:settings',
  lobbyStart: 'lobby:start',
  lobbyState: 'lobby:state',
  lobbyLeave: 'lobby:leave',
  matchPlay: 'match:play',
  matchSkip: 'match:skip',
  matchLeave: 'match:leave',
  matchState: 'match:state',
  queueEnter: 'queue:enter',
  queueLeave: 'queue:leave',
  queueStatus: 'queue:status',
} as const;

export type ClientHelloResult =
  { ok: true; response: PublicServerHandshake } | { ok: false; response: SocketError };

export function validateClientHello(payload: unknown): ClientHelloResult {
  const parsed = ClientHandshakeSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: SocketErrorSchema.parse({
        code: 'INVALID_PAYLOAD',
        message: 'Invalid socket payload',
      }),
    };
  }

  // The payload is intentionally validated but not used to assign identity or state.
  return {
    ok: true,
    response: PublicServerHandshakeSchema.parse({
      protocolVersion: 1,
      server: 'TopThis Server',
      status: 'ready',
    }),
  };
}

export function attachSocketBoundary(
  socket: Socket,
  practice?: PracticeService,
  privateService?: PrivateService,
): void {
  socket.on(SOCKET_EVENTS.clientHello, (payload: unknown) => {
    const result = validateClientHello(payload);
    socket.emit(result.ok ? SOCKET_EVENTS.serverHello : SOCKET_EVENTS.serverError, result.response);
  });
  if (practice) {
    socket.on('practice:create', (payload: unknown, ack?: (value: unknown) => void) => {
      try {
        const view = practice.create(socket, payload);
        socket.emit('practice:state', view);
        ack?.({ ok: true, view });
      } catch {
        ack?.({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid socket payload' } });
      }
    });
    for (const type of ['play', 'skip'] as const)
      socket.on(`practice:${type}`, async (payload: unknown, ack?: (value: unknown) => void) => {
        try {
          ack?.(await practice.command(socket.id, payload, type));
        } catch (error) {
          ack?.({
            ok: false,
            error: {
              code:
                error instanceof Error && error.message === 'No practice session'
                  ? 'NO_SESSION'
                  : 'INVALID_PAYLOAD',
              message: 'Invalid socket payload',
            },
          });
        }
      });
    socket.on('disconnect', () => practice.remove(socket.id));
  }
  if (privateService) {
    try {
      privateService.reconnect(socket);
    } catch (error) {
      socket.data.privateReconnectError =
        error instanceof Error ? error.message : 'RECONNECT_EXPIRED';
    }
    const failure = (error: unknown) => {
      const message =
        (socket.data.privateReconnectError as string | undefined) ??
        (error instanceof Error ? error.message : 'INVALID_PAYLOAD');
      const code = [
        'AUTH_REQUIRED',
        'ALREADY_ACTIVE',
        'LOBBY_UNAVAILABLE',
        'NOT_HOST',
        'NOT_READY',
        'RECONNECT_EXPIRED',
        'MATCH_ACTIVE',
      ].includes(message)
        ? message
        : message === 'NO_SESSION'
          ? 'NO_SESSION'
          : 'INVALID_PAYLOAD';
      return SocketErrorSchema.parse({ code, message });
    };
    const lobby = (event: keyof typeof SOCKET_EVENTS, fn: (raw: unknown) => unknown) =>
      socket.on(SOCKET_EVENTS[event], (raw: unknown, ack?: (v: unknown) => void) => {
        try {
          if (socket.data.privateReconnectError)
            throw Error(String(socket.data.privateReconnectError));
          ack?.(LobbyAckSchema.parse({ ok: true, view: fn(raw) }));
        } catch (error) {
          ack?.(LobbyAckSchema.parse({ ok: false, error: failure(error) }));
        }
      });
    lobby('lobbyCreate', (raw) => privateService.create(socket, raw));
    lobby('lobbyJoin', (raw) => privateService.join(socket, raw));
    lobby('lobbyReady', (raw) => privateService.ready(socket, raw));
    lobby('lobbySettings', (raw) => privateService.settings(socket, raw));
    for (const event of ['queueEnter', 'queueLeave'] as const)
      socket.on(SOCKET_EVENTS[event], (_raw: unknown, ack?: (v: unknown) => void) => {
        try {
          QueueIntentSchema.parse(_raw);
          if (socket.data.privateReconnectError)
            throw Error(String(socket.data.privateReconnectError));
          const status =
            event === 'queueEnter'
              ? privateService.queueEnter(socket)
              : privateService.queueLeave(socket);
          ack?.(QueueAckSchema.parse({ ok: true, status }));
        } catch (error) {
          ack?.(QueueAckSchema.parse({ ok: false, error: failure(error) }));
        }
      });
    socket.on(SOCKET_EVENTS.lobbyLeave, (_raw: unknown, ack?: (v: unknown) => void) => {
      try {
        if (socket.data.privateReconnectError)
          throw Error(String(socket.data.privateReconnectError));
        privateService.leave(socket);
        ack?.(LobbyLeaveAckSchema.parse({ ok: true }));
      } catch (error) {
        ack?.(LobbyLeaveAckSchema.parse({ ok: false, error: failure(error) }));
      }
    });
    socket.on(SOCKET_EVENTS.lobbyStart, (_raw: unknown, ack?: (v: unknown) => void) => {
      try {
        if (socket.data.privateReconnectError)
          throw Error(String(socket.data.privateReconnectError));
        const r = privateService.start(socket);
        ack?.(LobbyAckSchema.parse({ ok: true, view: r.view, matchId: r.matchId }));
      } catch (error) {
        ack?.(LobbyAckSchema.parse({ ok: false, error: failure(error) }));
      }
    });
    for (const type of ['play', 'skip'] as const)
      socket.on(`match:${type}`, async (raw: unknown, ack?: (v: unknown) => void) => {
        try {
          if (socket.data.privateReconnectError)
            throw Error(String(socket.data.privateReconnectError));
          ack?.(await privateService.command(socket, raw, type));
        } catch (error) {
          ack?.(PrivateMatchAckSchema.parse({ ok: false, error: failure(error) }));
        }
      });
    socket.on(SOCKET_EVENTS.matchLeave, (raw: unknown, ack?: (v: unknown) => void) => {
      try {
        if (socket.data.privateReconnectError)
          throw Error(String(socket.data.privateReconnectError));
        privateService.leaveCompleted(socket, raw);
        ack?.(PrivateMatchLeaveAckSchema.parse({ ok: true }));
      } catch (error) {
        ack?.(PrivateMatchLeaveAckSchema.parse({ ok: false, error: failure(error) }));
      }
    });
    socket.on('disconnect', () => privateService.disconnect(socket));
  }
}
