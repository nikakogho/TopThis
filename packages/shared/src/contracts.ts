import { z } from 'zod';

/**
 * Identifiers accepted at public process boundaries. They deliberately exclude
 * whitespace and punctuation so they are safe to use as opaque routing keys.
 */
export const SafeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Expected a safe identifier');

/** A guest may request a profile name; the server remains responsible for identity. */
export const GuestProfileCreationIntentSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .max(24, 'Display name must be 24 characters or fewer')
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u, 'Display name contains unsupported characters'),
    requestId: SafeIdSchema.optional(),
  })
  .strict();

export type GuestProfileCreationIntent = z.infer<typeof GuestProfileCreationIntentSchema>;

/** Payload allowed before a socket has been associated with any server-side identity. */
export const ClientHandshakeSchema = z
  .object({
    protocolVersion: z.literal(1),
    guestProfile: GuestProfileCreationIntentSchema.optional(),
  })
  .strict();

export type ClientHandshake = z.infer<typeof ClientHandshakeSchema>;

/** Recipient-safe server response; it contains no session or game state. */
export const PublicServerHandshakeSchema = z
  .object({
    protocolVersion: z.literal(1),
    server: z.literal('TopThis Server'),
    status: z.literal('ready'),
  })
  .strict();

export type PublicServerHandshake = z.infer<typeof PublicServerHandshakeSchema>;

export const HealthResponseSchema = z
  .object({
    service: z.literal('TopThis Server'),
    status: z.literal('ok'),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const SocketErrorSchema = z
  .object({
    code: z.literal('INVALID_PAYLOAD'),
    message: z.literal('Invalid socket payload'),
  })
  .strict();

export type SocketError = z.infer<typeof SocketErrorSchema>;
