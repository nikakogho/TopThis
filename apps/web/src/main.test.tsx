import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeAck, PracticeMatchView } from '@topthis/shared';

type Handler = (...args: unknown[]) => void;
const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; args: unknown[] }> = [];
  let nextAck: unknown;
  const api = {
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
      if (typeof ack === 'function' && nextAck !== undefined) (ack as Handler)(nextAck);
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
    reset() {
      emitted.length = 0;
      nextAck = undefined;
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

function openMatch(view: PracticeMatchView = playingView) {
  const ack: PracticeAck = { ok: true, view };
  socketMock.setAck(ack);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
}

beforeEach(() => {
  socketMock.reset();
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
    expect(screen.getByRole('button', { name: /Host Game/ })).toBeDisabled();
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
