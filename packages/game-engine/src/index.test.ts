import { describe, expect, it } from 'vitest';
import authored from '../../../content/cards.authored.json';
import resolved from '../../../content/cards.json';
import {
  type AuthoredCardDefinition,
  type CardDefinition,
  type MatchCommand,
  type MatchState,
  applyCommand,
  canDefinitionBeat,
  createMasterPool,
  createMatch,
  getLegalCardInstanceIds,
  replayMatch,
  resolveAuthoredDefinitions,
  selectMatchDeck,
  validateCardDefinitions,
} from './index';

const cards = resolved as CardDefinition[];
const authoredCards = authored as AuthoredCardDefinition[];
const cardsById = new Map(cards.map((card) => [card.id, card]));

const playerIds = (count: number) => Array.from({ length: count }, (_, index) => `p${index + 1}`);
const input = (count = 2, seed = 0, targetScore = 999) => ({
  matchId: 'match-1',
  playerIds: playerIds(count),
  definitions: cards,
  seed,
  targetScore,
});
const make = (count = 2, seed = 0, targetScore = 999) =>
  createMatch(input(count, seed, targetScore));

function skipCommand(
  state: MatchState,
  commandId: string,
  type: 'skip' | 'timeout' = 'skip',
): MatchCommand {
  return {
    type,
    commandId,
    matchId: state.matchId,
    expectedStateVersion: state.stateVersion,
    expectedTurnId: state.turnId!,
    playerId: state.turnPlayerId!,
  };
}

function playCommand(
  state: MatchState,
  commandId: string,
  cardInstanceId = getLegalCardInstanceIds(state, state.turnPlayerId!)[0]!,
): MatchCommand {
  return {
    type: 'play',
    commandId,
    matchId: state.matchId,
    expectedStateVersion: state.stateVersion,
    expectedTurnId: state.turnId!,
    playerId: state.turnPlayerId!,
    cardInstanceId,
  };
}

function advanceCommand(state: MatchState, commandId: string): MatchCommand {
  return {
    type: 'advanceRound',
    commandId,
    matchId: state.matchId,
    expectedStateVersion: state.stateVersion,
  };
}

function applyAccepted(state: MatchState, command: MatchCommand): MatchState {
  const result = applyCommand(state, command);
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(`Expected accepted command, received ${result.error}`);
  return result.state;
}

const relationshipIds = (id: string) => cardsById.get(id)!.beatsDefinitionIds;
const expectExactRelationships = (id: string, expected: string[]) =>
  expect([...relationshipIds(id)].sort()).toEqual([...expected].sort());

describe('card content and explicit legality', () => {
  it('resolves authored tag relationships to the committed runtime artifact', () => {
    const normalize = (items: CardDefinition[]) =>
      items
        .map((card) => ({ ...card, beatsDefinitionIds: [...card.beatsDefinitionIds].sort() }))
        .sort((left, right) => left.id.localeCompare(right.id));

    expect(normalize(resolveAuthoredDefinitions(authoredCards))).toEqual(normalize(cards));
    expect(() =>
      resolveAuthoredDefinitions([
        { ...authoredCards[0]!, beatsTags: ['not-a-real-tag'] },
        ...authoredCards.slice(1),
      ]),
    ).toThrow(/Unresolved authored tag/);
  });

  it('validates all fields, copy totals, IDs, references and special-card invariants', () => {
    const validated = validateCardDefinitions(cards);
    const pool = createMasterPool(cards);

    expect(validated).toHaveLength(28);
    expect(cards.reduce((total, card) => total + card.masterPoolCopies, 0)).toBe(400);
    expect(pool).toHaveLength(400);
    expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
    expect(new Set(pool.map((card) => card.id)).size).toBe(400);
    expect(cardsById.get('tornado.legendary')!.masterPoolCopies).toBe(4);
    expect(cardsById.get('meteor.legendary')!.masterPoolCopies).toBe(1);
    expect(cards.every((card) => card.iconPath === `/cards/${card.id}.png`)).toBe(true);
    expect(
      cards.every(
        (card) => new Set(card.beatsDefinitionIds).size === card.beatsDefinitionIds.length,
      ),
    ).toBe(true);

    const changed = (id: string, update: Partial<CardDefinition>) =>
      cards.map((card) => (card.id === id ? { ...card, ...update } : card));

    expect(() =>
      validateCardDefinitions(changed('water.common', { masterPoolCopies: 31 })),
    ).toThrow(/400 copies/);
    expect(() =>
      validateCardDefinitions(changed('tornado.legendary', { masterPoolCopies: 3 })),
    ).toThrow(/400 copies|four Tornados/);
    expect(() =>
      validateCardDefinitions(changed('meteor.legendary', { iconPath: '/bad.png' })),
    ).toThrow(/icon path/);
    expect(() => validateCardDefinitions(changed('mouse.common', { description: '' }))).toThrow(
      /required field/,
    );
    expect(() =>
      validateCardDefinitions(changed('mouse.common', { tags: ['animal', 'animal'] })),
    ).toThrow(/tags/);
    expect(() =>
      validateCardDefinitions(
        changed('mouse.common', { beatsDefinitionIds: ['missing.definition'] }),
      ),
    ).toThrow(/Unresolved relationship/);
    expect(() =>
      validateCardDefinitions(
        changed('mouse.common', { beatsDefinitionIds: ['dirt.common', 'dirt.common'] }),
      ),
    ).toThrow(/Duplicate relationships/);
    expect(() =>
      validateCardDefinitions(
        changed('mouse.common', {
          beatsDefinitionIds: [...relationshipIds('mouse.common'), 'meteor.legendary'],
        }),
      ),
    ).toThrow(/cannot beat Meteor/);
  });

  it('contains every approved family and reciprocal answer through explicit IDs', () => {
    const expected = {
      'water.common': ['fire.common', 'paper.common', 'rock.common'],
      'water.rare': ['fire.common', 'fire.rare', 'paper.common', 'rock.common'],
      'water.epic': ['fire.common', 'fire.rare', 'fire.epic', 'paper.common', 'rock.common'],
      'water.legendary': [
        'fire.common',
        'fire.rare',
        'fire.epic',
        'fire.legendary',
        'paper.common',
        'rock.common',
      ],
      'rock.common': [
        'scissors.rare',
        'mouse.common',
        'cat.common',
        'dog.common',
        'gun.rare',
        'rocket.epic',
        'magnet.rare',
        'fire.common',
        'fire.rare',
        'fire.epic',
        'fire.legendary',
      ],
      'paper.common': ['rock.common', 'sun.rare', 'cloud.common', 'dirt.common', 'gun.rare'],
      'scissors.rare': [
        'paper.common',
        'plant.common',
        'sponge.common',
        'mouse.common',
        'cloud.common',
      ],
      'sponge.common': [
        'water.common',
        'water.rare',
        'water.epic',
        'water.legendary',
        'sea.epic',
        'cloud.common',
        'dirt.common',
      ],
      'magnet.rare': ['gun.rare', 'rocket.epic', 'lightning.rare', 'scissors.rare', 'rust.common'],
      'rust.common': ['gun.rare', 'rocket.epic', 'magnet.rare', 'scissors.rare'],
      'dirt.common': ['rust.common', 'sponge.common', 'magnet.rare', 'paper.common'],
      'mouse.common': ['dirt.common', 'water.common', 'paper.common', 'sponge.common'],
      'cat.common': ['mouse.common', 'water.common', 'paper.common', 'sponge.common'],
      'dog.common': ['mouse.common', 'water.common', 'water.rare', 'paper.common', 'sponge.common'],
      'cloud.common': [
        'sun.rare',
        'fire.common',
        'fire.rare',
        'fire.epic',
        'fire.legendary',
        'rocket.epic',
      ],
      'sun.rare': ['cloud.common', 'ice.common', 'sponge.common'],
      'rocket.epic': [
        'cloud.common',
        'gun.rare',
        'rock.common',
        'paper.common',
        'plant.common',
        'sponge.common',
        'ice.common',
      ],
      'sea.epic': [
        'fire.common',
        'fire.rare',
        'fire.epic',
        'fire.legendary',
        'rock.common',
        'dirt.common',
        'plant.common',
        'magnet.rare',
        'gun.rare',
      ],
      'ice.common': [
        'fire.common',
        'fire.rare',
        'water.common',
        'water.rare',
        'water.epic',
        'water.legendary',
        'sea.epic',
        'plant.common',
        'sponge.common',
      ],
      'lightning.rare': [
        'cloud.common',
        'sea.epic',
        'water.common',
        'magnet.rare',
        'gun.rare',
        'rocket.epic',
        'plant.common',
        'scissors.rare',
        'sponge.common',
      ],
      'plant.common': [
        'dirt.common',
        'water.common',
        'rock.common',
        'paper.common',
        'sponge.common',
        'magnet.rare',
      ],
    } as const;
    for (const [id, relationships] of Object.entries(expected))
      expectExactRelationships(id, [...relationships]);

    const animals = cards.filter((card) => card.tags.includes('animal')).map((card) => card.id);
    const living = cards
      .filter((card) => card.tags.includes('living-creature'))
      .map((card) => card.id);
    expectExactRelationships('gun.rare', living);
    const waterByTier = [
      ['water.common'],
      ['water.common', 'water.rare'],
      ['water.common', 'water.rare', 'water.epic'],
      ['water.common', 'water.rare', 'water.epic', 'water.legendary'],
    ];
    for (const [index, id] of ['fire.common', 'fire.rare', 'fire.epic', 'fire.legendary'].entries())
      expectExactRelationships(id, [
        ...waterByTier[index]!,
        ...animals,
        'paper.common',
        'plant.common',
        'sponge.common',
        'ice.common',
      ]);
  });

  it('implements Tornado and Meteor entirely through explicit IDs', () => {
    const everyNonMeteor = cards
      .filter((card) => card.id !== 'meteor.legendary')
      .map((card) => card.id);
    expectExactRelationships('tornado.legendary', everyNonMeteor);
    expectExactRelationships('meteor.legendary', everyNonMeteor);
    expect(relationshipIds('tornado.legendary')).toContain('tornado.legendary');
    expect(relationshipIds('tornado.legendary')).not.toContain('meteor.legendary');
    expect(cards.every((card) => !relationshipIds(card.id).includes('meteor.legendary'))).toBe(
      true,
    );
  });

  it('proves rarity alone creates no move and supports lower-tier and neither-direction cases', () => {
    expect(canDefinitionBeat(cardsById.get('sun.rare')!, cardsById.get('dirt.common')!)).toBe(
      false,
    );
    expect(canDefinitionBeat(cardsById.get('ice.common')!, cardsById.get('fire.rare')!)).toBe(true);
    expect(canDefinitionBeat(cardsById.get('sun.rare')!, cardsById.get('sea.epic')!)).toBe(false);
    expect(canDefinitionBeat(cardsById.get('sea.epic')!, cardsById.get('sun.rare')!)).toBe(false);
    for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
      expect(
        canDefinitionBeat(cardsById.get(`water.${rarity}`)!, cardsById.get(`fire.${rarity}`)!),
      ).toBe(true);
      expect(
        canDefinitionBeat(cardsById.get(`fire.${rarity}`)!, cardsById.get(`water.${rarity}`)!),
      ).toBe(true);
    }
  });
});

describe('deterministic pool selection and setup', () => {
  it('constructs canonical instance IDs and selects 200 without replacement', () => {
    const pool = createMasterPool(cards);
    const selection = selectMatchDeck(cards, 7);

    expect(pool[0]!.id).toBe(`${[...cardsById.keys()].sort()[0]}#1`);
    expect(selection.selected).toHaveLength(200);
    expect(selection.remainder).toHaveLength(200);
    expect(
      new Set([...selection.selected, ...selection.remainder].map((card) => card.id)).size,
    ).toBe(400);
    expect(selection.selected).toEqual(selectMatchDeck(cards, 7).selected);
    expect(selection.selected).not.toEqual(selectMatchDeck(cards, 8).selected);
  });

  it('uses reproducible seeds where Meteor is present and absent', () => {
    expect(
      selectMatchDeck(cards, 1).selected.some((card) => card.definitionId === 'meteor.legendary'),
    ).toBe(true);
    expect(
      selectMatchDeck(cards, 0).selected.some((card) => card.definitionId === 'meteor.legendary'),
    ).toBe(false);
  });

  it.each([2, 3, 4])(
    'selects a leader, deals clockwise from that leader and reveals a challenge for %s players',
    (count) => {
      const players = playerIds(count);
      const selection = selectMatchDeck(cards, 21);
      const expectedLeader = players[selection.random.int(count)]!;
      const leaderIndex = players.indexOf(expectedLeader);
      const order = Array.from(
        { length: count },
        (_, offset) => players[(leaderIndex + offset) % count]!,
      );
      const state = createMatch({ ...input(count, 21), playerIds: players });

      expect(state.leaderId).toBe(expectedLeader);
      expect(state.players.every((entry) => entry.hand.length === 10)).toBe(true);
      order.forEach((id, offset) => {
        expect(state.players.find((entry) => entry.id === id)!.hand[0]).toEqual(
          selection.selected[offset],
        );
        expect(state.players.find((entry) => entry.id === id)!.hand[9]).toEqual(
          selection.selected[9 * count + offset],
        );
      });
      expect(state.challenge!.card).toEqual(selection.selected[10 * count]);
      expect(state.pile).toEqual([state.challenge!.card]);
      expect(state.challenge!.ownerId).toBe(expectedLeader);
      expect(state.turnPlayerId).toBe(players[(leaderIndex + 1) % count]);
    },
  );

  it('validates player count, player IDs, seed and target score', () => {
    expect(() => createMatch({ ...input(), playerIds: ['p1'] })).toThrow();
    expect(() => createMatch({ ...input(), playerIds: ['p1', 'p1'] })).toThrow();
    expect(() => createMatch({ ...input(), seed: Number.NaN })).toThrow();
    expect(() => createMatch({ ...input(), targetScore: 0 })).toThrow();
  });
});

describe('round and match transitions', () => {
  it.each([2, 3, 4])(
    'awards the initial pile after every other player skips (%s players)',
    (count) => {
      let state = make(count, 21);
      const winnerId = state.leaderId;
      for (let pass = 0; pass < count - 1; pass += 1) {
        state = applyAccepted(state, skipCommand(state, `skip-${pass}`));
        if (pass < count - 2) expect(state.phase).toBe('playing');
      }

      expect(state.phase).toBe('round_result');
      expect(state.roundResult).toEqual({ winnerId, pileCount: 1, capturedCardCount: 1 });
      expect(state.players.find((entry) => entry.id === winnerId)!.capturedCardCount).toBe(1);
      expect(state.pile).toEqual([]);
    },
  );

  it('lets the latest legal player win after all other players pass', () => {
    let state = make(3, 0);
    const actorId = state.turnPlayerId!;
    const selectedCard = getLegalCardInstanceIds(state, actorId)[0]!;
    expect(selectedCard).toBeDefined();

    state = applyAccepted(state, playCommand(state, 'play', selectedCard));
    expect(state.leaderId).toBe(actorId);
    expect(state.pile).toHaveLength(2);
    state = applyAccepted(state, skipCommand(state, 'skip-1'));
    state = applyAccepted(state, skipCommand(state, 'skip-2'));

    expect(state.phase).toBe('round_result');
    expect(state.roundResult).toEqual({ winnerId: actorId, pileCount: 2, capturedCardCount: 2 });
  });

  it('keeps an empty-handed configured player in clockwise skip order', () => {
    const state = structuredClone(make(3, 21));
    const emptyPlayerId = state.turnPlayerId!;
    state.players.find((entry) => entry.id === emptyPlayerId)!.hand = [];
    const result = applyCommand(state, skipCommand(state, 'empty-skip'));

    expect(result.accepted).toBe(true);
    if (result.accepted) expect(result.state.passedPlayerIds).toContain(emptyPlayerId);
  });

  it('refills one card clockwise from the winner and reveals the following challenge', () => {
    let state = make(2, 0);
    const winnerId = state.turnPlayerId!;
    state = applyAccepted(state, playCommand(state, 'play'));
    state = applyAccepted(state, skipCommand(state, 'skip'));
    const deckBeforeAdvance = [...state.deck];

    expect(state.players.find((entry) => entry.id === winnerId)!.hand).toHaveLength(9);
    state = applyAccepted(state, advanceCommand(state, 'advance'));

    expect(state.phase).toBe('playing');
    expect(state.players.find((entry) => entry.id === winnerId)!.hand).toContainEqual(
      deckBeforeAdvance[0],
    );
    expect(state.challenge!.card).toEqual(deckBeforeAdvance[1]);
    expect(state.pile).toEqual([deckBeforeAdvance[1]]);
    expect(state.challenge!.ownerId).toBe(winnerId);
    expect(state.turnPlayerId).not.toBe(winnerId);
  });

  it('ends at target before refilling and rejects commands after completion', () => {
    let state = make(2, 0, 2);
    state = applyAccepted(state, playCommand(state, 'play'));
    state = applyAccepted(state, skipCommand(state, 'skip'));
    const deckBeforeAdvance = [...state.deck];
    state = applyAccepted(state, advanceCommand(state, 'advance'));

    expect(state.phase).toBe('completed');
    expect(state.deck).toEqual(deckBeforeAdvance);
    expect(state.winnerIds).toEqual([state.roundResult!.winnerId]);
    expect(applyCommand(state, advanceCommand(state, 'late'))).toMatchObject({
      accepted: false,
      error: 'completed',
    });
  });

  it('distributes limited refill cards clockwise and ends when no challenge remains', () => {
    let state = make(2, 0);
    state = applyAccepted(state, playCommand(state, 'play'));
    state = applyAccepted(state, skipCommand(state, 'skip'));
    const winnerId = state.roundWinnerId!;
    const other = state.players.find((entry) => entry.id !== winnerId)!;
    other.hand.pop();
    const onlyCard = state.deck[0]!;
    state.deck = [onlyCard];

    state = applyAccepted(state, advanceCommand(state, 'limited'));
    expect(state.phase).toBe('completed');
    expect(state.players.find((entry) => entry.id === winnerId)!.hand).toContainEqual(onlyCard);
    expect(other.id).toBeDefined();
    expect(state.players.find((entry) => entry.id === other.id)!.hand).toHaveLength(9);
  });

  it('returns every highest-scoring player when deck exhaustion produces a tie', () => {
    let state = make(2, 21);
    state = applyAccepted(state, skipCommand(state, 'finish-round'));
    state.players.forEach((entry) => {
      entry.capturedCardCount = 5;
    });
    state.deck = [];
    state = applyAccepted(state, advanceCommand(state, 'finish-match'));

    expect(state.phase).toBe('completed');
    expect(state.winnerIds).toEqual(['p1', 'p2']);
  });
});

describe('command authority, races and replay', () => {
  it.each([2, 3, 4, 5, 6])('creates deterministic %s-player matches', (count) => {
    const state = make(count, 17);
    expect(state.players).toHaveLength(count);
    expect(state.deck).toHaveLength(200 - count * 10 - 1);
  });

  it('removes a current leader deterministically and replays the departure', () => {
    const creation = input(3, 0, 999);
    let state = createMatch(creation);
    const removed = state.leaderId;
    const result = applyCommand(state, {
      type: 'removePlayer',
      commandId: 'remove-leader',
      matchId: state.matchId,
      expectedStateVersion: state.stateVersion,
      playerId: removed,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    state = result.state;
    expect(state.players.some((entry) => entry.id === removed)).toBe(false);
    expect(state.challenge?.ownerId).toBe(state.leaderId);
    expect(JSON.stringify(replayMatch(creation, state.commandLog))).toBe(JSON.stringify(state));
  });

  it('completes with the sole survivor after a deterministic removal', () => {
    const state = make(2, 0);
    const removed = state.players.find((entry) => entry.id !== state.leaderId)!;
    const result = applyCommand(state, {
      type: 'removePlayer',
      commandId: 'remove-last-opponent',
      matchId: state.matchId,
      expectedStateVersion: state.stateVersion,
      playerId: removed.id,
    });
    expect(result).toMatchObject({
      accepted: true,
      state: { phase: 'completed', winnerIds: [state.leaderId] },
    });
  });

  it('transfers a round-result award when its winner departs', () => {
    let state = make(3, 0);
    state = applyAccepted(state, skipCommand(state, 'pass-one'));
    state = applyAccepted(state, skipCommand(state, 'pass-two'));
    expect(state.phase).toBe('round_result');
    const winner = state.roundWinnerId!;
    const award = state.roundResult!.pileCount;
    const result = applyCommand(state, {
      type: 'removePlayer',
      commandId: 'remove-round-winner',
      matchId: state.matchId,
      expectedStateVersion: state.stateVersion,
      playerId: winner,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.roundResult?.winnerId).not.toBe(winner);
    expect(result.state.roundResult?.pileCount).toBe(award);
    expect(
      result.state.players.find((entry) => entry.id === result.state.roundWinnerId)
        ?.capturedCardCount,
    ).toBe(award);
  });

  it('does not overwrite the pile award when a current player departure ends a round', () => {
    let state = make(3, 0);
    state = applyAccepted(state, skipCommand(state, 'prior-pass'));
    const result = applyCommand(state, {
      type: 'removePlayer',
      commandId: 'remove-current',
      matchId: state.matchId,
      expectedStateVersion: state.stateVersion,
      playerId: state.turnPlayerId!,
    });
    expect(result).toMatchObject({
      accepted: true,
      state: { phase: 'round_result', roundResult: { pileCount: 1 } },
    });
  });

  it('resets prior passes when the current pile leader departs', () => {
    let state = make(3, 0);
    state = applyAccepted(state, skipCommand(state, 'prior-pass'));
    const result = applyCommand(state, {
      type: 'removePlayer',
      commandId: 'remove-leader-after-pass',
      matchId: state.matchId,
      expectedStateVersion: state.stateVersion,
      playerId: state.leaderId,
    });
    expect(result).toMatchObject({
      accepted: true,
      state: { phase: 'playing', passedPlayerIds: [] },
    });
  });
  it('rejects illegal cards and cards outside the acting hand without mutation', () => {
    const state = make(2, 0);
    const before = structuredClone(state);
    const actor = state.players.find((entry) => entry.id === state.turnPlayerId)!;
    const legalIds = new Set(getLegalCardInstanceIds(state, actor.id));
    const illegalCard = actor.hand.find((card) => !legalIds.has(card.id))!;

    expect(applyCommand(state, playCommand(state, 'illegal', illegalCard.id))).toMatchObject({
      accepted: false,
      error: 'illegal_play',
    });
    expect(applyCommand(state, playCommand(state, 'missing', 'not-in-hand'))).toMatchObject({
      accepted: false,
      error: 'not_in_hand',
    });
    expect(state).toEqual(before);
  });

  it('rejects malformed, wrong-match, stale, old-turn, wrong-player and wrong-phase commands', () => {
    const state = make(3, 1);
    const baseSkip = skipCommand(state, 'base');
    const wrongPlayer = state.players.find((entry) => entry.id !== state.turnPlayerId)!.id;

    expect(
      applyCommand(state, {
        type: 'dance',
        commandId: 'bad',
        matchId: state.matchId,
        expectedStateVersion: 0,
      } as unknown as MatchCommand),
    ).toMatchObject({ error: 'malformed' });
    expect(applyCommand(state, { ...baseSkip, matchId: 'other-match' })).toMatchObject({
      error: 'wrong_match',
    });
    expect(applyCommand(state, { ...baseSkip, expectedStateVersion: 2 })).toMatchObject({
      error: 'stale_version',
    });
    expect(applyCommand(state, { ...baseSkip, expectedTurnId: 'old-turn' })).toMatchObject({
      error: 'old_turn',
    });
    expect(applyCommand(state, { ...baseSkip, playerId: wrongPlayer })).toMatchObject({
      error: 'wrong_player',
    });
    expect(applyCommand(state, advanceCommand(state, 'too-soon'))).toMatchObject({
      error: 'wrong_phase',
    });
  });

  it('accepts a command once and rejects its duplicate without another transition', () => {
    const state = make(2, 21);
    const command = skipCommand(state, 'same-command');
    const first = applyCommand(state, command);
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;

    const duplicate = applyCommand(first.state, command);
    expect(duplicate).toMatchObject({ accepted: false, error: 'duplicate' });
    expect(duplicate.state).toBe(first.state);
    expect(first.state.commandLog).toHaveLength(1);
  });

  it('serializes timeout/player-action races safely in either order', () => {
    const initial = make(2, 0);
    const action = playCommand(initial, 'player-action');
    const timeout = skipCommand(initial, 'timeout', 'timeout');

    const actionFirst = applyCommand(initial, action);
    expect(actionFirst.accepted).toBe(true);
    if (actionFirst.accepted)
      expect(applyCommand(actionFirst.state, timeout)).toMatchObject({
        accepted: false,
        error: 'stale_version',
      });

    const timeoutFirst = applyCommand(initial, timeout);
    expect(timeoutFirst.accepted).toBe(true);
    if (timeoutFirst.accepted)
      expect(applyCommand(timeoutFirst.state, action)).toMatchObject({
        accepted: false,
        error: 'stale_version',
      });
  });

  it('reconstructs identical state from seed and accepted command log', () => {
    const creation = input(2, 0, 999);
    let state = createMatch(creation);
    state = applyAccepted(state, playCommand(state, 'play'));
    state = applyAccepted(state, skipCommand(state, 'skip'));
    state = applyAccepted(state, advanceCommand(state, 'advance'));

    expect(state.commandLog).toHaveLength(3);
    expect(JSON.stringify(replayMatch(creation, state.commandLog))).toBe(JSON.stringify(state));
  });
});
