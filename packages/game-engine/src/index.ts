/** Pure, deterministic rules and content utilities. This package has no I/O. */
export const gameEnginePackage = '@topthis/game-engine';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface CardDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  masterPoolCopies: number;
  tags: string[];
  iconPath: string;
  description: string;
  beatsDefinitionIds: string[];
  specialRule?: string;
}
export interface AuthoredCardDefinition extends Omit<CardDefinition, 'beatsDefinitionIds'> {
  beatsDefinitionIds?: string[];
  beatsTags?: string[];
}
export interface CardInstance {
  id: string;
  definitionId: string;
}

export class EngineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineValidationError';
  }
}

const ID = /^[a-z][a-z0-9.-]*$/;
const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const unique = (values: readonly string[]) => new Set(values).size === values.length;

/** Resolves authoring tag relationships into runtime-only explicit definition IDs. */
export function resolveAuthoredDefinitions(
  authored: readonly AuthoredCardDefinition[],
): CardDefinition[] {
  const byTag = new Map<string, string[]>();
  for (const definition of authored) {
    for (const tag of definition.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), definition.id]);
  }
  for (const definition of authored) {
    for (const tag of definition.beatsTags ?? []) {
      if (!byTag.has(tag))
        throw new EngineValidationError(`Unresolved authored tag on ${definition.id}: ${tag}`);
    }
  }
  const resolved = authored.map(({ beatsTags = [], beatsDefinitionIds = [], ...definition }) => ({
    ...definition,
    beatsDefinitionIds: [
      ...new Set([...beatsDefinitionIds, ...beatsTags.flatMap((tag) => byTag.get(tag) ?? [])]),
    ].sort(),
  }));
  validateCardDefinitions(resolved);
  return resolved.sort((a, b) => a.id.localeCompare(b.id));
}

/** Validates the complete production card set and returns canonical ID order. */
export function validateCardDefinitions(definitions: readonly CardDefinition[]): CardDefinition[] {
  if (!definitions.length)
    throw new EngineValidationError('At least one card definition is required');
  const ids = definitions.map((definition) => definition.id);
  if (!unique(ids)) throw new EngineValidationError('Definition IDs must be unique');
  for (const definition of definitions) {
    if (!ID.test(definition.id))
      throw new EngineValidationError(`Invalid definition ID: ${definition.id}`);
    if (!definition.name.trim() || !definition.description.trim())
      throw new EngineValidationError(`Missing required field on ${definition.id}`);
    if (!RARITIES.includes(definition.rarity))
      throw new EngineValidationError(`Invalid rarity on ${definition.id}`);
    if (!Number.isInteger(definition.masterPoolCopies) || definition.masterPoolCopies <= 0)
      throw new EngineValidationError(`Copies must be positive on ${definition.id}`);
    if (!Array.isArray(definition.beatsDefinitionIds) || !unique(definition.beatsDefinitionIds))
      throw new EngineValidationError(`Duplicate relationships on ${definition.id}`);
    if (!definition.beatsDefinitionIds.every((id) => ids.includes(id)))
      throw new EngineValidationError(`Unresolved relationship on ${definition.id}`);
    if (
      !Array.isArray(definition.tags) ||
      !unique(definition.tags) ||
      definition.tags.some((tag) => !tag.trim())
    )
      throw new EngineValidationError(`Invalid tags on ${definition.id}`);
    if (definition.iconPath !== `/cards/${definition.id}.png`)
      throw new EngineValidationError(`Invalid icon path on ${definition.id}`);
  }
  const copies = definitions.reduce((total, definition) => total + definition.masterPoolCopies, 0);
  if (copies !== 400)
    throw new EngineValidationError(`Master pool must contain 400 copies, received ${copies}`);
  const tornado = definitions.find((definition) => definition.id === 'tornado.legendary');
  const meteor = definitions.find((definition) => definition.id === 'meteor.legendary');
  if (!tornado || tornado.masterPoolCopies !== 4)
    throw new EngineValidationError('Exactly four Tornados are required');
  if (!meteor || meteor.masterPoolCopies !== 1)
    throw new EngineValidationError('Exactly one Meteor is required');
  if (tornado.beatsDefinitionIds.includes(meteor.id))
    throw new EngineValidationError('Tornado cannot beat Meteor');
  if (
    definitions
      .filter((definition) => definition.id !== meteor.id && definition.id !== tornado.id)
      .some((definition) => definition.beatsDefinitionIds.includes(meteor.id))
  )
    throw new EngineValidationError('Ordinary cards cannot beat Meteor');
  if (
    definitions.some(
      (definition) =>
        definition.id !== meteor.id && !meteor.beatsDefinitionIds.includes(definition.id),
    )
  )
    throw new EngineValidationError('Meteor must beat every non-Meteor');
  if (
    definitions.some(
      (definition) =>
        definition.id !== meteor.id && !tornado.beatsDefinitionIds.includes(definition.id),
    )
  )
    throw new EngineValidationError('Tornado must beat every non-Meteor');
  return [...definitions].sort((a, b) => a.id.localeCompare(b.id));
}

export function createMasterPool(definitions: readonly CardDefinition[]): CardInstance[] {
  return validateCardDefinitions(definitions).flatMap((definition) =>
    Array.from({ length: definition.masterPoolCopies }, (_, index) => ({
      id: `${definition.id}#${index + 1}`,
      definitionId: definition.id,
    })),
  );
}

export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}
export function shuffle<T>(items: readonly T[], random: SeededRandom): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = random.int(index + 1);
    [out[index], out[pick]] = [out[pick]!, out[index]!];
  }
  return out;
}
export function selectMatchDeck(
  definitions: readonly CardDefinition[],
  seed: number,
): { selected: CardInstance[]; remainder: CardInstance[]; random: SeededRandom } {
  const random = new SeededRandom(seed);
  const shuffled = shuffle(createMasterPool(definitions), random);
  return { selected: shuffled.slice(0, 200), remainder: shuffled.slice(200), random };
}

export function canDefinitionBeat(played: CardDefinition, current: CardDefinition): boolean {
  return played.beatsDefinitionIds.includes(current.id);
}

export type MatchPhase = 'playing' | 'round_result' | 'completed';
export interface PlayerState {
  id: string;
  hand: CardInstance[];
  capturedCardCount: number;
}
export interface Challenge {
  card: CardInstance;
  ownerId: string;
}
export interface MatchState {
  matchId: string;
  definitions: CardDefinition[];
  players: PlayerState[];
  deck: CardInstance[];
  pile: CardInstance[];
  phase: MatchPhase;
  leaderId: string;
  turnPlayerId?: string;
  turnId?: string;
  challenge?: Challenge;
  passedPlayerIds: string[];
  roundWinnerId?: string;
  roundResult?: RoundResult;
  winnerIds?: string[];
  targetScore: number;
  stateVersion: number;
  commandLog: MatchCommand[];
  seed: number;
  turnSequence: number;
}
export interface RoundResult {
  winnerId: string;
  pileCount: number;
  capturedCardCount: number;
}
export interface CreateMatchInput {
  matchId: string;
  playerIds: string[];
  definitions: CardDefinition[];
  seed: number;
  targetScore?: number;
}
export type BaseCommand = { commandId: string; matchId: string; expectedStateVersion: number };
export type MatchCommand =
  | (BaseCommand & {
      type: 'play';
      playerId: string;
      cardInstanceId: string;
      expectedTurnId: string;
    })
  | (BaseCommand & { type: 'skip' | 'timeout'; playerId: string; expectedTurnId: string })
  | (BaseCommand & { type: 'advanceRound' });
export type CommandError =
  | 'malformed'
  | 'wrong_match'
  | 'duplicate'
  | 'stale_version'
  | 'old_turn'
  | 'wrong_player'
  | 'illegal_play'
  | 'not_in_hand'
  | 'completed'
  | 'wrong_phase';
export type CommandResult =
  | { accepted: true; state: MatchState }
  | { accepted: false; state: MatchState; error: CommandError };

const copyState = (state: MatchState): MatchState => structuredClone(state);
const player = (state: MatchState, id: string) => state.players.find((entry) => entry.id === id);
const active = (state: MatchState) => state.players.map((entry) => entry.id);
const nextClockwise = (
  state: MatchState,
  from: string,
  excluded: readonly string[] = [],
): string | undefined => {
  const start = state.players.findIndex((entry) => entry.id === from);
  const excludedIds = new Set(excluded);
  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = state.players[(start + step) % state.players.length]!;
    if (!excludedIds.has(candidate.id)) return candidate.id;
  }
  return undefined;
};
const setTurn = (state: MatchState, playerId: string) => {
  state.turnSequence += 1;
  state.turnPlayerId = playerId;
  state.turnId = `turn-${state.turnSequence}`;
};
const winners = (state: MatchState) => {
  const high = Math.max(...state.players.map((entry) => entry.capturedCardCount));
  return state.players.filter((entry) => entry.capturedCardCount === high).map((entry) => entry.id);
};
const complete = (state: MatchState) => {
  state.phase = 'completed';
  state.winnerIds = winners(state);
  state.turnPlayerId = undefined;
  state.turnId = undefined;
};

export function getLegalCardInstanceIds(state: MatchState, playerId: string): string[] {
  const hand = player(state, playerId)?.hand;
  if (!hand || !state.challenge) return [];
  const definitions = new Map(state.definitions.map((definition) => [definition.id, definition]));
  const current = definitions.get(state.challenge.card.definitionId)!;
  return hand
    .filter((card) => canDefinitionBeat(definitions.get(card.definitionId)!, current))
    .map((card) => card.id);
}

export function createMatch(input: CreateMatchInput): MatchState {
  if (
    !ID.test(input.matchId) ||
    !Number.isInteger(input.seed) ||
    input.playerIds.length < 2 ||
    input.playerIds.length > 4 ||
    !unique(input.playerIds) ||
    input.playerIds.some((id) => !ID.test(id)) ||
    !Number.isInteger(input.targetScore ?? 50) ||
    (input.targetScore ?? 50) <= 0
  )
    throw new EngineValidationError('Invalid match creation input');
  const { selected, random } = selectMatchDeck(input.definitions, input.seed);
  const leaderId = input.playerIds[random.int(input.playerIds.length)]!;
  const players = input.playerIds.map((id) => ({
    id,
    hand: [] as CardInstance[],
    capturedCardCount: 0,
  }));
  const leaderIndex = input.playerIds.indexOf(leaderId);
  const dealOrder = Array.from(
    { length: input.playerIds.length },
    (_, offset) => input.playerIds[(leaderIndex + offset) % input.playerIds.length]!,
  );
  let cursor = 0;
  for (let card = 0; card < 10; card += 1)
    for (const id of dealOrder)
      player({ players } as MatchState, id)!.hand.push(selected[cursor++]!);
  const challengeCard = selected[cursor++]!;
  return {
    matchId: input.matchId,
    definitions: validateCardDefinitions(input.definitions),
    players,
    deck: selected.slice(cursor),
    pile: [challengeCard],
    phase: 'playing',
    leaderId,
    turnPlayerId: input.playerIds[(input.playerIds.indexOf(leaderId) + 1) % input.playerIds.length],
    turnId: 'turn-1',
    passedPlayerIds: [],
    challenge: { card: challengeCard, ownerId: leaderId },
    targetScore: input.targetScore ?? 50,
    stateVersion: 0,
    commandLog: [],
    seed: input.seed,
    turnSequence: 1,
  };
}

function finishRound(state: MatchState): void {
  const winner = player(state, state.leaderId)!;
  const pileCount = state.pile.length;
  winner.capturedCardCount += pileCount;
  state.pile = [];
  state.phase = 'round_result';
  state.roundWinnerId = winner.id;
  state.turnPlayerId = undefined;
  state.turnId = undefined;
  state.roundResult = {
    winnerId: winner.id,
    pileCount,
    capturedCardCount: winner.capturedCardCount,
  };
}
function refillAndStart(state: MatchState): void {
  const winner = state.roundWinnerId!;
  if (state.players.some((entry) => entry.capturedCardCount >= state.targetScore)) {
    complete(state);
    return;
  }
  let recipient = winner;
  while (state.deck.length && state.players.some((entry) => entry.hand.length < 10)) {
    const target = player(state, recipient)!;
    if (target.hand.length < 10) target.hand.push(state.deck.shift()!);
    recipient = nextClockwise(state, recipient) ?? winner;
  }
  const challengeCard = state.deck.shift();
  if (!challengeCard) {
    complete(state);
    return;
  }
  state.phase = 'playing';
  state.leaderId = winner;
  state.challenge = { card: challengeCard, ownerId: winner };
  state.pile = [challengeCard];
  state.passedPlayerIds = [];
  state.roundWinnerId = undefined;
  state.roundResult = undefined;
  setTurn(state, nextClockwise(state, winner)!);
}

export function applyCommand(state: MatchState, command: MatchCommand): CommandResult {
  if (
    !command ||
    typeof command !== 'object' ||
    !['play', 'skip', 'timeout', 'advanceRound'].includes(
      (command as { type?: unknown }).type as string,
    ) ||
    typeof command.commandId !== 'string' ||
    !command.commandId ||
    typeof command.matchId !== 'string' ||
    !command.matchId ||
    !Number.isInteger(command.expectedStateVersion) ||
    (command.type !== 'advanceRound' &&
      (typeof command.playerId !== 'string' || typeof command.expectedTurnId !== 'string')) ||
    (command.type === 'play' && typeof command.cardInstanceId !== 'string')
  )
    return { accepted: false, state, error: 'malformed' };
  if (command.matchId !== state.matchId) return { accepted: false, state, error: 'wrong_match' };
  if (state.commandLog.some((entry) => entry.commandId === command.commandId))
    return { accepted: false, state, error: 'duplicate' };
  if (state.phase === 'completed') return { accepted: false, state, error: 'completed' };
  if (command.expectedStateVersion !== state.stateVersion)
    return { accepted: false, state, error: 'stale_version' };
  const next = copyState(state);
  if (command.type === 'advanceRound') {
    if (next.phase !== 'round_result') return { accepted: false, state, error: 'wrong_phase' };
    refillAndStart(next);
  } else {
    if (next.phase !== 'playing') return { accepted: false, state, error: 'wrong_phase' };
    if (!command.expectedTurnId || command.expectedTurnId !== next.turnId)
      return { accepted: false, state, error: 'old_turn' };
    if (command.playerId !== next.turnPlayerId)
      return { accepted: false, state, error: 'wrong_player' };
    const actor = player(next, command.playerId)!;
    if (command.type === 'play') {
      const position = actor.hand.findIndex((card) => card.id === command.cardInstanceId);
      if (position < 0) return { accepted: false, state, error: 'not_in_hand' };
      const card = actor.hand[position]!;
      const definition = next.definitions.find((entry) => entry.id === card.definitionId)!;
      const currentDefinition = next.definitions.find(
        (entry) => entry.id === next.challenge?.card.definitionId,
      )!;
      if (!canDefinitionBeat(definition, currentDefinition))
        return { accepted: false, state, error: 'illegal_play' };
      actor.hand.splice(position, 1);
      next.pile.push(card);
      next.leaderId = actor.id;
      next.challenge = { card, ownerId: actor.id };
      next.passedPlayerIds = [];
      const turn = nextClockwise(next, actor.id, [actor.id]);
      if (turn) setTurn(next, turn);
      else finishRound(next);
    } else {
      if (!next.challenge) return { accepted: false, state, error: 'wrong_phase' };
      next.passedPlayerIds.push(actor.id);
      const others = active(next).filter((id) => id !== next.leaderId);
      if (others.every((id) => next.passedPlayerIds.includes(id))) finishRound(next);
      else setTurn(next, nextClockwise(next, actor.id, [...next.passedPlayerIds, next.leaderId])!);
    }
  }
  next.stateVersion += 1;
  next.commandLog.push(structuredClone(command));
  return { accepted: true, state: next };
}
export const reduceMatch = applyCommand;
export function replayMatch(
  input: CreateMatchInput,
  commands: readonly MatchCommand[],
): MatchState {
  let state = createMatch(input);
  for (const command of commands) {
    const result = applyCommand(state, command);
    if (!result.accepted)
      throw new EngineValidationError(`Replay rejected ${command.commandId}: ${result.error}`);
    state = result.state;
  }
  return state;
}
