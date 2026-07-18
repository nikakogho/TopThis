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
    code: z.enum([
      'INVALID_PAYLOAD',
      'NO_SESSION',
      'COMMAND_REJECTED',
      'AUTH_REQUIRED',
      'ALREADY_ACTIVE',
      'LOBBY_UNAVAILABLE',
      'NOT_HOST',
      'NOT_READY',
      'RECONNECT_EXPIRED',
      'QUEUE_UNAVAILABLE',
    ]),
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

/** Anonymous local identity. Tokens are deliberately only present in this response. */
export const GuestSchema = z.object({ id: SafeIdSchema, displayName: DisplayNameSchema }).strict();
export type Guest = z.infer<typeof GuestSchema>;
export const GuestCreateResponseSchema = z
  .object({ guest: GuestSchema, token: z.string().min(32) })
  .strict();
export type GuestCreateResponse = z.infer<typeof GuestCreateResponseSchema>;
export const GuestMeResponseSchema = z.object({ guest: GuestSchema }).strict();
export type GuestMeResponse = z.infer<typeof GuestMeResponseSchema>;

export const LobbyCodeSchema = z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
export const LobbySettingsSchema = z
  .object({
    playerCount: z.number().int().min(2).max(4),
    targetScore: z.number().int().min(10).max(200),
    turnDurationSeconds: z.number().int().min(5).max(60),
  })
  .strict();
export type LobbySettings = z.infer<typeof LobbySettingsSchema>;
export const LobbyPlayerViewSchema = z
  .object({ guest: GuestSchema, ready: z.boolean(), connected: z.boolean() })
  .strict();
export const LobbyViewSchema = z
  .object({
    code: LobbyCodeSchema,
    hostGuestId: SafeIdSchema,
    settings: LobbySettingsSchema,
    players: z.array(LobbyPlayerViewSchema).min(1).max(4),
    started: z.boolean(),
  })
  .strict();
export type LobbyView = z.infer<typeof LobbyViewSchema>;
export const LobbyCreateIntentSchema = z
  .object({ settings: LobbySettingsSchema.optional() })
  .strict();
export const LobbyJoinIntentSchema = z.object({ code: z.string().min(1).max(16) }).strict();
export const LobbySettingsIntentSchema = z.object({ settings: LobbySettingsSchema }).strict();
export const LobbyReadyIntentSchema = z.object({ ready: z.boolean() }).strict();
export const LobbyLeaveIntentSchema = z.object({}).strict();
export const LobbyAckSchema = z.discriminatedUnion('ok', [
  z
    .object({ ok: z.literal(true), view: LobbyViewSchema, matchId: SafeIdSchema.optional() })
    .strict(),
  z
    .object({ ok: z.literal(false), error: SocketErrorSchema, view: LobbyViewSchema.optional() })
    .strict(),
]);
export type LobbyAck = z.infer<typeof LobbyAckSchema>;
export const LobbyLeaveAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }).strict(),
  z.object({ ok: z.literal(false), error: SocketErrorSchema }).strict(),
]);
export type LobbyLeaveAck = z.infer<typeof LobbyLeaveAckSchema>;

export const PrivateMatchViewSchema = PracticeMatchViewSchema.extend({
  matchMode: z.enum(['private', 'matchmaking']),
  players: z
    .array(
      PracticePlayerViewSchema.extend({
        isBot: z.literal(false),
        connected: z.boolean(),
        abandoned: z.boolean(),
      }),
    )
    .min(2)
    .max(4),
  placements: z.array(SafeIdSchema).optional(),
}).strict();
export type PrivateMatchView = z.infer<typeof PrivateMatchViewSchema>;
export const PrivatePlayIntentSchema = PracticePlayIntentSchema;
export const PrivateSkipIntentSchema = PracticeSkipIntentSchema;
export const PrivateMatchAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), view: PrivateMatchViewSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      view: PrivateMatchViewSchema.optional(),
      error: SocketErrorSchema,
    })
    .strict(),
]);
export type PrivateMatchAck = z.infer<typeof PrivateMatchAckSchema>;

/** Matchmaking deliberately exposes no opponent identity or match secrets. */
export const QueueStatusSchema = z
  .object({
    queued: z.boolean(),
    position: z.number().int().positive().optional(),
    playersNeeded: z.number().int().min(0).max(1),
  })
  .strict();
export type QueueStatus = z.infer<typeof QueueStatusSchema>;
export const QueueIntentSchema = z.object({}).strict();
export const QueueAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), status: QueueStatusSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: SocketErrorSchema,
      status: QueueStatusSchema.optional(),
    })
    .strict(),
]);
export type QueueAck = z.infer<typeof QueueAckSchema>;

export const LeaderboardEntrySchema = z
  .object({
    rank: z.number().int().positive(),
    guestId: SafeIdSchema,
    displayName: DisplayNameSchema,
    rating: z.number().int(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    ties: z.number().int().nonnegative(),
    gamesPlayed: z.number().int().nonnegative(),
  })
  .strict();
export const LeaderboardResponseSchema = z
  .object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    entries: z.array(LeaderboardEntrySchema),
  })
  .strict();
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
export const LeaderboardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
