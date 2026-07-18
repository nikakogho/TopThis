import { z } from 'zod';

export const SafeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Expected a safe identifier');
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(24, 'Display name must be 24 characters or fewer')
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'\-]*$/u, 'Display name contains unsupported characters');

export const GuestProfileCreationIntentSchema = z
  .object({ displayName: DisplayNameSchema, requestId: SafeIdSchema.optional() })
  .strict();
export type GuestProfileCreationIntent = z.infer<typeof GuestProfileCreationIntentSchema>;
export const ClientHandshakeSchema = z
  .object({
    protocolVersion: z.literal(1),
    guestProfile: GuestProfileCreationIntentSchema.optional(),
  })
  .strict();
export type ClientHandshake = z.infer<typeof ClientHandshakeSchema>;
export const PublicServerHandshakeSchema = z
  .object({
    protocolVersion: z.literal(1),
    server: z.literal('TopThis Server'),
    status: z.literal('ready'),
  })
  .strict();
export type PublicServerHandshake = z.infer<typeof PublicServerHandshakeSchema>;
export const HealthResponseSchema = z
  .object({ service: z.literal('TopThis Server'), status: z.literal('ok') })
  .strict();
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const SocketErrorSchema = z
  .object({
    code: z.enum(['INVALID_PAYLOAD', 'NO_SESSION', 'COMMAND_REJECTED']),
    message: z.string().min(1),
  })
  .strict();
export type SocketError = z.infer<typeof SocketErrorSchema>;
export const PracticeCreateIntentSchema = z
  .object({ displayName: DisplayNameSchema, botCount: z.number().int().min(1).max(3) })
  .strict();
export type PracticeCreateIntent = z.infer<typeof PracticeCreateIntentSchema>;
const CommandBaseSchema = z
  .object({
    commandId: SafeIdSchema,
    matchId: SafeIdSchema,
    expectedStateVersion: z.number().int().nonnegative(),
    expectedTurnId: SafeIdSchema,
  })
  .strict();
export const CardInstanceIdSchema = z.string().min(1).max(128);
export const PracticePlayIntentSchema = CommandBaseSchema.extend({
  cardInstanceId: CardInstanceIdSchema,
}).strict();
export const PracticeSkipIntentSchema = CommandBaseSchema;
/** Backwards-compatible union used by consumers that choose event type externally. */
export type PracticePlayIntent = z.infer<typeof PracticePlayIntentSchema>;
export type PracticeSkipIntent = z.infer<typeof PracticeSkipIntentSchema>;

export const PublicCardViewSchema = z
  .object({
    instanceId: CardInstanceIdSchema,
    definitionId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
    iconPath: z.string().min(1),
  })
  .strict();
export const PracticePlayerViewSchema = z
  .object({
    id: SafeIdSchema,
    displayName: DisplayNameSchema,
    isBot: z.boolean(),
    capturedCardCount: z.number().int().nonnegative(),
    handCount: z.number().int().nonnegative(),
  })
  .strict();
export const RoundResultViewSchema = z
  .object({
    winnerId: SafeIdSchema,
    pileCount: z.number().int().nonnegative(),
    capturedCardCount: z.number().int().nonnegative(),
  })
  .strict();
export const PracticeMatchViewSchema = z
  .object({
    matchId: SafeIdSchema,
    yourPlayerId: SafeIdSchema,
    stateVersion: z.number().int().nonnegative(),
    phase: z.enum(['playing', 'round_result', 'completed']),
    players: z.array(PracticePlayerViewSchema).min(2).max(4),
    hand: z.array(PublicCardViewSchema),
    legalCardInstanceIds: z.array(CardInstanceIdSchema),
    challengeCard: PublicCardViewSchema.optional(),
    leaderId: SafeIdSchema,
    currentPlayerId: SafeIdSchema.optional(),
    turnId: SafeIdSchema.optional(),
    turnEndsAt: z.number().int().positive().optional(),
    pileCount: z.number().int().nonnegative(),
    deckCount: z.number().int().nonnegative(),
    roundResult: RoundResultViewSchema.optional(),
    winnerIds: z.array(SafeIdSchema).optional(),
  })
  .strict();
export type PracticeMatchView = z.infer<typeof PracticeMatchViewSchema>;
export const PracticeAckSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      view: PracticeMatchViewSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      view: PracticeMatchViewSchema.optional(),
      error: SocketErrorSchema,
    })
    .strict(),
]);
export type PracticeAck = z.infer<typeof PracticeAckSchema>;
