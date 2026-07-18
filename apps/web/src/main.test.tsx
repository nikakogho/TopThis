import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Guest,
  LobbyAck,
  LobbyView,
  PracticeAck,
  PracticeMatchView,
  PrivateMatchAck,
  PrivateMatchView,
} from '@topthis/shared';

type Handler = (...args: unknown[]) => void;
const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; args: unknown[] }> = [];
  const eventAcks = new Map<string, unknown>();
  let nextAck: unknown;
  const api = {
    auth: {} as Record<string, unknown>,
    connected: true,
    connect: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return api;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return api;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      emitted.push({ event, args });
      const ack = args.at(-1);
      const value = eventAcks.has(event) ? eventAcks.get(event) : nextAck;
      if (typeof ack === 'function' && value !== undefined) (ack as Handler)(value);
      return api;
    }),
  };
  return {
    api,
    emitted,
    handlers,
    setAck(value: unknown) {
      nextAck = value;
    },
    setAckFor(event: string, value: unknown) {
      eventAcks.set(event, value);
    },
    reset() {
      emitted.length = 0;
      eventAcks.clear();
      nextAck = undefined;
      api.auth = {};
      api.connected = true;
    },
  };
});

vi.mock('socket.io-client', () => ({ io: () => socketMock.api }));

import { App } from './main';

const cards: PracticeMatchView['hand'] = [
  {
    instanceId: 'fire.epic-1',
    definitionId: 'fire.epic',
    name: 'Epic Fire',
    rarity: 'epic',
    iconPath: '/cards/fire.epic.png',
    description: 'A fierce counter.',
  },
  {
    instanceId: 'water.common-1',
    definitionId: 'water.common',
    name: 'Common Water',
    rarity: 'common',
    iconPath: '/cards/water.common.png',
    description: 'A simple current.',
  },
  {
    instanceId: 'rust.common-1',
    definitionId: 'rust.common',
    name: 'Rust',
    rarity: 'common',
    iconPath: '/cards/rust.common.png',
    description: 'Corrodes metal.',
  },
];

const playingView: PracticeMatchView = {
  matchId: 'match1',
  yourPlayerId: 'human1',
  stateVersion: 2,
  phase: 'playing',
  players: [
    { id: 'human1', displayName: 'Ada', isBot: false, handCount: 3, capturedCardCount: 0 },
    { id: 'bot1', displayName: 'Bot 1', isBot: true, handCount: 10, capturedCardCount: 0 },
  ],
  hand: cards,
  legalCardInstanceIds: ['fire.epic-1', 'rust.common-1'],
  challengeCard: {
    instanceId: 'cat-1',
    definitionId: 'cat.common',
    name: 'Cat',
    rarity: 'common',
    iconPath: '/cards/cat.common.png',
    description: 'Catches mice.',
  },
  leaderId: 'bot1',
  currentPlayerId: 'human1',
  turnId: 'turn1',
  turnEndsAt: Date.now() + 20_000,
  pileCount: 1,
  deckCount: 178,
};

const ada: Guest = { id: 'guest1', displayName: 'Ada' };
const grace: Guest = { id: 'guest2', displayName: 'Grace' };
const lobbyView: LobbyView = {
  code: 'AB23CD',
  hostGuestId: ada.id,
  settings: { playerCount: 2, targetScore: 50, turnDurationSeconds: 20 },
  players: [
    { guest: ada, ready: false, connected: true },
    { guest: grace, ready: false, connected: true },
  ],
  started: false,
};
const privateMatchView: PrivateMatchView = {
  ...playingView,
  matchMode: 'private',
  players: [
    {
      id: 'human1',
      displayName: 'Ada',
      isBot: false,
      handCount: 3,
      capturedCardCount: 0,
      connected: true,
      abandoned: false,
    },
    {
      id: 'guest2',
      displayName: 'Grace',
      isBot: false,
      handCount: 10,
      capturedCardCount: 0,
      connected: false,
      abandoned: false,
    },
  ],
};

function openMatch(view: PracticeMatchView = playingView) {
  const ack: PracticeAck = { ok: true, view };
  socketMock.setAck(ack);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
}

beforeEach(() => {
  localStorage.clear();
  socketMock.reset();
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: () => 'command1' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TopThis practice UI', () => {
  it('shows the branded landing and configured setup', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Everything beats something. Top this.' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Host Game/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    expect(screen.getByLabelText('Display name')).toHaveValue('Player');
    expect(screen.getByLabelText('Bot opponents')).toHaveValue('1');
  });

  it('renders recipient-safe opponents and explicit legal states', () => {
    openMatch();
    expect(screen.getByRole('region', { name: 'Opponents' })).toHaveTextContent('10 cards in hand');
    expect(screen.getByRole('button', { name: 'Epic Fire. Playable' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Common Water. Cannot beat current card' }),
    ).toBeDisabled();
    expect(screen.getAllByText('Playable')).toHaveLength(2);
  });

  it('selects separately, renders fallback artwork, and confirms a play', () => {
    openMatch();
    const fire = screen.getByRole('button', { name: 'Epic Fire. Playable' });
    const image = fire.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(fire).toHaveTextContent('◆');
    expect(fire).toHaveTextContent('Abstract fallback artwork for Epic Fire');
    fireEvent.click(fire);
    expect(screen.getByText(/Selected:/)).toHaveTextContent('Epic Fire');
    expect(socketMock.emitted.some(({ event }) => event === 'practice:play')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Play Card' }));
    const play = socketMock.emitted.find(({ event }) => event === 'practice:play');
    expect(play?.args[0]).toMatchObject({ cardInstanceId: 'fire.epic-1', expectedTurnId: 'turn1' });
  });

  it('cycles enabled cards and supports Enter confirmation and Escape cancellation', () => {
    openMatch();
    const first = screen.getByRole('button', { name: 'Epic Fire. Playable' });
    const second = screen.getByRole('button', { name: 'Rust. Playable' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'Enter' });
    expect(screen.getByText(/Selected:/)).toHaveTextContent('Rust');
    fireEvent.keyDown(second, { key: 'Escape' });
    expect(screen.getByText('Select a playable card to inspect it.')).toBeTruthy();
    fireEvent.keyDown(second, { key: 'Enter' });
    fireEvent.keyDown(second, { key: 'Enter' });
    expect(socketMock.emitted.some(({ event }) => event === 'practice:play')).toBe(true);
  });

  it('announces defeat instead of assuming every completion is a victory', () => {
    openMatch();
    const completed: PracticeMatchView = {
      ...playingView,
      stateVersion: 8,
      phase: 'completed',
      currentPlayerId: undefined,
      turnId: undefined,
      turnEndsAt: undefined,
      winnerIds: ['bot1'],
      roundResult: { winnerId: 'bot1', pileCount: 3, capturedCardCount: 3 },
    };
    act(() => socketMock.handlers.get('practice:state')?.forEach((handler) => handler(completed)));
    expect(screen.getByRole('heading', { name: 'Defeat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New practice' })).toBeEnabled();
  });
});

describe('TopThis private multiplayer UI', () => {
  it('restores a valid saved guest and rejects an expired token', async () => {
    localStorage.setItem(
      'topthis.guestToken',
      'valid-token-that-is-at-least-thirty-two-characters',
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guest: ada }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = render(<App />);
    await waitFor(() => expect(socketMock.api.connect).toHaveBeenCalled());
    expect(socketMock.api.auth).toEqual({
      guestToken: 'valid-token-that-is-at-least-thirty-two-characters',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/guests/me', {
      headers: { Authorization: 'Bearer valid-token-that-is-at-least-thirty-two-characters' },
    });

    first.unmount();
    socketMock.reset();
    vi.clearAllMocks();
    localStorage.setItem('topthis.guestToken', 'expired-token-that-is-at-least-thirty-two-chars');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<App />);
    await waitFor(() => expect(localStorage.getItem('topthis.guestToken')).toBeNull());
    expect(socketMock.api.connect).not.toHaveBeenCalled();
  });

  it('creates and stores a guest before hosting a lobby', async () => {
    const token = 'new-token-that-is-at-least-thirty-two-characters';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guest: ada, token }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const createAck: LobbyAck = { ok: true, view: lobbyView };
    socketMock.setAckFor('lobby:create', createAck);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Host a lobby' })).toBeTruthy();
    expect(localStorage.getItem('topthis.guestToken')).toBe(token);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guests',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ displayName: 'Ada' }) }),
    );

    fireEvent.change(screen.getByLabelText('Target score'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create lobby' }));
    expect(await screen.findByRole('heading', { name: 'Code: AB23CD' })).toBeTruthy();
    const create = socketMock.emitted.find(({ event }) => event === 'lobby:create');
    expect(create?.args[0]).toEqual({
      settings: { playerCount: 2, targetScore: 75, turnDurationSeconds: 20 },
    });
  });

  it('normalizes a join code and renders non-host lobby controls safely', async () => {
    const token = 'join-token-that-is-at-least-thirty-two-characters';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ guest: grace, token }) }),
    );
    const joinedView: LobbyView = { ...lobbyView, players: lobbyView.players };
    socketMock.setAckFor('lobby:join', { ok: true, view: joinedView } satisfies LobbyAck);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Join a lobby' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Join code'), { target: { value: 'ab23cd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join lobby' }));
    expect(await screen.findByRole('heading', { name: 'Code: AB23CD' })).toBeTruthy();
    expect(socketMock.emitted.find(({ event }) => event === 'lobby:join')?.args[0]).toEqual({
      code: 'AB23CD',
    });
    expect(screen.queryByRole('button', { name: 'Update settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Match' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Lobby settings' })).toHaveTextContent('50');
  });

  it('gates host start, sends ready/settings actions, and waits for leave acknowledgement', async () => {
    localStorage.setItem('topthis.guestToken', 'host-token-that-is-at-least-thirty-two-characters');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ guest: ada }) }),
    );
    render(<App />);
    await waitFor(() => expect(socketMock.api.connect).toHaveBeenCalled());
    act(() => socketMock.handlers.get('lobby:state')?.forEach((handler) => handler(lobbyView)));

    expect(screen.getByRole('button', { name: 'Start Match' })).toBeDisabled();
    socketMock.setAckFor('lobby:settings', { ok: true, view: lobbyView } satisfies LobbyAck);
    socketMock.setAckFor('lobby:ready', { ok: true, view: lobbyView } satisfies LobbyAck);
    fireEvent.change(screen.getByLabelText('Turn timer'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ready up' }));
    expect(socketMock.emitted.find(({ event }) => event === 'lobby:settings')?.args[0]).toEqual({
      settings: { playerCount: 2, targetScore: 50, turnDurationSeconds: 30 },
    });
    expect(socketMock.emitted.find(({ event }) => event === 'lobby:ready')?.args[0]).toEqual({
      ready: true,
    });

    const readyView: LobbyView = {
      ...lobbyView,
      players: lobbyView.players.map((player) => ({ ...player, ready: true })),
    };
    socketMock.setAckFor('lobby:start', { ok: true, view: readyView } satisfies LobbyAck);
    act(() => socketMock.handlers.get('lobby:state')?.forEach((handler) => handler(readyView)));
    fireEvent.click(screen.getByRole('button', { name: 'Start Match' }));
    expect(socketMock.emitted.some(({ event }) => event === 'lobby:start')).toBe(true);

    socketMock.setAckFor('lobby:leave', { ok: true });
    fireEvent.click(screen.getByRole('button', { name: 'Leave lobby' }));
    expect(
      screen.getByRole('heading', { name: 'Everything beats something. Top this.' }),
    ).toBeTruthy();
  });

  it('shows only public opponent state and emits private match commands', () => {
    const playAck: PrivateMatchAck = { ok: true, view: privateMatchView };
    socketMock.setAckFor('match:play', playAck);
    socketMock.setAckFor('match:skip', playAck);
    render(<App />);
    act(() =>
      socketMock.handlers.get('match:state')?.forEach((handler) => handler(privateMatchView)),
    );

    expect(screen.getByText('TOPTHIS / PRIVATE')).toBeTruthy();
    const opponents = screen.getByRole('region', { name: 'Opponents' });
    expect(opponents).toHaveTextContent('Grace');
    expect(opponents).toHaveTextContent('10 cards in hand');
    expect(opponents).toHaveTextContent('Disconnected');
    expect(opponents.querySelector('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Epic Fire. Playable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play Card' }));
    expect(socketMock.emitted.find(({ event }) => event === 'match:play')?.args[0]).toMatchObject({
      matchId: 'match1',
      cardInstanceId: 'fire.epic-1',
      expectedTurnId: 'turn1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(socketMock.emitted.some(({ event }) => event === 'match:skip')).toBe(true);
    expect(socketMock.emitted.some(({ event }) => event.startsWith('practice:'))).toBe(false);
  });
});

describe('TopThis matchmaking and leaderboard UI', () => {
  it('requires guest identity before queue entry and emits queue enter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        guest: ada,
        token: 'queue-token-that-is-at-least-thirty-two-characters',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    socketMock.setAckFor('queue:enter', {
      ok: true,
      status: { queued: true, position: 1, playersNeeded: 1 },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Find Match' }));
    expect(await screen.findByRole('heading', { name: 'Choose a display name' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Finding your match' })).toBeTruthy();
    expect(socketMock.emitted.some(({ event }) => event === 'queue:enter')).toBe(true);
  });

  it('renders queue status, cancels, and transitions to a matchmaking table', async () => {
    localStorage.setItem('topthis.guestToken', 'queue-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ guest: ada }) }),
    );
    render(<App />);
    await waitFor(() => expect(socketMock.api.connect).toHaveBeenCalled());
    act(() =>
      socketMock.handlers
        .get('queue:status')
        ?.forEach((handler) => handler({ queued: true, position: 1, playersNeeded: 1 })),
    );
    expect(screen.getByText(/Position 1/)).toBeTruthy();
    socketMock.setAckFor('queue:leave', {
      ok: true,
      status: { queued: false, playersNeeded: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('heading', { name: 'Everything beats something. Top this.' }),
    ).toBeTruthy();
    act(() =>
      socketMock.handlers
        .get('match:state')
        ?.forEach((handler) => handler({ ...privateMatchView, matchMode: 'matchmaking' })),
    );
    expect(screen.getByText('TOPTHIS / MATCHMAKING')).toBeTruthy();
    act(() =>
      socketMock.handlers
        .get('queue:status')
        ?.forEach((handler) => handler({ queued: false, playersNeeded: 1 })),
    );
    expect(screen.getByText('TOPTHIS / MATCHMAKING')).toBeTruthy();
  });

  it('loads leaderboard rows with bounded pagination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          page: 1,
          pageSize: 20,
          total: 1,
          entries: [
            {
              rank: 1,
              guestId: 'guest1',
              displayName: 'Ada',
              rating: 1010,
              gamesPlayed: 1,
              wins: 1,
              losses: 0,
              ties: 0,
            },
          ],
        }),
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    expect(await screen.findByText('Ada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('loads the next leaderboard page and updates pagination controls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          pageSize: 20,
          total: 21,
          entries: [
            {
              rank: 1,
              guestId: 'guest1',
              displayName: 'Ada',
              rating: 1012,
              gamesPlayed: 1,
              wins: 1,
              losses: 0,
              ties: 0,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 2,
          pageSize: 20,
          total: 21,
          entries: [
            {
              rank: 21,
              guestId: 'guest2',
              displayName: 'Grace',
              rating: 988,
              gamesPlayed: 1,
              wins: 0,
              losses: 1,
              ties: 0,
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    expect(await screen.findByText('Ada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Grace')).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/leaderboard?page=2&pageSize=20');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('renders an empty leaderboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ page: 1, pageSize: 20, total: 0, entries: [] }),
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    expect(await screen.findByText('No completed matches yet.')).toBeTruthy();
  });

  it('announces a leaderboard request failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load leaderboard.');
  });

  it('opens semantic rules, moves focus, and restores the landing trigger', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'How to Play' }));
    expect(screen.getByRole('heading', { name: 'Top this.' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Objective' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to menu' }));
    expect(screen.getByRole('button', { name: 'How to Play' })).toHaveFocus();
  });
});
