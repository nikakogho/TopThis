import {
  ClientHandshakeSchema,
  PublicServerHandshakeSchema,
  SocketErrorSchema,
  type PublicServerHandshake,
  type SocketError,
} from '@topthis/shared';
import type { Socket } from 'socket.io';
import { PracticeService } from './practice.js';

export const SOCKET_EVENTS = {
  clientHello: 'client:hello',
  serverHello: 'server:hello',
  serverError: 'server:error',
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

export function attachSocketBoundary(socket: Socket, practice?: PracticeService): void {
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
}
