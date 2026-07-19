# TopThis

**Everything beats something. Top this.**

TopThis is a local-first strategic card game for two to six players. Every
legal matchup is explicit: rarity changes presentation, never the rules. The
MVP includes server-authoritative practice bots, private lobbies, public
matchmaking, mixed server-bot tables, persisted results, pairwise Elo ratings and a
leaderboard.

## Prerequisites

- Node.js 24
- pnpm 11
- Chromium for Playwright end-to-end tests

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Open `http://127.0.0.1:5173`. On Linux CI, install Chromium and its system
dependencies with `pnpm exec playwright install --with-deps chromium`.

On Windows PowerShell, use `pnpm.cmd` if the execution policy blocks the
unsigned `pnpm.ps1` shim:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec playwright install chromium
pnpm.cmd dev
```

## Playing locally

- **Practice** starts a complete match against one to five server-controlled
  bots.
- **Host Game** and **Join Game** create a private two-to-six-player lobby with
  any mix of human and server-controlled bot seats. Share the six-character
  code, ready every human seat, then let the host start. Mixed-bot games are
  unranked.
- **Find Match** places an authenticated guest into the local two-player FIFO
  queue.
- **Leaderboard** shows persisted rating and win/loss/tie records.
- **How to Play** explains setup, legal counters, rounds, special cards,
  scoring, timeouts, exits and hand privacy.

Each browser profile stores one opaque guest token locally. A newer connection
with the same token safely replaces the older live socket. A real lobby or
active-match disconnect removes that player immediately; if the lobby host
leaves, the lobby closes for everyone. The server never sends one player's
private hand or legal moves to another client.

## Build and test

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:e2e
```

`pnpm test:e2e` starts isolated development servers and uses independent browser
contexts for multiple players. Failure screenshots, traces, videos and console
logs are written under ignored Playwright output directories.

## Production

Build both applications, set production mode, then start the one Node process:

```sh
pnpm build
NODE_ENV=production pnpm --filter @topthis/server start
```

PowerShell equivalent:

```powershell
pnpm.cmd build
$env:NODE_ENV = 'production'
pnpm.cmd --filter @topthis/server start
```

Open `http://127.0.0.1:3000`. The Fastify process serves the compiled React
client, `/health`, `/api/*` and Socket.IO from the same origin. Run `pnpm build`
again whenever client or server code changes.

## Configuration and SQLite

[`.env.example`](.env.example) documents safe local values; it contains no
secret. Export values in the shell or configure them in the process manager:

| Variable                  | Default                 | Purpose                                    |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `PORT`                    | `3000`                  | Production/server HTTP port                |
| `HOST`                    | `0.0.0.0`               | Server listen address                      |
| `TOPTHIS_DATABASE_PATH`   | `data/topthis.sqlite`   | SQLite path, relative to the process cwd   |
| `VITE_TOPTHIS_SERVER_URL` | same origin / dev proxy | Optional Vite build-time Socket/API origin |

SQLite initialization runs ordered, transactional, idempotent migrations at
startup. Existing guest, result and rating data is retained. The default path
is relative to the server process working directory; set an absolute path in a
real deployment and back up the database together with its WAL files.

The MVP is deliberately single-instance. Active lobbies, matchmaking and games
live in process memory. Horizontal scaling would require shared active-match
state and a Socket.IO adapter; it is not implemented here.

## Architecture

- `packages/game-engine` owns pure deterministic rules, seeded deck selection,
  commands, scoring and replay.
- `packages/shared` owns validated public network contracts and recipient-safe
  client views.
- `apps/server` is authoritative for guests, private state, commands, timers,
  bots, lobbies, matchmaking, SQLite, ratings and Socket.IO.
- `apps/web` is the React/Vite client and renders only server-provided public
  state.
- `content/cards.authored.json` is the editable relationship source;
  `content/cards.json` is the explicit resolved runtime catalog.

The full rule and system decisions live in [`docs/GAME_RULES.md`](docs/GAME_RULES.md)
and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Artwork replacement

Card art belongs at `apps/web/public/cards/<definition-id>.png`, for example
`apps/web/public/cards/water.common.png`. Each replacement must be a square
1024x1024 PNG named with the existing definition ID. Do not use copyrighted
commercial card-game artwork.

Missing or invalid artwork never blocks startup, tests, production builds or
play. The client renders a deterministic accessible fallback containing the
card's name, rarity and abstract symbol. After replacing art, run the web tests,
production build and a desktop/mobile visual check. See
[`docs/CARD_CONTENT.md`](docs/CARD_CONTENT.md) for the full content workflow.

## Troubleshooting

- **PowerShell blocks pnpm:** use `pnpm.cmd`.
- **A port is already in use:** stop the conflicting process or set `PORT` for
  the server. Vite development uses `127.0.0.1:5173`.
- **Playwright cannot find Chromium:** run `pnpm exec playwright install
chromium` (or the `pnpm.cmd` equivalent).
- **The production URL returns no client:** run `pnpm build` and ensure
  `NODE_ENV=production` is set before starting the server.
- **SQLite cannot open:** use a writable absolute `TOPTHIS_DATABASE_PATH` and
  ensure its parent directory is writable. Delete only disposable local data;
  migrations are designed to preserve existing records.
- **The development client cannot connect:** confirm the Fastify server is on
  port 3000 and any `VITE_TOPTHIS_SERVER_URL` value matches it.
