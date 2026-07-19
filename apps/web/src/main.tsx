import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
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
  type PracticeLeaveAck,
  PracticeLeaveAckSchema,
  type PracticeMatchView,
  type PrivateMatchAck,
  type PrivateMatchLeaveAck,
  PrivateMatchLeaveAckSchema,
  type PrivateMatchExitAck,
  PrivateMatchExitAckSchema,
  LobbyClosedViewSchema,
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
  | 'landing'
  | 'rules'
  | 'setup'
  | 'identity'
  | 'host'
  | 'join'
  | 'lobby'
  | 'match'
  | 'queue'
  | 'leaderboard';

const initialGuestToken = localStorage.getItem('topthis.guestToken');
const socket = io(import.meta.env.VITE_TOPTHIS_SERVER_URL || undefined, {
  autoConnect: false,
  auth: initialGuestToken ? { guestToken: initialGuestToken } : {},
}) as Socket;

async function connectAuthenticated(token: string): Promise<void> {
  const currentToken =
    typeof socket.auth === 'object' && socket.auth
      ? (socket.auth as { guestToken?: unknown }).guestToken
      : undefined;
  if (socket.connected && currentToken === token) return;
  socket.auth = { guestToken: token };
  if (socket.connected) socket.disconnect();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Authentication timed out.')), 8000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onConnect = () => finish();
    const onError = (reason: unknown) =>
      finish(
        new Error(
          reason instanceof Error ? reason.message : 'Could not authenticate with TopThis Server.',
        ),
      );
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
}

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
          <img src={card.iconPath} alt="" onError={() => setImageFailed(true)} />
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
  const [identityReturnLanding, setIdentityReturnLanding] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [settings, setSettings] = useState({
    playerCount: 2,
    botCount: 0,
    targetScore: 50,
    turnDurationSeconds: 20,
  });
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [now, setNow] = useState(Date.now());
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ queued: false, playersNeeded: 1 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>();
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const audioRef = useRef<AudioContext | undefined>(undefined);
  const lastRoundRef = useRef<string | undefined>(undefined);
  const rulesTriggerRef = useRef<HTMLButtonElement>(null);
  const rulesTitleRef = useRef<HTMLHeadingElement>(null);
  const previousScreenRef = useRef<Screen | undefined>(undefined);
  const exitTriggerRef = useRef<HTMLButtonElement>(null);
  const exitDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen === 'rules') rulesTitleRef.current?.focus();
    else if (screen === 'landing' && previousScreenRef.current === 'rules')
      rulesTriggerRef.current?.focus();
    previousScreenRef.current = screen;
  }, [screen]);
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
      setSettings({
        ...next.settings,
        botCount: (next.settings as typeof next.settings & { botCount?: number }).botCount ?? 0,
      });
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
    const onLobbyClosed = (raw: unknown) => {
      setLobby(undefined);
      setScreen('landing');
      setError(
        LobbyClosedViewSchema.safeParse(raw).success
          ? 'The host closed this lobby.'
          : 'This lobby is no longer available.',
      );
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setError('Could not connect to TopThis Server.');
    socket.on('practice:state', onState);
    socket.on('lobby:state', onLobby);
    socket.on('match:state', onMatch);
    socket.on('queue:status', onQueue);
    socket.on('lobby:closed', onLobbyClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('practice:state', onState);
      socket.off('lobby:state', onLobby);
      socket.off('match:state', onMatch);
      socket.off('queue:status', onQueue);
      socket.off('lobby:closed', onLobbyClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);
  const unlockAudio = () => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioRef.current ??= new Ctx();
      if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    } catch {
      // Audio is optional; gameplay must continue when Web Audio is unavailable.
    }
  };
  useEffect(() => {
    const result = view?.roundResult;
    if (
      !result ||
      view?.phase === 'playing' ||
      lastRoundRef.current === `${view.matchId}:${view.stateVersion}`
    )
      return;
    lastRoundRef.current = `${view.matchId}:${view.stateVersion}`;
    unlockAudio();
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio is decorative; unsupported APIs and autoplay failures are harmless.
    }
  }, [view?.matchId, view?.phase, view?.roundResult, view?.stateVersion]);

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
        void connectAuthenticated(token).catch((reason: unknown) => {
          localStorage.removeItem('topthis.guestToken');
          socket.auth = {};
          setGuest(undefined);
          setError(
            reason instanceof Error
              ? `Saved multiplayer session expired. ${reason.message}`
              : 'Saved multiplayer session expired. Choose a display name to continue.',
          );
          setGuestName('Player');
          setScreen('identity');
        });
      })
      .catch((reason: unknown) => {
        localStorage.removeItem('topthis.guestToken');
        socket.auth = {};
        setGuest(undefined);
        setError(
          reason instanceof Error
            ? `${reason.message} Choose a display name to continue.`
            : 'Could not validate the saved guest session. Choose a display name to continue.',
        );
        setGuestName('Player');
        setScreen('identity');
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
    setGuest(response.guest);
    return response.guest;
  };
  const recoverAuth = () => {
    localStorage.removeItem('topthis.guestToken');
    socket.auth = {};
    socket.disconnect();
    setGuest(undefined);
    setGuestName('Player');
    setPendingQueue(false);
    setError('Your multiplayer session expired. Choose a display name to continue.');
    setScreen('identity');
  };
  const isAuthRequired = (ack: unknown) => {
    const code = (ack as { error?: { code?: unknown } })?.error?.code;
    if (code === 'AUTH_REQUIRED' || code === 'INVALID_GUEST_TOKEN') {
      recoverAuth();
      return true;
    }
    return false;
  };
  const openPrivate = (action: 'host' | 'join') => {
    setError('');
    setPendingAction(action);
    setScreen(guest ? action : 'identity');
  };
  const enterQueue = async (knownGuest?: Guest) => {
    setBusy(true);
    setError('');
    try {
      if (!knownGuest) await ensureGuest();
      await connectAuthenticated(localStorage.getItem('topthis.guestToken')!);
      socket.emit('queue:enter', {}, (raw: QueueAck) => {
        const ack = QueueAckSchema.parse(raw);
        setBusy(false);
        if (ack.ok) {
          setQueueStatus(ack.status);
          // Pairing can emit match:state before this acknowledgement arrives.
          if (ack.status.queued) setScreen('queue');
        } else if (!isAuthRequired(ack)) setError(ack.error.message);
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
      await connectAuthenticated(localStorage.getItem('topthis.guestToken')!);
      socket.emit('lobby:create', { settings }, (ack: LobbyAck) => {
        setBusy(false);
        if (ack.ok) {
          setLobby(ack.view);
          setScreen('lobby');
        } else if (!isAuthRequired(ack)) setError(ack.error.message);
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
      await connectAuthenticated(localStorage.getItem('topthis.guestToken')!);
      socket.emit(
        'lobby:join',
        { code: joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '') },
        (ack: LobbyAck) => {
          setBusy(false);
          if (ack.ok) {
            setLobby(ack.view);
            setScreen('lobby');
          } else if (!isAuthRequired(ack)) setError(ack.error.message);
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
      else if (!isAuthRequired(ack)) setError(ack.error.message);
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
        if (!isAuthRequired(ack)) setError(ack.error.message);
      }
    });
  };

  const command = (type: 'play' | 'skip') => {
    unlockAudio();
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
  const resetMatch = () => {
    setConfirmExit(false);
    setView(undefined);
    setPrivateView(undefined);
    setSelected(undefined);
    setError('');
    setScreen('landing');
  };
  const closeExitConfirmation = () => {
    setConfirmExit(false);
    window.setTimeout(() => exitTriggerRef.current?.focus(), 0);
  };
  const exitMatch = async () => {
    setBusy(true);
    setError('');
    const event = networked ? 'match:exit' : 'practice:leave';
    const raw = await new Promise<unknown>((resolve) => {
      let settled = false;
      const finish = (value: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(undefined), 8000);
      if (networked) socket.emit(event, {}, (ack: PrivateMatchExitAck) => finish(ack));
      else socket.emit(event, {}, (ack: PracticeLeaveAck) => finish(ack));
    });
    if (networked) {
      const ack = PrivateMatchExitAckSchema.safeParse(raw);
      setBusy(false);
      if (ack.success && ack.data.ok) {
        resetMatch();
      } else
        setError(
          ack.success && !ack.data.ok
            ? ack.data.error.message
            : 'Could not leave this match. Try again.',
        );
      return;
    }
    const ack = PracticeLeaveAckSchema.safeParse(raw);
    setBusy(false);
    if (ack.success && ack.data.ok) resetMatch();
    else
      setError(
        ack.success && !ack.data.ok
          ? ack.data.error.message
          : 'Could not close this practice table. Try again.',
      );
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
        <section className="identity-status" aria-label="Multiplayer identity">
          {guest ? (
            <>
              <strong>Playing as {guest.displayName}</strong>
              <span>This saved local guest profile is used for multiplayer.</span>
              <button
                className="link"
                onClick={() => {
                  setGuestName(guest.displayName);
                  localStorage.removeItem('topthis.guestToken');
                  socket.disconnect();
                  socket.auth = {};
                  setGuest(undefined);
                  setIdentityReturnLanding(true);
                  setScreen('identity');
                }}
              >
                Change player
              </button>
            </>
          ) : (
            <span>Multiplayer will create a saved local guest profile with your display name.</span>
          )}
        </section>
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button
            onClick={() => {
              setError('');
              setScreen('setup');
            }}
          >
            Practice
          </button>
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
          <button ref={rulesTriggerRef} className="muted" onClick={() => setScreen('rules')}>
            How to Play
          </button>
        </div>
      </main>
    );
  }

  if (screen === 'rules') {
    return (
      <main className="setup rules-screen" aria-labelledby="rules-title">
        <p className="eyebrow">HOW TO PLAY</p>
        <h1 ref={rulesTitleRef} id="rules-title" tabIndex={-1}>
          Top this.
        </h1>
        <p className="setup-note">
          The last successful play takes the pile. Build your score before the target is reached.
        </p>
        <section>
          <h2>Objective</h2>
          <p>
            Outscore your opponents by capturing piles. Reaching the target ends the match; the
            highest captured-card score wins, and equal highest scores tie.
          </p>
        </section>
        <section>
          <h2>Setup</h2>
          <ol>
            <li>Each player receives a private hand of 10 cards.</li>
            <li>A challenge card starts the pile and turns move clockwise.</li>
            <li>
              Only the server decides the selected 200-card deck, legal plays, scores and timer.
            </li>
          </ol>
        </section>
        <section>
          <h2>Legal plays</h2>
          <p>
            Play a card that beats the current challenge according to its explicit counter
            relationship. Legal cards are enabled and labelled; illegal cards remain visible but
            cannot be confirmed.
          </p>
        </section>
        <section>
          <h2>Skipping and rounds</h2>
          <p>
            If you cannot or do not want to play, choose Skip. A round ends only after every other
            active player has passed since the latest successful play; the last successful player
            captures the pile and hands refill clockwise.
          </p>
        </section>
        <section>
          <h2>Special cards</h2>
          <ul>
            <li>
              <strong>Tornado</strong> is Legendary and beats every ordinary card and Tornado, but
              never Meteor.
            </li>
            <li>
              <strong>Meteor</strong> is one master-pool copy, may be absent or undrawn, beats every
              non-Meteor and cannot be beaten.
            </li>
          </ul>
        </section>
        <section>
          <h2>Scoring, ties and end</h2>
          <p>
            Captured cards score for their owner. The server completes the match when the target is
            reached or the selected 200-card deck can no longer continue. Highest score wins; equal
            highest scores are recorded as a tie.
          </p>
        </section>
        <section>
          <h2>Time and connection</h2>
          <p>
            Each turn has a server deadline. An expired turn becomes an automatic skip. If you leave
            or disconnect, the server removes your seat immediately; if a lobby host leaves, that
            lobby closes for everyone. Opponents never receive your cards or legal moves.
          </p>
        </section>
        <button className="secondary" onClick={() => setScreen('landing')}>
          Return to menu
        </button>
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
              } else if (identityReturnLanding) {
                setIdentityReturnLanding(false);
                setScreen('landing');
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
                onChange={(e) => {
                  const playerCount = Number(e.target.value);
                  setSettings({
                    ...settings,
                    playerCount,
                    botCount: Math.min(settings.botCount, playerCount - 1),
                  });
                }}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Bot seats
              <select
                value={settings.botCount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    botCount: Math.min(Number(e.target.value), settings.playerCount - 1),
                  })
                }
              >
                {Array.from({ length: settings.playerCount }, (_, n) => n).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <small>
                {settings.playerCount - settings.botCount} human{' '}
                {settings.playerCount - settings.botCount === 1 ? 'seat' : 'seats'},{' '}
                {settings.botCount} bot {settings.botCount === 1 ? 'seat' : 'seats'}.
              </small>
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
      lobby.players.length === lobby.settings.playerCount - lobby.settings.botCount &&
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
              {(player as typeof player & { isBot?: boolean }).isBot && <span>Server bot</span>}
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
                    (() => {
                      const playerCount = Number(event.target.value);
                      setSettings({
                        ...settings,
                        playerCount,
                        botCount: Math.min(settings.botCount, playerCount - 1),
                      });
                    })()
                  }
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label>
                Bot seats
                <select
                  value={settings.botCount}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      botCount: Math.min(Number(event.target.value), settings.playerCount - 1),
                    })
                  }
                >
                  {Array.from({ length: settings.playerCount }, (_, count) => count).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ),
                  )}
                </select>
                <small>
                  {settings.playerCount - settings.botCount} human{' '}
                  {settings.playerCount - settings.botCount === 1 ? 'seat' : 'seats'},{' '}
                  {settings.botCount} bot {settings.botCount === 1 ? 'seat' : 'seats'}. All humans
                  must ready up.
                </small>
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
            {[1, 2, 3, 4, 5].map((count) => (
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
  const localPlayer = view.players.find((player) => player.id === view.yourPlayerId);
  const opponents = view.players.filter((player) => player.id !== view.yourPlayerId);
  const winnerSeat =
    view.roundResult?.winnerId === view.yourPlayerId
      ? 'local'
      : `opponent-${Math.max(
          1,
          opponents.findIndex((player) => player.id === view.roundResult?.winnerId) + 1,
        )}`;
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
    <main className="table" data-state-version={view.stateVersion} onKeyDown={onTableKeyDown}>
      {view.phase !== 'completed' && (
        <button
          ref={exitTriggerRef}
          className="match-exit"
          disabled={busy}
          onClick={() => {
            setError('');
            if (networked) setConfirmExit(true);
            else void exitMatch();
          }}
        >
          <span aria-hidden="true">←</span> {busy && !networked ? 'Leaving…' : 'Exit'}
        </button>
      )}
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
      <section className={`tabletop player-count-${view.players.length}`} aria-label="Game table">
        <section className="opponents seats" aria-label="Opponents">
          {opponents.map((player, index) => (
            <article
              className={`seat opponent-seat opponent-${index + 1} ${player.id === view.currentPlayerId ? 'active-player' : ''}`}
              data-seat-position={`opponent-${index + 1}`}
              key={player.id}
            >
              <span
                className="score-badge"
                aria-label={`${player.capturedCardCount} captured cards`}
              >
                {player.capturedCardCount}
              </span>
              <span className="avatar" aria-hidden="true">
                {player.displayName.slice(0, 1).toUpperCase()}
              </span>
              <strong>{player.displayName}</strong>
              {(player as { isBot?: boolean }).isBot && <span>Server bot</span>}
              <span>{player.handCount} cards in hand</span>
              {networked && (
                <span>
                  {player.isBot
                    ? 'Server controlled'
                    : (player as PrivateMatchView['players'][number]).abandoned
                      ? 'Left match'
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
            <div
              className="pile-stack"
              data-layer-count={Math.min(view.pileCount, 10)}
              aria-label={`${view.pileCount} cards in pile`}
            >
              {Array.from({ length: Math.min(view.pileCount, 10) }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      '--pile-x': `${index * 2}px`,
                      '--pile-y': `${-index * 2}px`,
                      '--pile-rotate': `${((index * 17) % 11) - 5}deg`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <p className="challenge-label">TOP THIS</p>
            {view.challengeCard ? (
              <div
                key={view.challengeCard.instanceId}
                className={`card challenge-card ${view.challengeCard.rarity}`}
              >
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
        <article
          className={`seat local-seat ${view.yourPlayerId === view.currentPlayerId ? 'active-player' : ''}`}
          data-seat-position="local"
          aria-label="Your score"
        >
          <span
            className="score-badge"
            aria-label={`${localPlayer?.capturedCardCount ?? 0} captured cards`}
          >
            {localPlayer?.capturedCardCount ?? 0}
          </span>
          <span className="avatar" aria-hidden="true">
            {(localPlayer?.displayName ?? 'Y').slice(0, 1).toUpperCase()}
          </span>
          <strong>{localPlayer?.displayName ?? 'You'} (You)</strong>
          <span>{localPlayer?.handCount ?? view.hand.length} cards in hand</span>
        </article>
        {view.phase === 'round_result' && view.roundResult && (
          <div
            className={`collecting-pile collect-to-${winnerSeat}`}
            data-testid="collecting-pile"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </div>
        )}
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
              data-card-instance-id={card.instanceId}
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
      {error && !confirmExit && (
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
                disabled={busy}
                onClick={async () => {
                  if (networked && view.phase === 'completed') {
                    setBusy(true);
                    try {
                      const released = await new Promise<boolean>((resolve) => {
                        let settled = false;
                        const finish = (value: boolean) => {
                          if (settled) return;
                          settled = true;
                          window.clearTimeout(timeout);
                          resolve(value);
                        };
                        const timeout = window.setTimeout(() => {
                          setError('Could not release the completed match. Please try again.');
                          finish(false);
                        }, 8000);
                        socket.emit('match:leave', {}, (raw: PrivateMatchLeaveAck) => {
                          try {
                            const ack = PrivateMatchLeaveAckSchema.parse(raw);
                            if (!ack.ok) {
                              setError(ack.error.message);
                              finish(false);
                            } else finish(true);
                          } catch {
                            setError('Could not release the completed match. Please try again.');
                            finish(false);
                          }
                        });
                      });
                      if (!released) return;
                    } catch {
                      setError('Could not release the completed match. Please try again.');
                      return;
                    } finally {
                      setBusy(false);
                    }
                  }
                  setView(undefined);
                  setPrivateView(undefined);
                  setSelected(undefined);
                  setMode('practice');
                  setScreen(networked ? 'landing' : 'setup');
                }}
              >
                {busy ? 'Leaving match…' : networked ? 'Return home' : 'New practice'}
              </button>
            )}
          </section>
        </div>
      )}
      {confirmExit && view.phase !== 'completed' && (
        <div className="overlay-backdrop" role="presentation">
          <section
            ref={exitDialogRef}
            className="overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                closeExitConfirmation();
                return;
              }
              if (event.key !== 'Tab') return;
              const buttons = [
                ...exitDialogRef.current!.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)',
                ),
              ];
              if (!buttons.length) return;
              const first = buttons[0]!;
              const last = buttons.at(-1)!;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <h2 id="exit-title">Leave this match?</h2>
            <p id="exit-description">
              You cannot rejoin after exiting. Your seat will be removed from the match.
            </p>
            <div className="controls">
              <button className="secondary" autoFocus onClick={closeExitConfirmation}>
                Cancel
              </button>
              <button disabled={busy} onClick={() => void exitMatch()}>
                {busy ? 'Leaving…' : 'Confirm exit'}
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
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
