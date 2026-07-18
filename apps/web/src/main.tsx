import { StrictMode, useEffect, useState, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import {
  GuestCreateResponseSchema,
  GuestMeResponseSchema,
  type Guest,
  type LobbyLeaveAck,
  type LobbyAck,
  type LobbyView,
  type PracticeAck,
  type PracticeMatchView,
  type PrivateMatchAck,
  type PrivateMatchView,
  type QueueStatus,
  type QueueAck,
  type LeaderboardResponse,
  QueueAckSchema,
  LeaderboardResponseSchema,
} from '@topthis/shared';
import './styles.css';

type Card = PracticeMatchView['hand'][number];
type Screen =
  'landing' | 'setup' | 'identity' | 'host' | 'join' | 'lobby' | 'match' | 'queue' | 'leaderboard';

const socket = io(import.meta.env.VITE_TOPTHIS_SERVER_URL || undefined, {
  autoConnect: false,
  auth: { guestToken: localStorage.getItem('topthis.guestToken') ?? undefined },
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
  const [practiceView, setView] = useState<PracticeMatchView>();
  const [privateView, setPrivateView] = useState<PrivateMatchView>();
  const [guest, setGuest] = useState<Guest>();
  const [lobby, setLobby] = useState<LobbyView>();
  const [mode, setMode] = useState<'practice' | 'private' | 'matchmaking'>('practice');
  const [guestName, setGuestName] = useState('Player');
  const [pendingAction, setPendingAction] = useState<'host' | 'join'>('host');
  const [pendingQueue, setPendingQueue] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [settings, setSettings] = useState({
    playerCount: 2,
    targetScore: 50,
    turnDurationSeconds: 20,
  });
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [now, setNow] = useState(Date.now());
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ queued: false, playersNeeded: 1 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>();
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const networked = mode !== 'practice';
  const view = networked ? privateView : practiceView;

  useEffect(() => {
    const onState = (next: PracticeMatchView) => {
      setView(next);
      setScreen('match');
      setSelected((current) =>
        current && next.legalCardInstanceIds.includes(current) ? current : undefined,
      );
    };
    const onLobby = (next: LobbyView) => {
      setLobby(next);
      setSettings(next.settings);
      setScreen('lobby');
    };
    const onMatch = (next: PrivateMatchView) => {
      setPrivateView(next);
      setMode(next.matchMode);
      setScreen('match');
    };
    const onQueue = (next: QueueStatus) => {
      setQueueStatus(next);
      setScreen((current) => (next.queued ? 'queue' : current === 'queue' ? 'landing' : current));
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setError('Could not connect to TopThis Server.');
    socket.on('practice:state', onState);
    socket.on('lobby:state', onLobby);
    socket.on('match:state', onMatch);
    socket.on('queue:status', onQueue);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('practice:state', onState);
      socket.off('lobby:state', onLobby);
      socket.off('match:state', onMatch);
      socket.off('queue:status', onQueue);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('topthis.guestToken');
    if (!token) return;
    fetch('/api/guests/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error('Saved guest session expired.');
        return r.json();
      })
      .then((v) => {
        const response = GuestMeResponseSchema.parse(v);
        setGuest(response.guest);
        socket.auth = { guestToken: token };
        socket.connect();
      })
      .catch((reason: unknown) => {
        localStorage.removeItem('topthis.guestToken');
        socket.auth = {};
        setGuest(undefined);
        if (reason instanceof TypeError) setError('Could not validate the saved guest session.');
      });
  }, []);

  const ensureGuest = async () => {
    if (guest) return guest;
    const token = localStorage.getItem('topthis.guestToken');
    if (token) {
      try {
        const r = await fetch('/api/guests/me', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const response = GuestMeResponseSchema.parse(await r.json());
          setGuest(response.guest);
          socket.auth = { guestToken: token };
          return response.guest;
        }
      } catch {
        /* The user explicitly continued, so an invalid saved identity may be replaced below. */
      }
      localStorage.removeItem('topthis.guestToken');
      socket.auth = {};
    }
    const r = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: guestName }),
    });
    if (!r.ok) throw new Error('Could not create the guest profile.');
    const response = GuestCreateResponseSchema.parse(await r.json());
    localStorage.setItem('topthis.guestToken', response.token);
    socket.auth = { guestToken: response.token };
    setGuest(response.guest);
    return response.guest;
  };
  const openPrivate = (action: 'host' | 'join') => {
    setPendingAction(action);
    setScreen(guest ? action : 'identity');
  };
  const enterQueue = async (knownGuest?: Guest) => {
    setBusy(true);
    setError('');
    try {
      if (!knownGuest) await ensureGuest();
      socket.auth = { guestToken: localStorage.getItem('topthis.guestToken') };
      socket.connect();
      socket.emit('queue:enter', {}, (raw: QueueAck) => {
        const ack = QueueAckSchema.parse(raw);
        setBusy(false);
        if (ack.ok) {
          setQueueStatus(ack.status);
          // Pairing can emit match:state before this acknowledgement arrives.
          if (ack.status.queued) setScreen('queue');
        } else setError(ack.error.message);
      });
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Could not join matchmaking.');
    }
  };
  const leaveQueue = () =>
    socket.emit('queue:leave', {}, (raw: QueueAck) => {
      const ack = QueueAckSchema.parse(raw);
      if (ack.ok) {
        setQueueStatus(ack.status);
        setScreen('landing');
      } else setError(ack.error.message);
    });
  const loadLeaderboard = async (page = 1) => {
    setLeaderboardLoading(true);
    setLeaderboardError('');
    setScreen('leaderboard');
    try {
      const response = await fetch(`/api/leaderboard?page=${page}&pageSize=20`);
      if (!response.ok) throw new Error('Could not load leaderboard.');
      setLeaderboard(LeaderboardResponseSchema.parse(await response.json()));
    } catch (reason) {
      setLeaderboardError(reason instanceof Error ? reason.message : 'Could not load leaderboard.');
    } finally {
      setLeaderboardLoading(false);
    }
  };
  const createLobby = async () => {
    setBusy(true);
    setError('');
    try {
      await ensureGuest();
      socket.auth = { guestToken: localStorage.getItem('topthis.guestToken') };
      socket.connect();
      socket.emit('lobby:create', { settings }, (ack: LobbyAck) => {
        setBusy(false);
        if (ack.ok) {
          setLobby(ack.view);
          setScreen('lobby');
        } else setError(ack.error.message);
      });
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Could not create the lobby.');
    }
  };
  const joinLobby = async () => {
    setBusy(true);
    setError('');
    try {
      await ensureGuest();
      socket.auth = { guestToken: localStorage.getItem('topthis.guestToken') };
      socket.connect();
      socket.emit(
        'lobby:join',
        { code: joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '') },
        (ack: LobbyAck) => {
          setBusy(false);
          if (ack.ok) {
            setLobby(ack.view);
            setScreen('lobby');
          } else setError(ack.error.message);
        },
      );
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : 'Could not join the lobby.');
    }
  };

  const lobbyAction = (
    event: 'lobby:ready' | 'lobby:settings' | 'lobby:start',
    payload: unknown,
  ) => {
    setError('');
    socket.emit(event, payload, (ack: LobbyAck) => {
      if (ack.ok) setLobby(ack.view);
      else setError(ack.error.message);
    });
  };

  const leaveLobby = () => {
    setError('');
    socket.emit('lobby:leave', {}, (ack: LobbyLeaveAck) => {
      if (ack.ok) {
        setLobby(undefined);
        setScreen('landing');
      } else setError(ack.error.message);
    });
  };

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
    const applyAck = (ack: PracticeAck | PrivateMatchAck) => {
      if (ack.ok) {
        if (networked) setPrivateView(ack.view as PrivateMatchView);
        else setView(ack.view);
      } else {
        if (ack.view) {
          if (networked) setPrivateView(ack.view as PrivateMatchView);
          else setView(ack.view);
        }
        setError(ack.error.message);
      }
    };
    if (networked) {
      socket.emit(`match:${type}`, payload, (ack: PrivateMatchAck) => applyAck(ack));
    } else {
      socket.emit(`practice:${type}`, payload, (ack: PracticeAck) => applyAck(ack));
    }
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
          <button onClick={() => openPrivate('host')}>Host Game</button>
          <button onClick={() => openPrivate('join')}>Join Game</button>
          <button
            onClick={() => {
              if (guest) void enterQueue();
              else {
                setPendingQueue(true);
                setScreen('identity');
              }
            }}
            disabled={busy}
          >
            Find Match
          </button>
          <button onClick={() => void loadLeaderboard()}>Leaderboard</button>
          <button className="muted" disabled>
            How to Play<small>Coming soon</small>
          </button>
        </div>
      </main>
    );
  }

  if (screen === 'queue')
    return (
      <main className="setup queue-screen">
        <p className="eyebrow">MATCHMAKING</p>
        <h1>Finding your match</h1>
        <p aria-live="polite">
          {queueStatus.position
            ? `Position ${queueStatus.position} · ${queueStatus.playersNeeded} more ${queueStatus.playersNeeded === 1 ? 'player' : 'players'} needed`
            : 'Waiting for another player…'}
        </p>
        <button className="secondary" onClick={leaveQueue}>
          Cancel
        </button>
        {error && <p role="alert">{error}</p>}
      </main>
    );

  if (screen === 'leaderboard') {
    const page = leaderboard?.page ?? 1;
    const pageSize = leaderboard?.pageSize ?? 20;
    const total = leaderboard?.total ?? 0;
    return (
      <main className="setup leaderboard-screen">
        <p className="eyebrow">RATINGS</p>
        <h1>Leaderboard</h1>
        {leaderboardLoading && <p role="status">Loading leaderboard…</p>}
        {leaderboardError && <p role="alert">{leaderboardError}</p>}
        {!leaderboardLoading &&
          !leaderboardError &&
          leaderboard &&
          (leaderboard.entries.length ? (
            <>
              <div className="leaderboard-table-scroll">
                <table>
                  <caption className="sr-only">TopThis player ratings</caption>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Rating</th>
                      <th>Games</th>
                      <th>W-L-T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries.map((entry) => (
                      <tr key={entry.guestId}>
                        <td>{entry.rank}</td>
                        <td>{entry.displayName}</td>
                        <td>{entry.rating}</td>
                        <td>{entry.gamesPlayed}</td>
                        <td>
                          {entry.wins}-{entry.losses}-{entry.ties}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className="leaderboard-pages" aria-label="Leaderboard pages">
                <button disabled={page <= 1} onClick={() => void loadLeaderboard(page - 1)}>
                  Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
                </span>
                <button
                  disabled={page * pageSize >= total}
                  onClick={() => void loadLeaderboard(page + 1)}
                >
                  Next
                </button>
              </nav>
            </>
          ) : (
            <p>No completed matches yet.</p>
          ))}
        <button className="link" onClick={() => setScreen('landing')}>
          Back
        </button>
      </main>
    );
  }

  if (screen === 'identity')
    return (
      <main className="setup">
        <p className="eyebrow">GUEST PROFILE</p>
        <h1>Choose a display name</h1>
        <label>
          Display name
          <input value={guestName} maxLength={24} onChange={(e) => setGuestName(e.target.value)} />
        </label>
        <button
          disabled={!guestName.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const identity = await ensureGuest();
              if (pendingQueue) {
                setPendingQueue(false);
                await enterQueue(identity);
              } else setScreen(pendingAction);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Could not create the guest.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Creating guest…' : 'Continue'}
        </button>
        {error && <p role="alert">{error}</p>}
        <button className="link" onClick={() => setScreen('landing')}>
          Back
        </button>
      </main>
    );
  if (screen === 'host' || screen === 'join')
    return (
      <main className="setup">
        <p className="eyebrow">PRIVATE GAME</p>
        <h1>{screen === 'host' ? 'Host a lobby' : 'Join a lobby'}</h1>
        {screen === 'host' ? (
          <>
            <label>
              Players
              <select
                value={settings.playerCount}
                onChange={(e) => setSettings({ ...settings, playerCount: Number(e.target.value) })}
              >
                {[2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Target score
              <input
                type="number"
                min="10"
                max="200"
                value={settings.targetScore}
                onChange={(e) => setSettings({ ...settings, targetScore: Number(e.target.value) })}
              />
            </label>
            <label>
              Turn timer
              <input
                type="number"
                min="5"
                max="60"
                value={settings.turnDurationSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, turnDurationSeconds: Number(e.target.value) })
                }
              />
            </label>
            <button disabled={busy} onClick={createLobby}>
              {busy ? 'Creating lobby…' : 'Create lobby'}
            </button>
          </>
        ) : (
          <>
            <label>
              Join code
              <input
                aria-label="Join code"
                value={joinCode}
                maxLength={6}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
              />
            </label>
            <button disabled={joinCode.length !== 6 || busy} onClick={joinLobby}>
              {busy ? 'Joining…' : 'Join lobby'}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="link" onClick={() => setScreen('landing')}>
          Back
        </button>
      </main>
    );
  if (screen === 'lobby' && lobby) {
    const isHost = guest?.id === lobby.hostGuestId;
    const localPlayer = lobby.players.find((player) => player.guest.id === guest?.id);
    const canStart =
      isHost &&
      lobby.players.length === lobby.settings.playerCount &&
      lobby.players.every((player) => player.ready && player.connected);
    return (
      <main className="setup lobby-screen">
        <p className="eyebrow">PRIVATE LOBBY</p>
        <h1>Code: {lobby.code}</h1>
        <p className="lobby-code-help">Share this six-character code with your table.</p>
        <p aria-live="polite">{connected ? 'Connected' : 'Reconnecting'}</p>
        <ul className="lobby-players" aria-label="Lobby players">
          {lobby.players.map((player) => (
            <li key={player.guest.id}>
              <strong>{player.guest.displayName}</strong>
              {player.guest.id === lobby.hostGuestId && <span>Host</span>}
              <span>{player.ready ? 'Ready' : 'Not ready'}</span>
              <span>{player.connected ? 'Connected' : 'Disconnected'}</span>
            </li>
          ))}
        </ul>
        <section className="lobby-settings" aria-label="Lobby settings">
          <h2>Match settings</h2>
          {isHost ? (
            <>
              <label>
                Players
                <select
                  value={settings.playerCount}
                  onChange={(event) =>
                    setSettings({ ...settings, playerCount: Number(event.target.value) })
                  }
                >
                  {[2, 3, 4].map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label>
                Target score
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={settings.targetScore}
                  onChange={(event) =>
                    setSettings({ ...settings, targetScore: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Turn timer
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={settings.turnDurationSeconds}
                  onChange={(event) =>
                    setSettings({ ...settings, turnDurationSeconds: Number(event.target.value) })
                  }
                />
              </label>
              <button onClick={() => lobbyAction('lobby:settings', { settings })}>
                Update settings
              </button>
            </>
          ) : (
            <p>
              {lobby.settings.playerCount} players · First to {lobby.settings.targetScore} ·{' '}
              {lobby.settings.turnDurationSeconds}s turns
            </p>
          )}
        </section>
        <div className="lobby-actions">
          <button
            onClick={() => lobbyAction('lobby:ready', { ready: !(localPlayer?.ready ?? false) })}
          >
            {localPlayer?.ready ? 'Not ready' : 'Ready up'}
          </button>
          {isHost && (
            <button disabled={!canStart} onClick={() => lobbyAction('lobby:start', {})}>
              Start Match
            </button>
          )}
          <button className="link" onClick={leaveLobby}>
            Leave lobby
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
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
        <span className="eyebrow">
          TOPTHIS /{' '}
          {mode === 'private' ? 'PRIVATE' : mode === 'matchmaking' ? 'MATCHMAKING' : 'PRACTICE'}
        </span>
        <span className={`connection ${connected ? 'online' : ''}`}>
          <span aria-hidden="true">●</span> {connected ? 'Connected' : 'Reconnecting'}
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
              {networked && (
                <span>
                  {(player as PrivateMatchView['players'][number]).abandoned
                    ? 'Abandoned'
                    : (player as PrivateMatchView['players'][number]).connected
                      ? 'Connected'
                      : 'Disconnected'}
                </span>
              )}
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
            {networked && view.phase === 'completed' && privateView?.placements && (
              <p>
                Final place: {privateView.placements.indexOf(privateView.yourPlayerId) + 1} of{' '}
                {privateView.placements.length}
              </p>
            )}
            {view.phase === 'round_result' ? (
              <p>Dealing the next challenge…</p>
            ) : (
              <button
                onClick={() => {
                  setView(undefined);
                  setPrivateView(undefined);
                  setSelected(undefined);
                  setMode('practice');
                  setScreen(networked ? 'landing' : 'setup');
                }}
              >
                {networked ? 'Return home' : 'New practice'}
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
