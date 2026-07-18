import { randomInt, randomUUID } from 'node:crypto';
import cards from '../../../content/cards.json';
import {
  applyCommand,
  createMatch,
  getLegalCardInstanceIds,
  SeededRandom,
  validateCardDefinitions,
  type CardDefinition,
  type CommandError,
  type MatchCommand,
  type MatchState,
} from '@topthis/game-engine';
import {
  PracticeCreateIntentSchema,
  PracticeMatchViewSchema,
  PracticePlayIntentSchema,
  PracticeSkipIntentSchema,
  type PracticeAck,
  type PracticeMatchView,
} from '@topthis/shared';
import type { Socket } from 'socket.io';

type Timers = { action?: NodeJS.Timeout; bot?: NodeJS.Timeout; round?: NodeJS.Timeout };
type Session = {
  socket: Socket;
  state: MatchState;
  humanId: string;
  botIds: Set<string>;
  names: Map<string, string>;
  random: SeededRandom;
  queue: Promise<void>;
  timers: Timers;
  turnEndsAt?: number;
};
export interface PracticeOptions {
  seed?: number;
  targetScore?: number;
  turnDurationMs?: number;
  botDelayMs?: number;
  roundResultDelayMs?: number;
  botSkipChance?: number;
}
const catalog = validateCardDefinitions(cards as CardDefinition[]);
const makeId = (prefix: string) => `${prefix}${randomUUID().replaceAll('-', '')}`;

export class PracticeService {
  private readonly sessions = new Map<string, Session>();
  private sequence = 0;
  private readonly options: Required<PracticeOptions>;
  constructor(options: PracticeOptions = {}) {
    this.options = {
      seed: options.seed ?? randomInt(0, 0x7fffffff),
      targetScore: options.targetScore ?? 50,
      turnDurationMs: options.turnDurationMs ?? 20_000,
      botDelayMs: options.botDelayMs ?? 650,
      roundResultDelayMs: options.roundResultDelayMs ?? 1_500,
      botSkipChance: options.botSkipChance ?? 0.12,
    };
  }

  create(socket: Socket, raw: unknown): PracticeMatchView {
    this.remove(socket.id);
    const intent = PracticeCreateIntentSchema.parse(raw);
    const humanId = makeId('p');
    const botIds = Array.from({ length: intent.botCount }, () => makeId('p'));
    const seed = this.options.seed + this.sequence++;
    const state = createMatch({
      matchId: makeId('m'),
      playerIds: [humanId, ...botIds],
      definitions: catalog,
      seed,
      targetScore: this.options.targetScore,
    });
    const names = new Map<string, string>([
      [humanId, intent.displayName] as const,
      ...botIds.map((id, index) => [id, `Bot ${index + 1}`] as const),
    ]);
    this.sessions.set(socket.id, {
      socket,
      state,
      humanId,
      botIds: new Set(botIds),
      names,
      random: new SeededRandom(seed ^ 0x9e3779b9),
      queue: Promise.resolve(),
      timers: {},
    });
    this.reschedule(socket.id);
    return this.view(socket.id);
  }

  private session(socketId: string): Session {
    const session = this.sessions.get(socketId);
    if (!session) throw new Error('No practice session');
    return session;
  }
  view(socketId: string): PracticeMatchView {
    const session = this.session(socketId);
    const { state } = session;
    const human = state.players.find((entry) => entry.id === session.humanId)!;
    const legal =
      state.phase === 'playing' && state.turnPlayerId === session.humanId
        ? getLegalCardInstanceIds(state, session.humanId)
        : [];
    const card = (instance: { id: string; definitionId: string }) => {
      const d = state.definitions.find((definition) => definition.id === instance.definitionId)!;
      return {
        instanceId: instance.id,
        definitionId: d.id,
        name: d.name,
        description: d.description,
        rarity: d.rarity,
        iconPath: d.iconPath,
      };
    };
    return PracticeMatchViewSchema.parse({
      matchId: state.matchId,
      yourPlayerId: session.humanId,
      stateVersion: state.stateVersion,
      phase: state.phase,
      players: state.players.map((player) => ({
        id: player.id,
        displayName: session.names.get(player.id)!,
        isBot: session.botIds.has(player.id),
        capturedCardCount: player.capturedCardCount,
        handCount: player.hand.length,
      })),
      hand: human.hand.map(card),
      legalCardInstanceIds: legal,
      challengeCard: state.challenge ? card(state.challenge.card) : undefined,
      leaderId: state.leaderId,
      currentPlayerId: state.turnPlayerId,
      turnId: state.turnId,
      turnEndsAt: session.turnEndsAt,
      pileCount: state.pile.length,
      deckCount: state.deck.length,
      roundResult: state.roundResult,
      winnerIds: state.winnerIds,
    });
  }
  private emit(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (session) session.socket.emit('practice:state', this.view(socketId));
  }
  private clear(session: Session): void {
    if (session.timers.action) clearTimeout(session.timers.action);
    if (session.timers.bot) clearTimeout(session.timers.bot);
    if (session.timers.round) clearTimeout(session.timers.round);
    session.timers = {};
    session.turnEndsAt = undefined;
  }
  private reschedule(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (!session) return;
    this.clear(session);
    const state = session.state;
    if (state.phase === 'round_result') {
      session.timers.round = setTimeout(
        () => void this.advance(socketId),
        this.options.roundResultDelayMs,
      );
      return;
    }
    if (state.phase !== 'playing' || !state.turnPlayerId || !state.turnId) return;
    session.turnEndsAt = Date.now() + this.options.turnDurationMs;
    const playerId = state.turnPlayerId;
    const expectedTurnId = state.turnId;
    const expectedStateVersion = state.stateVersion;
    session.timers.action = setTimeout(
      () =>
        void this.submit(socketId, {
          type: 'timeout',
          commandId: makeId('timeout'),
          matchId: state.matchId,
          expectedStateVersion,
          expectedTurnId,
          playerId,
        }),
      this.options.turnDurationMs,
    );
    if (session.botIds.has(playerId))
      session.timers.bot = setTimeout(
        () => void this.bot(socketId, playerId, expectedStateVersion, expectedTurnId),
        Math.min(this.options.botDelayMs, this.options.turnDurationMs),
      );
  }
  private enqueue<T>(socketId: string, work: () => T): Promise<T> {
    const session = this.session(socketId);
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    session.queue = session.queue.then(() => {
      try {
        resolve(work());
      } catch (error) {
        reject(error);
      }
    });
    return result;
  }
  private accepted(
    socketId: string,
    command: MatchCommand,
  ): { accepted: boolean; error?: CommandError; view: PracticeMatchView } {
    const session = this.session(socketId);
    const result = applyCommand(session.state, command);
    if (result.accepted) {
      session.state = result.state;
      this.reschedule(socketId);
      this.emit(socketId);
    }
    return {
      accepted: result.accepted,
      error: result.accepted ? undefined : result.error,
      view: this.view(socketId),
    };
  }
  async command(socketId: string, raw: unknown, type: 'play' | 'skip'): Promise<PracticeAck> {
    const session = this.session(socketId);
    const command: MatchCommand =
      type === 'play'
        ? { ...PracticePlayIntentSchema.parse(raw), type: 'play', playerId: session.humanId }
        : { ...PracticeSkipIntentSchema.parse(raw), type: 'skip', playerId: session.humanId };
    const result = await this.enqueue(socketId, () => this.accepted(socketId, command));
    return result.accepted
      ? { ok: true, view: result.view }
      : {
          ok: false,
          view: result.view,
          error: { code: 'COMMAND_REJECTED', message: result.error! },
        };
  }
  private async submit(socketId: string, command: MatchCommand): Promise<void> {
    if (!this.sessions.has(socketId)) return;
    await this.enqueue(socketId, () => this.accepted(socketId, command));
  }
  private async bot(
    socketId: string,
    playerId: string,
    expectedStateVersion: number,
    expectedTurnId: string,
  ): Promise<void> {
    const session = this.sessions.get(socketId);
    if (!session) return;
    const legal = getLegalCardInstanceIds(session.state, playerId);
    const player = session.state.players.find((entry) => entry.id === playerId)!;
    const rank = (id: string) => {
      const definition = session.state.definitions.find(
        (entry) => entry.id === player.hand.find((card) => card.id === id)!.definitionId,
      )!;
      const special =
        definition.id === 'meteor.legendary'
          ? 10_000
          : definition.id === 'tornado.legendary'
            ? 5_000
            : 0;
      // Saving broad counters and scarce cards gives the bot a predictable, modest strategy.
      return (
        special + definition.beatsDefinitionIds.length * 100 + (100 - definition.masterPoolCopies)
      );
    };
    const skip = !legal.length || session.random.next() < this.options.botSkipChance;
    const command: MatchCommand = skip
      ? {
          type: 'skip',
          commandId: makeId('bot'),
          matchId: session.state.matchId,
          expectedStateVersion,
          expectedTurnId,
          playerId,
        }
      : {
          type: 'play',
          commandId: makeId('bot'),
          matchId: session.state.matchId,
          expectedStateVersion,
          expectedTurnId,
          playerId,
          cardInstanceId: [...legal].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0]!,
        };
    await this.submit(socketId, command);
  }
  private async advance(socketId: string): Promise<void> {
    const session = this.sessions.get(socketId);
    if (!session) return;
    await this.submit(socketId, {
      type: 'advanceRound',
      commandId: makeId('advance'),
      matchId: session.state.matchId,
      expectedStateVersion: session.state.stateVersion,
    });
  }
  remove(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (session) this.clear(session);
    this.sessions.delete(socketId);
  }
  close(): void {
    for (const id of this.sessions.keys()) this.remove(id);
  }
}
