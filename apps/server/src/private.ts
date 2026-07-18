import { randomInt, randomUUID } from 'node:crypto';
import cards from '../../../content/cards.json';
import {
  applyCommand,
  createMatch,
  getLegalCardInstanceIds,
  validateCardDefinitions,
  type CardDefinition,
  type MatchCommand,
  type MatchState,
} from '@topthis/game-engine';
import {
  LobbyCodeSchema,
  LobbyCreateIntentSchema,
  LobbyJoinIntentSchema,
  LobbyReadyIntentSchema,
  LobbySettingsIntentSchema,
  LobbyViewSchema,
  PrivateMatchAckSchema,
  PrivateMatchViewSchema,
  PrivatePlayIntentSchema,
  PrivateSkipIntentSchema,
  type Guest,
  type LobbySettings,
  type LobbyView,
  type PrivateMatchAck,
  type PrivateMatchView,
} from '@topthis/shared';
import type { Socket } from 'socket.io';
const catalog = validateCardDefinitions(cards as CardDefinition[]),
  alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  defaults: LobbySettings = { playerCount: 2, targetScore: 50, turnDurationSeconds: 20 };
const id = (p: string) => `${p}${randomUUID().replaceAll('-', '')}`;
type Seat = {
  guest: Guest;
  ready: boolean;
  socket?: Socket;
  abandoned?: boolean;
  grace?: NodeJS.Timeout;
};
type Lobby = {
  code: string;
  hostGuestId: string;
  settings: LobbySettings;
  seats: Seat[];
  timers: Map<string, NodeJS.Timeout>;
};
type Active = {
  state: MatchState;
  seats: Map<string, Seat>;
  queue: Promise<void>;
  timer?: NodeJS.Timeout;
  round?: NodeJS.Timeout;
  turnEndsAt?: number;
  settings: LobbySettings;
  mode: 'private' | 'matchmaking';
  completed?: boolean;
};
export interface PrivateOptions {
  seed?: number;
  disconnectGraceMs?: number;
  roundResultDelayMs?: number;
  targetScore?: number;
  turnDurationMs?: number;
  onComplete?: (input: {
    matchId: string;
    mode: 'private' | 'matchmaking';
    seed: number;
    commandLog: MatchCommand[];
    players: Array<{ guestId: string; score: number }>;
  }) => void;
}
export class PrivateService {
  private lobbies = new Map<string, Lobby>();
  private guestLobby = new Map<string, string>();
  private matches = new Map<string, Active>();
  private guestMatch = new Map<string, string>();
  private seq = 0;
  private queued = new Map<string, Seat>();
  private o: Omit<Required<PrivateOptions>, 'onComplete'> & Pick<PrivateOptions, 'onComplete'>;
  constructor(o: PrivateOptions = {}) {
    this.o = {
      seed: o.seed ?? randomInt(0, 0x7fffffff),
      disconnectGraceMs: o.disconnectGraceMs ?? 60000,
      roundResultDelayMs: o.roundResultDelayMs ?? 1500,
      targetScore: o.targetScore ?? 0,
      turnDurationMs: o.turnDurationMs ?? 0,
      onComplete: o.onComplete,
    };
  }
  private guest(s: Socket) {
    const g = s.data.guest as Guest | undefined;
    if (!g) throw Error('AUTH_REQUIRED');
    return g;
  }
  private code() {
    do {
      const c = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      if (!this.lobbies.has(c)) return c;
    } while (true);
  }
  private lv(l: Lobby): LobbyView {
    return LobbyViewSchema.parse({
      code: l.code,
      hostGuestId: l.hostGuestId,
      settings: l.settings,
      started: false,
      players: l.seats.map((s) => ({ guest: s.guest, ready: s.ready, connected: !!s.socket })),
    });
  }
  private lobbySeat(s: Socket) {
    const g = this.guest(s),
      l = this.lobbies.get(this.guestLobby.get(g.id) ?? ''),
      seat = l?.seats.find((x) => x.guest.id === g.id);
    if (!l || !seat || seat.socket?.id !== s.id) throw Error('NO_SESSION');
    return { l, seat, g };
  }
  private emitLobby(l: Lobby) {
    for (const s of l.seats) s.socket?.emit('lobby:state', this.lv(l));
  }
  private remove(l: Lobby, s: Seat) {
    const t = l.timers.get(s.guest.id);
    if (t) clearTimeout(t);
    l.timers.delete(s.guest.id);
    l.seats = l.seats.filter((x) => x !== s);
    this.guestLobby.delete(s.guest.id);
    if (l.hostGuestId === s.guest.id && l.seats[0]) l.hostGuestId = l.seats[0].guest.id;
    if (!l.seats.length) this.lobbies.delete(l.code);
    else this.emitLobby(l);
  }
  create(s: Socket, raw: unknown) {
    const g = this.guest(s);
    if (this.guestLobby.has(g.id) || this.guestMatch.has(g.id) || this.queued.has(g.id))
      throw Error('ALREADY_ACTIVE');
    const input = LobbyCreateIntentSchema.parse(raw);
    const l: Lobby = {
      code: this.code(),
      hostGuestId: g.id,
      settings: input.settings ?? defaults,
      seats: [{ guest: g, ready: false, socket: s }],
      timers: new Map(),
    };
    this.lobbies.set(l.code, l);
    this.guestLobby.set(g.id, l.code);
    return this.lv(l);
  }
  join(s: Socket, raw: unknown) {
    const g = this.guest(s),
      code = LobbyCodeSchema.parse(LobbyJoinIntentSchema.parse(raw).code.trim().toUpperCase());
    if (this.guestLobby.has(g.id) || this.guestMatch.has(g.id) || this.queued.has(g.id))
      throw Error('ALREADY_ACTIVE');
    const l = this.lobbies.get(code);
    if (!l || l.seats.length >= l.settings.playerCount) throw Error('LOBBY_UNAVAILABLE');
    l.seats.push({ guest: g, ready: false, socket: s });
    this.guestLobby.set(g.id, code);
    this.emitLobby(l);
    return this.lv(l);
  }
  leave(s: Socket): void {
    const { l, seat } = this.lobbySeat(s);
    this.remove(l, seat);
  }
  ready(s: Socket, r: unknown) {
    const { l, seat } = this.lobbySeat(s);
    seat.ready = LobbyReadyIntentSchema.parse(r).ready;
    this.emitLobby(l);
    return this.lv(l);
  }
  settings(s: Socket, r: unknown) {
    const { l, g } = this.lobbySeat(s);
    if (l.hostGuestId !== g.id) throw Error('NOT_HOST');
    const settings = LobbySettingsIntentSchema.parse(r).settings;
    if (settings.playerCount < l.seats.length) throw Error('LOBBY_UNAVAILABLE');
    l.settings = settings;
    l.seats.forEach((x) => (x.ready = false));
    this.emitLobby(l);
    return this.lv(l);
  }
  start(s: Socket) {
    const { l, g } = this.lobbySeat(s);
    if (l.hostGuestId !== g.id) throw Error('NOT_HOST');
    if (l.seats.length !== l.settings.playerCount || l.seats.some((x) => !x.ready || !x.socket))
      throw Error('NOT_READY');
    for (const t of l.timers.values()) clearTimeout(t);
    this.lobbies.delete(l.code);
    const settings = { ...l.settings, targetScore: this.o.targetScore || l.settings.targetScore };
    const state = this.startActive(l.seats, settings, 'private');
    return { view: this.lv(l), matchId: state.matchId };
  }
  private startActive(seats: Seat[], settings: LobbySettings, mode: 'private' | 'matchmaking') {
    const state = createMatch({
      matchId: id('m'),
      playerIds: seats.map((x) => x.guest.id),
      definitions: catalog,
      seed: this.o.seed + this.seq++,
      targetScore: settings.targetScore,
    });
    const a: Active = {
      state,
      seats: new Map(seats.map((x) => [x.guest.id, x])),
      queue: Promise.resolve(),
      settings,
      mode,
    };
    this.matches.set(state.matchId, a);
    for (const x of seats) {
      this.guestLobby.delete(x.guest.id);
      this.guestMatch.set(x.guest.id, state.matchId);
    }
    this.schedule(a);
    this.emit(a);
    return state;
  }
  queueEnter(s: Socket) {
    const g = this.guest(s);
    if (this.guestLobby.has(g.id) || this.guestMatch.has(g.id)) throw Error('ALREADY_ACTIVE');
    const old = this.queued.get(g.id);
    if (old?.socket && old.socket.id !== s.id) old.socket.disconnect(true);
    this.queued.set(g.id, { guest: g, ready: false, socket: s });
    this.emitQueue();
    this.pairQueue();
    return this.queueStatus(g.id);
  }
  queueLeave(s: Socket) {
    const g = this.guest(s),
      seat = this.queued.get(g.id);
    if (!seat || seat.socket?.id !== s.id) throw Error('NO_SESSION');
    this.queued.delete(g.id);
    this.emitQueue();
    return this.queueStatus(g.id);
  }
  queueStatus(guestId: string) {
    const position = [...this.queued.keys()].indexOf(guestId);
    return position < 0
      ? { queued: false, playersNeeded: 1 }
      : { queued: true, position: position + 1, playersNeeded: Math.max(0, 2 - this.queued.size) };
  }
  private emitQueue() {
    for (const [guestId, seat] of this.queued)
      seat.socket?.emit('queue:status', this.queueStatus(guestId));
  }
  private pairQueue() {
    while (this.queued.size >= 2) {
      const seats = [...this.queued.values()].slice(0, 2);
      for (const seat of seats) this.queued.delete(seat.guest.id);
      this.startActive(
        seats,
        {
          playerCount: 2,
          targetScore: this.o.targetScore || defaults.targetScore,
          turnDurationSeconds: this.o.turnDurationMs
            ? Math.max(5, Math.ceil(this.o.turnDurationMs / 1000))
            : defaults.turnDurationSeconds,
        },
        'matchmaking',
      );
    }
    this.emitQueue();
  }
  private view(a: Active, gid: string): PrivateMatchView {
    const me = a.state.players.find((x) => x.id === gid)!;
    const cv = (c: { id: string; definitionId: string }) => {
      const d = a.state.definitions.find((x) => x.id === c.definitionId)!;
      return {
        instanceId: c.id,
        definitionId: d.id,
        name: d.name,
        description: d.description,
        rarity: d.rarity,
        iconPath: d.iconPath,
      };
    };
    return PrivateMatchViewSchema.parse({
      matchId: a.state.matchId,
      matchMode: a.mode,
      yourPlayerId: gid,
      stateVersion: a.state.stateVersion,
      phase: a.state.phase,
      players: a.state.players.map((p) => {
        const s = a.seats.get(p.id)!;
        return {
          id: p.id,
          displayName: s.guest.displayName,
          isBot: false,
          capturedCardCount: p.capturedCardCount,
          handCount: p.hand.length,
          connected: !!s.socket,
          abandoned: !!s.abandoned,
        };
      }),
      hand: me.hand.map(cv),
      legalCardInstanceIds:
        a.state.phase === 'playing' && a.state.turnPlayerId === gid
          ? getLegalCardInstanceIds(a.state, gid)
          : [],
      challengeCard: a.state.challenge ? cv(a.state.challenge.card) : undefined,
      leaderId: a.state.leaderId,
      currentPlayerId: a.state.turnPlayerId,
      turnId: a.state.turnId,
      turnEndsAt: a.turnEndsAt,
      pileCount: a.state.pile.length,
      deckCount: a.state.deck.length,
      roundResult: a.state.roundResult,
      winnerIds: a.state.winnerIds,
      placements:
        a.state.phase === 'completed'
          ? [...a.state.players]
              .sort((x, y) => y.capturedCardCount - x.capturedCardCount)
              .map((x) => x.id)
          : undefined,
    });
  }
  private emit(a: Active) {
    for (const [g, s] of a.seats) s.socket?.emit('match:state', this.view(a, g));
  }
  command(s: Socket, raw: unknown, type: 'play' | 'skip'): Promise<PrivateMatchAck> {
    const g = this.guest(s),
      a = this.matches.get(this.guestMatch.get(g.id) ?? '');
    if (!a || a.seats.get(g.id)?.socket?.id !== s.id) throw Error('NO_SESSION');
    const c: MatchCommand =
      type === 'play'
        ? { ...PrivatePlayIntentSchema.parse(raw), type: 'play', playerId: g.id }
        : { ...PrivateSkipIntentSchema.parse(raw), type: 'skip', playerId: g.id };
    return new Promise((resolve) => {
      a.queue = a.queue.then(() => {
        const r = applyCommand(a.state, c);
        if (r.accepted) {
          a.state = r.state;
          this.afterTransition(a);
        }
        resolve(
          PrivateMatchAckSchema.parse(
            r.accepted
              ? { ok: true, view: this.view(a, g.id) }
              : {
                  ok: false,
                  view: this.view(a, g.id),
                  error: { code: 'COMMAND_REJECTED', message: r.error },
                },
          ),
        );
      });
    });
  }
  private submit(a: Active, c: MatchCommand) {
    a.queue = a.queue.then(() => {
      const r = applyCommand(a.state, c);
      if (r.accepted) {
        a.state = r.state;
        this.afterTransition(a);
      }
    });
  }
  private afterTransition(a: Active) {
    this.schedule(a);
    this.emit(a);
    if (a.state.phase === 'completed' && !a.completed) {
      a.completed = true;
      this.o.onComplete?.({
        matchId: a.state.matchId,
        mode: a.mode,
        seed: a.state.seed,
        commandLog: a.state.commandLog,
        players: a.state.players.map((p) => ({ guestId: p.id, score: p.capturedCardCount })),
      });
    }
  }
  private schedule(a: Active) {
    if (a.timer) clearTimeout(a.timer);
    if (a.round) clearTimeout(a.round);
    a.turnEndsAt = undefined;
    if (a.state.phase === 'round_result') {
      a.round = setTimeout(
        () =>
          this.submit(a, {
            type: 'advanceRound',
            commandId: id('advance'),
            matchId: a.state.matchId,
            expectedStateVersion: a.state.stateVersion,
          }),
        this.o.roundResultDelayMs,
      );
      return;
    }
    if (a.state.phase !== 'playing' || !a.state.turnId || !a.state.turnPlayerId) return;
    const player = a.state.turnPlayerId,
      v = a.state.stateVersion,
      t = a.state.turnId,
      seat = a.seats.get(player)!;
    const delay = seat.abandoned
      ? 0
      : this.o.turnDurationMs || a.settings.turnDurationSeconds * 1000;
    a.turnEndsAt = Date.now() + delay;
    a.timer = setTimeout(
      () =>
        this.submit(a, {
          type: 'timeout',
          commandId: id('timeout'),
          matchId: a.state.matchId,
          expectedStateVersion: v,
          expectedTurnId: t,
          playerId: player,
        }),
      delay,
    );
  }
  disconnect(socket: Socket) {
    const g = socket.data.guest as Guest | undefined;
    if (!g) return;
    const queued = this.queued.get(g.id);
    if (queued?.socket?.id === socket.id) {
      this.queued.delete(g.id);
      this.emitQueue();
    }
    const l = this.lobbies.get(this.guestLobby.get(g.id) ?? ''),
      ls = l?.seats.find((x) => x.guest.id === g.id);
    if (l && ls && ls.socket?.id === socket.id) {
      ls.socket = undefined;
      const existing = l.timers.get(g.id);
      if (existing) clearTimeout(existing);
      l.timers.set(
        g.id,
        setTimeout(() => this.remove(l, ls), this.o.disconnectGraceMs),
      );
      this.emitLobby(l);
    }
    const a = this.matches.get(this.guestMatch.get(g.id) ?? ''),
      ms = a?.seats.get(g.id);
    if (a && ms && ms.socket?.id === socket.id) {
      ms.socket = undefined;
      if (ms.grace) clearTimeout(ms.grace);
      ms.grace = setTimeout(() => {
        if (!ms.socket) {
          ms.abandoned = true;
          ms.grace = undefined;
          if (a.state.phase === 'playing' && a.state.turnPlayerId === g.id) this.schedule(a);
        }
      }, this.o.disconnectGraceMs);
      this.emit(a);
    }
  }
  reconnect(s: Socket) {
    const g = this.guest(s),
      queued = this.queued.get(g.id),
      l = this.lobbies.get(this.guestLobby.get(g.id) ?? ''),
      ls = l?.seats.find((x) => x.guest.id === g.id);
    if (queued) {
      const old = queued.socket;
      queued.socket = s;
      if (old && old.id !== s.id) old.disconnect(true);
      this.emitQueue();
    }
    if (l && ls) {
      const old = ls.socket;
      ls.socket = s;
      const t = l.timers.get(g.id);
      if (t) {
        clearTimeout(t);
        l.timers.delete(g.id);
      }
      if (old && old.id !== s.id) old.disconnect(true);
      this.emitLobby(l);
    }
    const a = this.matches.get(this.guestMatch.get(g.id) ?? ''),
      ms = a?.seats.get(g.id);
    if (a && ms) {
      if (ms.abandoned) throw Error('RECONNECT_EXPIRED');
      const old = ms.socket;
      ms.socket = s;
      if (ms.grace) {
        clearTimeout(ms.grace);
        ms.grace = undefined;
      }
      if (old && old.id !== s.id) old.disconnect(true);
      s.emit('match:state', this.view(a, g.id));
    }
  }
  close() {
    for (const a of this.matches.values()) {
      if (a.timer) clearTimeout(a.timer);
      if (a.round) clearTimeout(a.round);
      for (const s of a.seats.values()) if (s.grace) clearTimeout(s.grace);
    }
    for (const l of this.lobbies.values()) for (const t of l.timers.values()) clearTimeout(t);
  }
}
