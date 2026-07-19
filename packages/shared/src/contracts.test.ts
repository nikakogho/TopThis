import { describe, expect, it } from 'vitest';
import {
  ClientHandshakeSchema,
  GuestProfileCreationIntentSchema,
  HealthResponseSchema,
  LeaderboardQuerySchema,
  PracticeAckSchema,
  PracticeCreateIntentSchema,
  PracticeMatchViewSchema,
  PrivateMatchLeaveAckSchema,
  PrivateMatchLeaveIntentSchema,
  SafeIdSchema,
} from './index.js';

const card = {
  instanceId: 'water.common#1',
  definitionId: 'water.common',
  name: 'Water',
  description: 'A card.',
  rarity: 'common' as const,
  iconPath: '/cards/water.common.png',
};
const view = {
  matchId: 'm1',
  yourPlayerId: 'p1',
  stateVersion: 0,
  phase: 'playing' as const,
  players: [
    { id: 'p1', displayName: 'Ari', isBot: false, capturedCardCount: 0, handCount: 10 },
    { id: 'p2', displayName: 'Bot 1', isBot: true, capturedCardCount: 0, handCount: 10 },
  ],
  hand: [card],
  legalCardInstanceIds: ['water.common#1'],
  challengeCard: card,
  leaderId: 'p2',
  currentPlayerId: 'p1',
  turnId: 'turn-1',
  turnEndsAt: 1,
  pileCount: 1,
  deckCount: 179,
};

describe('shared boundary contracts', () => {
  it('accepts valid guest profiles and all practice bot counts', () => {
    expect(
      GuestProfileCreationIntentSchema.parse({ displayName: 'Ari Stone', requestId: 'guest_01' }),
    ).toEqual({ displayName: 'Ari Stone', requestId: 'guest_01' });
    expect(
      [1, 3].map(
        (botCount) => PracticeCreateIntentSchema.parse({ displayName: 'Ari', botCount }).botCount,
      ),
    ).toEqual([1, 3]);
  });

  it('rejects malformed, forged, and private boundary input', () => {
    expect(() => SafeIdSchema.parse('../../private-state')).toThrow();
    expect(() => GuestProfileCreationIntentSchema.parse({ displayName: '   ' })).toThrow();
    expect(() => ClientHandshakeSchema.parse({ protocolVersion: 2 })).toThrow();
    expect(() =>
      HealthResponseSchema.parse({ service: 'TopThis Server', status: 'debug' }),
    ).toThrow();
    for (const value of [
      { displayName: 'Ari', botCount: 0 },
      { displayName: 'Ari', botCount: 6 },
      { displayName: 'Ari', botCount: 1, seed: 0 },
      { displayName: 'Ari', botCount: 1, targetScore: 2 },
      { displayName: 'Ari', botCount: 1, playerId: 'p2' },
    ])
      expect(() => PracticeCreateIntentSchema.parse(value)).toThrow();
    expect(() =>
      PracticeMatchViewSchema.parse({
        ...view,
        players: [{ ...view.players[0], hand: [card] }, view.players[1]],
      }),
    ).toThrow();
  });

  it('enforces strict acknowledgement variants', () => {
    expect(PracticeAckSchema.parse({ ok: true, view })).toEqual({ ok: true, view });
    expect(
      PracticeAckSchema.parse({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'bad' } }),
    ).toMatchObject({ ok: false });
    expect(() => PracticeAckSchema.parse({ ok: true })).toThrow();
    expect(() =>
      PracticeAckSchema.parse({
        ok: true,
        view,
        error: { code: 'INVALID_PAYLOAD', message: 'bad' },
      }),
    ).toThrow();
    expect(() => PracticeAckSchema.parse({ ok: false })).toThrow();
  });

  it('validates the completed-match release boundary strictly', () => {
    expect(PrivateMatchLeaveIntentSchema.parse({})).toEqual({});
    expect(PrivateMatchLeaveAckSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(() => PrivateMatchLeaveIntentSchema.parse({ matchId: 'client-forged' })).toThrow();
    expect(() =>
      PrivateMatchLeaveAckSchema.parse({
        ok: false,
        error: { code: 'MATCH_ACTIVE', message: 'MATCH_ACTIVE' },
        extra: true,
      }),
    ).toThrow();
  });

  it('coerces bounded leaderboard pagination defaults at the HTTP boundary', () => {
    expect(LeaderboardQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(LeaderboardQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(() => LeaderboardQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => LeaderboardQuerySchema.parse({ pageSize: '101' })).toThrow();
  });
});
