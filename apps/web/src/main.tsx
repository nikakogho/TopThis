import { StrictMode, useEffect, useState, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import type { PracticeAck, PracticeMatchView } from '@topthis/shared';
import './styles.css';

type Card = PracticeMatchView['hand'][number];
type Screen = 'landing' | 'setup' | 'match';

const socket = io(import.meta.env.VITE_TOPTHIS_SERVER_URL || undefined, {
  autoConnect: false,
}) as Socket;

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

function CardFace({ card }: { card: Card }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className="card-face">
      <span className="art" aria-hidden="true">
        {imageFailed ? (
          <span className="fallback-symbol">◆</span>
        ) : (
          <img
            src={`/cards/${card.definitionId}.png`}
            alt=""
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <strong>{card.name}</strong>
      <span className="rarity-label">{card.rarity}</span>
      <span className="card-description">{card.description}</span>
      <span className="sr-only">
        {imageFailed ? `Abstract fallback artwork for ${card.name}` : `${card.name} artwork`}
      </span>
    </span>
  );
}

function resultHeading(view: PracticeMatchView): string {
  const winners = view.winnerIds ?? [];
  if (winners.includes(view.yourPlayerId)) return winners.length > 1 ? 'Tied match' : 'Victory!';
  return 'Defeat';
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [name, setName] = useState('Player');
  const [bots, setBots] = useState(1);
  const [view, setView] = useState<PracticeMatchView>();
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const onState = (next: PracticeMatchView) => {
      setView(next);
      setScreen('match');
      setSelected((current) =>
        current && next.legalCardInstanceIds.includes(current) ? current : undefined,
      );
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setError('Could not connect to TopThis Server.');
    socket.on('practice:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('practice:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  useEffect(() => {
    if (!view?.turnEndsAt || view.phase !== 'playing') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [view?.phase, view?.turnEndsAt]);

  const start = () => {
    setError('');
    socket.connect();
    socket.emit('practice:create', { displayName: name, botCount: bots }, (ack: PracticeAck) => {
      if (ack.ok) {
        setView(ack.view);
        setScreen('match');
      } else {
        setError(ack.error.message);
      }
    });
  };

  const command = (type: 'play' | 'skip') => {
    if (!view?.turnId || (type === 'play' && !selected)) return;
    const payload = {
      commandId: crypto.randomUUID(),
      matchId: view.matchId,
      expectedStateVersion: view.stateVersion,
      expectedTurnId: view.turnId,
      ...(type === 'play' ? { cardInstanceId: selected } : {}),
    };
    socket.emit(`practice:${type}`, payload, (ack: PracticeAck) => {
      if (ack.ok) setView(ack.view);
      else {
        if (ack.view) setView(ack.view);
        setError(ack.error.message);
      }
    });
    setSelected(undefined);
  };

  if (screen === 'landing') {
    return (
      <main className="landing">
        <p className="eyebrow">TOPTHIS</p>
        <h1>Everything beats something. Top this.</h1>
        <p className="tagline">
          A strategic multiplayer card game where every card has its own counters, and the last
          successful play takes the pile.
        </p>
        <div className="actions">
          <button onClick={() => setScreen('setup')}>Practice</button>
          {['Host Game', 'Join Game', 'Find Match', 'Leaderboard', 'How to Play'].map((label) => (
            <button className="muted" disabled key={label}>
              {label}
              <small>Coming soon</small>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (screen === 'setup') {
    return (
      <main className="setup">
        <p className="eyebrow">PRACTICE</p>
        <h1>Deal a table</h1>
        <label>
          Display name
          <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Bot opponents
          <select value={bots} onChange={(event) => setBots(Number(event.target.value))}>
            {[1, 2, 3].map((count) => (
              <option key={count}>{count}</option>
            ))}
          </select>
        </label>
        <p className="setup-note">First to 50 captured cards wins. Turns last 20 seconds.</p>
        {error && <p role="alert">{error}</p>}
        <button disabled={!name.trim()} onClick={start}>
          Start practice
        </button>
        <button className="link" onClick={() => setScreen('landing')}>
          Back
        </button>
      </main>
    );
  }

  if (!view) return null;
  const myTurn = view.phase === 'playing' && view.currentPlayerId === view.yourPlayerId;
  const legal = new Set(view.legalCardInstanceIds);
  const selectedCard = view.hand.find((card) => card.instanceId === selected);
  const leader = view.players.find((player) => player.id === view.leaderId);
  const current = view.players.find((player) => player.id === view.currentPlayerId);
  const roundWinner = view.players.find((player) => player.id === view.roundResult?.winnerId);
  const seconds = view.turnEndsAt ? Math.max(0, Math.ceil((view.turnEndsAt - now) / 1000)) : 0;
  const status =
    view.phase === 'playing'
      ? myTurn
        ? 'Your turn'
        : `${current?.displayName ?? 'Opponent'} is thinking`
      : view.phase === 'round_result'
        ? 'Round complete'
        : 'Match complete';

  const onTableKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEditable(event.target)) return;
    if (event.key === 'Escape') {
      setSelected(undefined);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const card = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-hand-card]');
    if (!card) return;
    event.preventDefault();
    const enabled = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-hand-card]:not(:disabled)'),
    ];
    const index = enabled.indexOf(card);
    if (index < 0 || enabled.length === 0) return;
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    enabled[(index + delta + enabled.length) % enabled.length]?.focus();
  };

  return (
    <main className="table" onKeyDown={onTableKeyDown}>
      <header className="table-header">
        <span className="eyebrow">TOPTHIS / PRACTICE</span>
        <span className={`connection ${connected ? 'online' : ''}`}>
          <span aria-hidden="true">●</span> {connected ? 'Connected' : 'Connecting'}
        </span>
      </header>
      <div className="sr-only" aria-live="polite">
        {status}. {error}
      </div>
      <section className="opponents" aria-label="Opponents">
        {view.players
          .filter((player) => player.id !== view.yourPlayerId)
          .map((player) => (
            <article
              className={player.id === view.currentPlayerId ? 'active-player' : ''}
              key={player.id}
            >
              <strong>{player.displayName}</strong>
              <span>{player.handCount} cards in hand</span>
              <span>{player.capturedCardCount} captured</span>
            </article>
          ))}
      </section>
      <section className="arena" aria-label="Table challenge">
        <div className="round-status">
          <strong>{status}</strong>
          <span>Leader: {leader?.displayName ?? 'Unknown'}</span>
          <span data-testid="turn-timer">
            {view.phase === 'playing' ? `${seconds}s remaining` : 'Turn ended'}
          </span>
        </div>
        <div className="challenge">
          <p className="challenge-label">TOP THIS</p>
          {view.challengeCard ? (
            <div className={`card challenge-card ${view.challengeCard.rarity}`}>
              <CardFace card={view.challengeCard} />
            </div>
          ) : (
            <span>Waiting for a challenge</span>
          )}
        </div>
        <div className="pile-meter">
          <strong>{view.pileCount}</strong>
          <span>cards in pile</span>
          <small>{view.deckCount} left in deck</small>
        </div>
      </section>
      <section className="your-score" aria-label="Your score">
        <span>You</span>
        <strong>
          {view.players.find((player) => player.id === view.yourPlayerId)?.capturedCardCount ?? 0}{' '}
          captured
        </strong>
      </section>
      <section className="hand" aria-label="Your hand">
        {view.hand.map((card) => {
          const playable = myTurn && legal.has(card.instanceId);
          const reason = myTurn ? 'Cannot beat current card' : 'Wait for your turn';
          const isSelected = selected === card.instanceId;
          return (
            <button
              key={card.instanceId}
              data-hand-card
              className={`card hand-card ${card.rarity} ${isSelected ? 'selected' : ''} ${playable ? 'playable' : 'illegal'}`}
              disabled={!playable}
              aria-pressed={isSelected}
              aria-label={`${card.name}. ${playable ? 'Playable' : reason}`}
              onClick={() => setSelected(card.instanceId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (isSelected) command('play');
                  else setSelected(card.instanceId);
                }
              }}
            >
              <CardFace card={card} />
              <span className="legality">
                <span aria-hidden="true">{playable ? '✓' : '×'}</span>{' '}
                {playable ? 'Playable' : reason}
              </span>
            </button>
          );
        })}
      </section>
      <div className="selection-bar">
        <p>
          {selectedCard ? (
            <>
              Selected: <strong>{selectedCard.name}</strong>
            </>
          ) : (
            'Select a playable card to inspect it.'
          )}
        </p>
        <div className="controls">
          <button
            disabled={!myTurn || !selectedCard || !legal.has(selectedCard.instanceId)}
            onClick={() => command('play')}
          >
            Play Card
          </button>
          <button className="secondary" disabled={!myTurn} onClick={() => command('skip')}>
            Skip
          </button>
        </div>
      </div>
      {error && (
        <p className="table-error" role="alert">
          {error}
        </p>
      )}
      {view.phase !== 'playing' && (
        <div className="overlay-backdrop">
          <section
            className="overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-title"
          >
            <p className="eyebrow">
              {view.phase === 'completed' ? 'MATCH RESULT' : 'ROUND RESULT'}
            </p>
            <h2 id="result-title">
              {view.phase === 'completed'
                ? resultHeading(view)
                : `${roundWinner?.displayName ?? 'A player'} takes the pile`}
            </h2>
            <p>
              {view.roundResult
                ? `${view.roundResult.pileCount} cards captured.`
                : 'The final round is complete.'}
            </p>
            {view.phase === 'round_result' ? (
              <p>Dealing the next challenge…</p>
            ) : (
              <button
                onClick={() => {
                  setView(undefined);
                  setSelected(undefined);
                  setScreen('setup');
                }}
              >
                New practice
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

document.title = 'TopThis — Everything beats something. Top this.';
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

export { App, CardFace, resultHeading };
