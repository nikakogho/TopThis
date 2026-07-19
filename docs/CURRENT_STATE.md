# TopThis Current State

TopThis is a strategic multiplayer card game where every card has its own
counters, and the last successful play takes the pile.

## Status

- Active phase: Deployment 1b — Render-ready, awaiting account authorization
- Last completed phase: Enhancement 4 — complete licensed card artwork
- Phase branch: `main`; completed phases are pushed after their passing gate.
- Runtime: Node.js 24.18.0 and pnpm 11.14.0
- Windows note: use `pnpm.cmd` when a local PowerShell execution policy blocks
  the unsigned `pnpm.ps1` shim; root package scripts remain cross-platform.
- External blockers: Render account sign-in/authorization and confirmation of
  the prefilled free Blueprint; no credentials or billing are required by the app.

## Phase 0 delegation ledger

### SOL DECISIONS

- Use a strict TypeScript pnpm workspace with `apps/web`, `apps/server`,
  `packages/game-engine`, and `packages/shared` boundaries.
- Keep the game engine deterministic and dependency-free; network schemas and
  recipient-safe public state belong in `@topthis/shared`.
- Run one Fastify process with Socket.IO; in production it will serve the Vite
  client build, while development may run the Vite and server processes through
  one root command.
- Treat the server as the only authority for identity, hidden hands, commands,
  turns, scoring, timeouts, persistence, and rating application.
- Use Zod at process boundaries. SQLite selection and persistence design are
  deferred to the persistence phase after Node 24 compatibility is verified.
- Use Vitest for package/server tests and Playwright for browser flows. CI will
  execute install, format checking, linting, type checking, tests, and builds.
- The MVP is single-instance. Horizontal scaling is explicitly out of scope and
  would require shared active-match state plus a Socket.IO adapter.

### TERRA TASKS

- Own `packages/shared/**` and `apps/server/**` for Phase 0.
- Implement the initial validated shared schemas and a blank branded
  Fastify/Socket.IO server with a health endpoint and production static-client
  hook consistent with the decided boundaries.
- Add focused tests for shared schemas and server startup/health behavior.
- Do not edit root workspace configuration, `apps/web/**`, documentation, or CI.
- Definition of done: both packages are strict TypeScript, build and typecheck;
  malformed boundary input is rejected; server health tests pass.
- Verification: `pnpm.cmd --filter @topthis/shared test && pnpm.cmd --filter
@topthis/server test` plus filtered type checking.

### LUNA TASKS

- Own root workspace/tooling files, `apps/web/**`, `packages/game-engine/**`
  Phase 0 placeholder only, `.github/workflows/**`, `README.md`, and the Phase 0
  documents other than this ledger.
- Scaffold the pnpm monorepo, strict shared TypeScript settings, ESLint,
  Prettier, Vitest/Playwright configuration, branded blank React client, pure
  game-engine package boundary, root scripts, initial CI, and required docs.
- Do not implement game rules, server behavior, shared schemas, or edit
  `docs/CURRENT_STATE.md`.
- Definition of done: root install and scripts are coherent; the blank TopThis
  client builds and its smoke test passes; all required Phase 0 documents exist
  and accurately describe the decided architecture without claiming later
  features exist.
- Verification: `pnpm.cmd install`, then filtered web/game-engine build, test,
  and typecheck commands; run format checking for owned files.

### TOO SMALL TO DELEGATE

- Record runtime/model/config verification in this ledger.
- Review worker diffs for boundary violations and integration conflicts.
- Apply tiny integration corrections that do not constitute routine feature
  implementation.
- Run the integrated Phase 0 verification matrix, open the blank application in
  the built-in Browser, update worker records, and commit the passing phase.

## Worker records

`worker | task | result | verification`

- `terra_worker | Phase 0 shared schemas and Fastify/Socket.IO server | passed;
one dev-runner correction replaced incompatible native type stripping with
tsx | shared/server tests, typecheck, build, lint, live /health request`
- `luna_worker | Phase 0 workspace, web shell, engine boundary, CI and docs |
passed after correcting pnpm build policy, official branding, artwork docs,
stale E2E copy, IPv4 dev binding and visually observed responsive clipping |
install, filtered tests/build/typecheck, Playwright desktop/mobile smoke`
- `terra_worker | Phase 1 deterministic engine | core implementation retained;
after two attempts still had setup/refill/package and coverage gaps, so Sol
performed the policy-authorized focused takeover | worker 9 tests; integrated
engine 25 tests plus build/typecheck/lint`
- `luna_worker | Phase 1 authored/resolved content and rules docs | resolved
catalog retained; after two attempts authored tag expansion and rule text were
still incomplete, so Sol performed the policy-authorized focused takeover |
independent 23-definition/400-copy resolution check and engine content tests`
- `terra_worker | Phase 2 recipient-safe contracts and authoritative practice
server | passed after a focused hardening pass; all practice state, bot,
timeout and round-advance actions serialize through the engine command path |
3 shared tests, 9 server tests, builds, typecheck and scoped lint`
- `luna_worker | Phase 2 React table, accessibility and Playwright flow | core
screen/CSS work retained, but two attempts stopped after typecheck without the
required unit/E2E coverage and left incorrect fallback/result behavior; Sol
performed the policy-authorized bounded integration takeover | 5 web tests, 2
Playwright flows run repeatedly, build/typecheck/lint/format and Browser checks`
- `terra_worker | Phase 3 guest persistence, private server and integration |
core guest/lobby/match/reconnect implementation retained, but two attempts did
not add the required real multi-client integration matrix; Sol performed the
policy-authorized test and race-hardening takeover | 1 guest repository test, 5
real HTTP/Socket.IO private integration tests, 9 existing server tests, repeated
server tests/build/typecheck/lint`
- `luna_worker | Phase 3 guest/lobby/private React flow | functional UI retained,
but two attempts did not add Phase 3-focused tests; Sol performed the
policy-authorized client test/styling takeover | 10 web tests plus
build/typecheck/lint/format and desktop/mobile Browser checks`
- `terra_worker | Phase 3 three-context Playwright follow-up | full real browser
flow delivered on the second pass; Sol replaced a fixed-attempt Socket.IO race
after repeat verification exposed it | 3 Playwright tests, including complete
three-player match, passed in two consecutive full runs`
- `terra_worker | Phase 4 matchmaking, persistence, Elo and leaderboard server |
passed after a focused integration-test follow-up | 4 shared tests and 20
server tests cover authenticated FIFO pairing, cross-mode guards, privacy,
cleanup, exact-once completion, repository reopen, 2/3/4-player Elo and HTTP
pagination validation`
- `luna_worker | Phase 4 queue and leaderboard React flow | functional screens
retained, but two attempts omitted the required focused behavioral matrix; Sol
performed the policy-authorized bounded test/integration takeover | 16 web tests
plus build/typecheck/lint and desktop/mobile Browser checks`
- `luna_worker | Phase 4 rules, architecture and test documentation | passed |
Prettier and contract-name cross-check`
- `terra_worker | Phase 4 two-context matchmaking Playwright flow | core flow
retained, but two attempts left post-completion timing/reload races; Sol
performed the policy-authorized test takeover | focused flow passed twice and
the full regression suite passed twice consecutively`
- `terra_worker | Phase 5 SQLite migrations and production serving | ordered
migrations/static-route tests passed on the first pass, but the real compiled
Node process exposed missing JSON import attributes; the second pass added
native-ESM coverage and fixed production startup | 23 server tests, build,
typecheck/lint and compiled production HTTP smoke`
- `luna_worker | Phase 5 Rules, accessibility and contributor docs | Rules and
README foundations retained; the first pass omitted focused tests/docs and the
second still left incorrect environment names, focus restoration and formatting
work, so Sol performed the policy-authorized bounded integration takeover | 17
web tests, focused mobile Rules E2E, scoped lint/format and Browser review`

## Phase 0 verification

- Root install, build, unit/integration tests, type checking, linting and
  formatting checks pass.
- `pnpm.cmd dev` starts Vite on `127.0.0.1:5173` and TopThis Server on port
  3000; `/health` returns the validated service response.
- Playwright launches Chromium and passes the landing-page smoke flow.
- Built-in Browser inspection passed at the default desktop viewport and at
  390x844. The first inspection found a clipped oversized headline; the CSS was
  corrected and reverified with all content visible and no horizontal overflow.

## Phase 1 delegation ledger

### SOL DECISIONS

- Commit both `content/cards.authored.json` and the resolved runtime artifact
  `content/cards.json`. Authoring-only tag relationships expand into validated,
  explicit `beatsDefinitionIds`; runtime legality never interprets tags or
  compares rarity.
- Use 23 manageable definitions: all required definitions plus provisional Ice,
  Lightning and Plant. The committed master-pool copy counts total exactly 400,
  with exactly four Tornados and one Meteor.
- Classify Mouse, Cat and Dog as animals; classify those three plus Plant as
  living creatures. Gun therefore resolves against every living-creature ID,
  while every Fire definition resolves against every animal ID.
- Treat input definition order as non-authoritative. Master-pool construction
  sorts by definition ID and assigns deterministic instance IDs of the form
  `<definition-id>#<one-based-copy-number>`.
- Use an engine-owned seeded PRNG and Fisher-Yates shuffle. Match creation builds
  all 400 instances, shuffles once from the match seed, selects the first 200
  without replacement, then uses deterministic random state for leader choice.
- Initial and refill dealing are round-robin. Refill proceeds one card at a time
  clockwise beginning with the round winner until hands reach ten or the deck is
  exhausted; no hidden global randomness or wall-clock time enters the engine.
- The engine owns full secret match state but no recipient serialization. A
  round ends into an explicit `round_result` phase; an internal validated
  `advanceRound` command either starts the next round or completes the match.
- Every state-changing command carries a command ID, match ID, expected state
  version and expected turn ID where applicable. First acceptance wins races;
  duplicate/stale/old-turn commands are deterministic no-ops with typed errors.
- Replay consists of creation input plus the accepted command log. Replaying the
  log must reconstruct an identical deterministic state.

### TERRA TASKS

- Own `packages/game-engine/**` for Phase 1.
- Implement dependency-free strict TypeScript content types/validation and
  authoring resolution, seeded randomization, master-pool/match-deck creation,
  full two-to-four-player match state, play/skip/timeout/advance transitions,
  round scoring/refill/end/ties, idempotency/stale-turn protection, command log
  and replay under the semantics above.
- Add comprehensive Vitest coverage for required relationships and all engine
  completion criteria, importing content artifacts only from tests; production
  engine code must not access the filesystem or depend on React/server/network/
  database/browser/wall-clock/global randomness.
- Do not edit `content/**`, docs, apps, shared, or root tooling except the engine
  package manifest if strictly required. Do not spawn subagents or broaden into
  bots/networking.
- Definition of done: all Phase 1 engine operations are deterministic, all
  specified invalid commands are rejected without mutation, complete rounds and
  matches work for 2/3/4 players, and deterministic replay is byte-equivalent
  under stable serialization.
- Verification: `pnpm.cmd --filter @topthis/game-engine test`, build and
  typecheck, plus `pnpm.cmd lint` scoped to the engine.

### LUNA TASKS

- Own `content/**`, `docs/CARD_CONTENT.md`, `docs/GAME_RULES.md` and content-only
  tests/fixtures if they do not overlap Terra's engine files.
- Create authored and resolved JSON for the 23 decided definitions, including
  exact required Water/Fire and named relationships, tag expansion intent,
  explicit resolved IDs, icon paths and copy counts totaling 400. Document every
  provisional card and matchup, full rules/edge cases, content-resolution
  workflow and validation invariants.
- Do not edit the engine, apps, shared, root tooling, or this current-state file.
  Do not spawn subagents. Coordinate with the committed engine API only through
  data shapes defined in this ledger; do not invent runtime rule semantics.
- Definition of done: JSON is valid and internally consistent; all required
  definitions/fields/relationships exist; Tornado/Meteor and pool totals are
  exact; provisional content is fully documented.
- Verification: a focused Node JSON parse/count/reference script, Prettier check,
  and the engine content tests once available.

### TOO SMALL TO DELEGATE

- Review resolved relationships and copy-count arithmetic against the product
  brief, integrate worker results, and decide any genuine semantic ambiguity.
- Apply tiny package/export/script corrections needed to integrate the two
  non-overlapping contributions.
- Run the complete Phase 1 gate, update worker records and commit/push the
  passing phase. Phase 1 adds no new browser UI, so visual verification remains
  the already-passing Phase 0 shell.

## Phase 1 verification

- The authored 23-definition catalog resolves exactly to the committed explicit
  runtime catalog. The master pool has 400 unique instances, four Tornados and
  one Meteor; fixed seeds cover selected decks with Meteor present and absent.
- Runtime legality is a direct explicit-ID membership check. Exact Water/Fire,
  living-creature, animal, named, provisional, Tornado and Meteor relationships
  are covered without any rarity comparison.
- Deterministic setup, two/three/four-player passes, latest-player round wins,
  pile scoring, refill order, target/deck completion, ties, invalid commands,
  timeout races and byte-equivalent replay are covered by 25 engine tests.
- `@topthis/game-engine` emits importable JavaScript and declarations while
  retaining no runtime dependency, I/O, wall-clock or global-randomness access.
- Full workspace tests, build, type checking, Playwright and formatting pass.
  Lint passes after ignoring transient Playwright artifacts; the initial
  concurrent lint/E2E run exposed and fixed that generated-directory race.

## Phase 2 delegation ledger

### SOL DECISIONS

- Practice mode remains server-authoritative. The web client opens one Socket.IO
  session, requests a practice match and sends only play/skip intentions with
  command ID, match ID, expected version/turn and selected instance ID.
- The server maps each socket to its human player ID, loads the committed card
  catalog, owns full engine state and emits recipient-specific views. Opponents
  expose display name, captured count and hand count only; their cards and legal
  moves never cross the boundary.
- Establish reusable practice/multiplayer contracts now: public player/card/
  match views and validated practice-create/play/skip events live in
  `@topthis/shared`, while secret `MatchState` stays engine/server-only.
- Active matches remain in memory. Each match has a promise-chain command queue
  so human events, bot actions, timeout skips and round advances serialize in a
  single deterministic order before the synchronous engine transition.
- Server wall-clock timers wrap the pure engine. Every new playing turn cancels
  the previous timer, publishes a deadline and submits a normal validated
  timeout command if it expires. A late human/bot/timeout command loses through
  expected-version/turn validation.
- Bots call the same server command path as humans. A seeded bot decision stream
  normally selects the least valuable legal card, sometimes skips, and assigns
  a high conservation cost to Tornado/Meteor. Normal delay is short; injected
  server options make tests immediate without adding engine shortcuts.
- `round_result` is emitted for an overlay, then the server submits the normal
  `advanceRound` command after a short configurable delay. Match completion
  emits the same recipient view with explicit tied winner IDs.
- The browser connects to `VITE_TOPTHIS_SERVER_URL` in development and same
  origin in production. Test-only deterministic seed/target/timing are injected
  through server construction or `TOPTHIS_E2E_*` environment values, never
  trusted from normal client payloads.
- The React shell becomes screen-based without adding a routing framework:
  landing, practice setup and game/final states are sufficient for Phase 2.
  Landing retains all required primary actions; unimplemented later-mode actions
  are visibly marked rather than silently pretending to work.
- Card selection is separate from confirmation. The server-provided legal-ID
  list controls enabled state; keyboard arrows move focus, Enter selects or
  confirms unambiguously, Escape cancels, and shortcuts ignore text inputs.
- Missing `/cards/<id>.png` assets fall back to a deterministic presentational
  card face containing name, rarity, symbol and accessible text. The fallback is
  never game state.

### TERRA TASKS

- First implementation pass owns `packages/shared/**`, `apps/server/**` and the
  functional React files/tests under `apps/web/src/**` except final CSS polish.
- Implement validated recipient-safe contracts, in-memory practice-match
  orchestration, serialized commands, timers, deterministic bots using the
  engine command path, Socket.IO events, privacy/server integration tests and a
  functional landing/setup/table/round/final React flow with selection and
  keyboard behavior.
- May update package manifests, lockfile and Playwright dev-server configuration
  required by owned functionality. Do not implement guest persistence, lobbies,
  matchmaking, ratings or SQLite. Do not change engine rules/content or spawn
  subagents.
- Definition of done: one human can start against one to three bots, see only
  their hand, play/skip through complete rounds, receive timeout skips and finish
  a full match; server tests prove privacy, authority and bot command-path use;
  web unit tests prove screen and selection behavior.
- Verification: filtered shared/server/web tests, builds and typechecks; scoped
  lint; a live Socket practice smoke script.

### LUNA TASKS

- Follow-on pass after Terra's markup/contracts stabilize owns `apps/web/src/**`
  CSS/presentational refinements, accessible fallback-card treatment,
  accessibility cleanup, `apps/web/e2e/**` practice Playwright flow and Phase 2
  visual-regression assertions. Do not change server/engine/shared contracts or
  gameplay semantics.
- Implement all rarity perimeter treatments, selected/playable/illegal states,
  responsive desktop/mobile layouts, visible focus, reduced motion, text/icon
  legality cues, status announcements and deterministic missing-art fallback.
- Add a complete deterministic practice flow that selects then confirms a legal
  card, skips, observes round result and reaches final result. Preserve failure
  artifacts through Playwright configuration without committing generated
  output. Do not spawn subagents.
- Definition of done: automated practice flow passes and the deterministic table
  states are stable enough for built-in Browser inspection on desktop/mobile.
- Verification: web unit/build/typecheck/lint, Playwright practice flow and
  screenshot assertions where deterministic.

### TOO SMALL TO DELEGATE

- Review public/private schemas, timer/queue race handling and bot authority;
  decide any cross-system ambiguity and integrate non-overlapping worker passes.
- Run the full workspace gate, start the real app, inspect every required Phase 2
  card/table/overlay/final state in the built-in Browser, return observed defects
  to the owning worker and reverify.
- Update phase records, commit and push the passing Phase 2 result.

## Phase 2 verification

- Shared contracts validate practice creation and command intentions plus a
  strict recipient-safe public match view. The view contains the local hand and
  legal IDs only; opponents expose display names, hand counts and captured
  counts. Nine server tests cover creation, privacy, malformed/forged commands,
  stale and duplicate input, authority, bot actions, timeouts and round advance.
- Practice orchestration uses one promise-chain queue per match. Human, bot,
  timeout and delayed round-advance actions all submit normal versioned engine
  commands, and every accepted transition reschedules exactly one turn path.
- The React flow covers branded landing, practice setup, live table, explicit
  Playable/Cannot beat states, separate select/confirm, arrow/Enter/Escape
  operation, connection/status announcements, deterministic missing-art
  fallbacks, round overlay and victory/defeat/tie-aware final results.
- Five focused web tests pass. The deterministic Playwright flow starts the real
  Fastify/Socket.IO and Vite processes, proves opponent privacy, selects and
  confirms a legal card, observes a bot move, skips, sees a three-card round
  result and reaches the final result. A table screenshot baseline uses a
  20-pixel anti-aliasing tolerance and passed on consecutive independent runs.
- Built-in Browser inspection passed for landing, setup, a real table, legal
  Common/Rare/Epic/Legendary cards, illegal disabled cards, selected Legendary,
  round and final overlays, desktop and 390x844 mobile. One observed laptop
  issue placed confirmation below the initial hand; controls were moved above
  the hand and reverified. Mobile document width remained exactly contained and
  the hand scrolled independently.
- Full workspace formatting, lint, typecheck, tests and build pass. Playwright
  retains screenshot, trace, video and browser-console evidence on failure.

## Phase 3 delegation ledger

### SOL DECISIONS

- Use `better-sqlite3` 12.x for the local MVP database. Its maintained 12.x
  line explicitly supports Node 24 and prebuilt Windows binaries. Phase 3
  introduces only guest identity tables; match/rating persistence follows in
  Phase 4 through the same database boundary.
- The server issues 32-byte random base64url guest tokens and stores only their
  SHA-256 hashes. `POST /api/guests` creates a sanitized display name and opaque
  guest ID; authenticated HTTP and multiplayer sockets accept the token, never
  a client-supplied player ID. The browser stores the token locally for this
  anonymous local MVP.
- Keep lobbies and active matches in memory. Six-character codes use an
  unambiguous uppercase alphabet and are unique among live lobbies. Codes are
  normalized on input and are not authentication credentials.
- Lobby settings are player count 2-4, target score 10-200 and turn duration
  5-60 seconds. Only the host may update settings or start. Every occupied seat,
  including the host, must be ready and the lobby must contain exactly its
  configured player count before start.
- Bind one guest to at most one live lobby/match and one active socket. A newer
  authenticated connection replaces the older socket. Lobby disconnects hold a
  seat for the 60-second grace period, then remove it before match start.
- An active match preserves its engine player forever; reconnecting with the
  same token inside the grace period reclaims the same private hand and receives
  a current recipient view. A disconnected turn still expires through the
  normal timeout command. After grace expiry the seat becomes abandoned and
  continues to auto-skip so the remaining players can complete the match.
- Each active private match owns one serialized command queue and timer set.
  Every play, skip and timeout includes command/match/version/turn identity and
  uses the existing deterministic engine. Public broadcasts are materialized
  separately per recipient so hands and legal IDs never cross seats.
- Completion remains in memory in Phase 3. Phase 4 will transactionally persist
  the result and apply Elo exactly once; Phase 3 must expose a stable match ID,
  ordered public placements/winners and command log to that future boundary.
- Extend shared Zod schemas with guest/lobby/authenticated-match event contracts
  only. Full engine state, token hashes, raw tokens, socket maps, timers and
  command queues remain server-only.
- Reuse the Phase 2 table presentation for private matches. Guest setup precedes
  Host/Join, lobby screens expose host/settings/ready/connectivity, and a
  reconnecting client visibly reports its state without revealing opponents.

### TERRA TASKS

- First pass owns `packages/shared/**`, `apps/server/**`, server package/lock
  dependencies and server-focused tests for Phase 3.
- Implement the SQLite guest repository/migration, token hashing and guest HTTP
  routes; authenticated Socket.IO handshake; in-memory lobby lifecycle,
  authorization/settings/readiness; private match start and per-recipient
  serialization; queued versioned play/skip/timeout; disconnect grace,
  reconnection and abandoned-seat auto-skip.
- Preserve working practice behavior and avoid changing deterministic engine
  semantics or content. Do not implement ratings, leaderboard, matchmaking, UI,
  Phase 4 result persistence or spawn subagents.
- Definition of done: guest tokens survive server repository reopen; three
  authenticated sockets can create/join/ready/start; each receives only its own
  hand/legal IDs; forged/stale/duplicate/unauthenticated actions fail; timeout,
  disconnect and same-token reconnect work; completed view is usable by Phase 4.
- Verification: filtered shared/server builds, typechecks and tests, scoped lint,
  plus a live three-client Socket.IO smoke script using an in-memory database.
- Follow-up after the UI stabilizes owns `apps/web/e2e/**` private multiplayer
  Playwright coverage and any localized server bug found by that flow.

### LUNA TASKS

- Follow-on after Terra stabilizes contracts owns `apps/web/src/**` guest,
  host/join lobby and private-table UI plus focused web tests and CSS refinements.
- Implement token persistence, guest setup, lobby code/settings/ready/start
  controls with host-only states, connection/reconnection messaging and reuse of
  the existing accessible card/table/result components without duplicating
  shared contracts.
- Do not edit server/shared/engine/content, invent event semantics, add auth
  providers or spawn subagents.
- Definition of done: the landing actions work; anonymous identity persists on
  refresh; host and join screens reflect authorization/readiness/connectivity;
  private match uses the existing legal/illegal/select-confirm table behavior;
  focused web tests pass at desktop and mobile widths.
- Verification: filtered web tests/build/typecheck, scoped lint and a live
  two-tab manual socket/UI smoke before Terra's isolated-context Playwright pass.

### TOO SMALL TO DELEGATE

- Review token storage, SQLite lifecycle, lobby authorization, recipient-safe
  serialization and reconnect/timer race behavior.
- Apply tiny integration/config corrections, update worker records, run the full
  gate, inspect the private lobby/table in Browser, commit and push Phase 3.

## Phase 3 verification

- Guest tokens are 32 random bytes encoded as base64url; SQLite stores only a
  SHA-256 hash. Repository reopen preserves guest identity, invalid tokens are
  rejected, HTTP boundary validation returns 400, and authenticated identity
  never accepts a client player ID.
- Five real multi-client server tests cover guest HTTP auth, lobby code and host
  authorization, ready/start, host transfer and cleanup, three recipient-safe
  hands, forged/stale/duplicate actions, normal timeouts, exact-hand reconnect,
  expired reconnect, abandoned auto-skip and match completion/placements.
- Private lobby and active-match state are server-authoritative and in memory.
  Each match serializes commands, timers and round advancement; opening and
  subsequent views carry an authoritative deadline, and a newer token-authenticated
  socket safely replaces a stale socket without surrendering the seat.
- Ten React tests cover practice plus token resume/expiry, anonymous guest
  creation, host/join code flows, host-only settings, ready/start gating, leave
  acknowledgement, public opponent state and private play/skip events.
- The real Playwright suite uses three isolated browser contexts to create and
  join a lobby, gate start on readiness, inspect recipient-local hands, take a
  legal action, reload with the same token and exact hand, observe a server
  timeout, drive accelerated rounds through the UI and verify all three final
  placements. All three Playwright tests passed in two consecutive full runs.
- Built-in Browser inspection passed for the private lobby at 1280x720 and
  390x844. The mobile layout stacks settings, keeps status text and actions
  readable, and has no horizontal overflow. A suspicious full-page capture was
  checked against element bounds and a normal viewport capture and confirmed to
  be a capture artifact rather than clipping.
- Full workspace build, type checking, unit/integration tests and lint pass.
  Formatting passes after generated Playwright failure artifacts are excluded by
  the existing ignore rules.

## Phase 4 delegation ledger

### SOL DECISIONS

- Reuse the private authoritative match runner for public matches. Matchmaking
  adds no second rules path: matched players receive the same per-recipient
  state, command queue, timeout, reconnect and abandonment behavior.
- Use a deterministic local FIFO queue with two-player matches. An authenticated
  guest may occupy only one queue/lobby/match; the first two connected queued
  guests are paired with default 50-point/20-second settings. Existing injected
  test target/timing options accelerate E2E without trusting client settings.
- Queue events are `queue:enter`, `queue:leave` and `queue:status`. Status exposes
  only queued/position/players-needed public data. A successful pairing emits
  each recipient's normal `match:state`; no opponent token or private hand enters
  the queue contract.
- Extend the existing SQLite repository rather than create a second connection.
  Migrations add rating/stat columns to guests plus `completed_matches` and
  `completed_match_players`. Store the mode, completion time, seed, final scores,
  winner/tie outcome, rating before/after and serialized accepted command log.
- New guests begin at rating 1000. For an N-player result, compare every pair
  using standard Elo expectation and actual 1/0/0.5 by final score, scale each
  comparison by K=24 divided by N-1, sum per player and apply deterministic
  zero-sum integer rounding. Unique first place records a win; tied first places
  record ties; all lower places record losses.
- Apply completion in one synchronous SQLite transaction keyed by match ID.
  Inserting an already-completed ID returns the stored result without updating
  ratings or counters again. The match runner guards its completion callback as
  well, but database idempotency is the trust boundary.
- Expose `GET /api/leaderboard?page=1&pageSize=20`, with page >=1 and page size
  1-100. Sort by rating descending, wins descending, games played ascending,
  display name then guest ID for stable pagination. Return total, page metadata
  and explicit rank.
- The client enables Find Match and Leaderboard. Queue cancellation is explicit;
  pairing reuses the existing table/final flow. The leaderboard uses semantic
  tabular markup, empty/loading/error states and bounded previous/next controls.

### TERRA TASKS

- Own `apps/server/**`, `packages/shared/**` and necessary server tests for Phase 4. Refactor the private service only enough to share its active-match runner;
  implement FIFO matchmaking, queue authorization/status/cleanup/reconnect,
  SQLite migrations and transactional exactly-once match persistence, pairwise
  Elo/stat updates, leaderboard pagination and completion integration.
- Preserve guest-token hashing, private lobby/practice behavior, deterministic
  engine semantics and recipient privacy. Do not add a second gameplay engine,
  distributed queue, client-authored ratings, UI or Phase 5 work. Do not spawn
  subagents and do not revert concurrent web edits.
- Definition of done: real authenticated sockets pair from the queue and complete
  through normal commands; leave/disconnect/stale membership is safe; results
  survive repository reopen; exact duplicate completion is a no-op; 2/3/4-player
  Elo is deterministic/zero-sum and handles ties; leaderboard ordering and
  pagination are validated; all Phase 2/3 tests remain green.
- Verification: `pnpm.cmd --filter @topthis/shared test && pnpm.cmd --filter
@topthis/server test`, filtered build/typecheck, and root ESLint scoped to owned
  files.
- Follow-up after server/web integration owns `apps/web/e2e/matchmaking.spec.ts`
  and narrowly necessary `playwright.config.ts` changes. Use two isolated browser
  contexts to queue, pair, complete an accelerated real match, inspect changed
  leaderboard ratings/order, refresh and verify persistence; retain console/error
  evidence and preserve all earlier E2E flows. Verification is two consecutive
  full `pnpm.cmd exec playwright test --workers=1` runs.

### LUNA TASKS

- Own `apps/web/src/**` for Phase 4 after using the agreed queue/leaderboard
  contracts above. Enable Find Match and Leaderboard; add guest-first queue entry,
  queued/cancel/matched states, reuse the private table, and build an accessible
  paginated leaderboard with loading/empty/error states plus focused tests and
  responsive CSS.
- Do not edit server/shared/engine/content/Playwright, invent rating logic, expose
  tokens, duplicate the table or spawn subagents. Preserve concurrent server
  edits and all practice/private behavior.
- Definition of done: authenticated guests can enter/leave queue; match state
  opens the existing table; leaderboard fetch/render/pagination works; focused
  tests cover queue status/cancel, match transition, rating rows, empty/error and
  pagination; desktop/mobile remain contained.
- Verification: `pnpm.cmd --filter @topthis/web test`, build/typecheck and root
  ESLint scoped to web source files.
- Follow-on documentation pass owns the Phase 4 additions to
  `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md` and `docs/TEST_PLAN.md`: document
  FIFO matchmaking, the exact pairwise Elo/rounding/outcome rules, transaction
  and table boundaries, leaderboard pagination/order, and concrete automated
  coverage without claiming checks that have not passed. Verification is
  Prettier on those three files and cross-checking names against shared schemas.

### TOO SMALL TO DELEGATE

- Review the shared match-runner refactor, pairwise Elo arithmetic/rounding,
  migration idempotency and completion transaction boundaries.
- Integrate queue UI/contracts, review the delegated matchmaking/leaderboard
  multi-context Playwright flow, run Browser inspection, full gate, phase record,
  commit and push.

## Phase 4 verification

- Four shared contract tests validate queue acknowledgement/status and bounded
  leaderboard responses. Twenty server tests cover authenticated FIFO pairing,
  leave/disconnect cleanup, cross-mode exclusion, per-recipient hands, normal
  timeout completion, exactly-once persistence and stable leaderboard HTTP
  validation alongside every earlier practice/private integration test.
- SQLite migrations preserve existing guest identities and add rating/stat and
  completed-match history. Completion is one match-ID-keyed transaction;
  duplicate completion returns stored results without incrementing counters.
  Seed, scores, placement/outcome, rating before/after and the accepted command
  log are retained per completed match.
- Pairwise K=24 Elo uses actual 1/0/0.5 by final score and deterministic
  largest-remainder integer rounding. Covered two-, three- and four-player
  results remain zero-sum; unique first is a win, tied first is a tie, and all
  lower placements are losses.
- Sixteen React tests cover guest-first queue entry, cancellation, false-status
  races after pairing, table transition, leaderboard loading/rows/pagination,
  empty and error states. The semantic table is horizontally contained at small
  widths and retains bounded previous/next controls.
- The two-context Playwright flow queues authenticated guests, checks private
  hands, takes legal and skip actions through a real completed match, asserts
  final placements, changed zero-sum ratings and win/loss records, then reloads
  into the authoritative completed match and reopens the persisted leaderboard.
  The focused flow and full four-test regression suite each passed twice.
- Built-in Browser inspection passed for the live queue at desktop and 390x844
  responsive widths and for the populated semantic leaderboard at desktop.
- Full workspace tests, build, strict type checking, lint and formatting pass.

## Phase 5 delegation ledger

### SOL DECISIONS

- Keep one deployable Node process. `pnpm build` produces the Vite client and
  compiled server; `pnpm --filter @topthis/server start` serves that client,
  HTTP APIs and Socket.IO from the same origin in production.
- Keep the screen-based React shell for the Rules view; adding a routing library
  would add no MVP value. How to Play becomes a real keyboard-accessible landing
  action and the rules content mirrors the authoritative documented semantics.
- Formalize SQLite initialization as ordered, idempotent schema migrations with
  a durable version marker. Existing Phase 3/4 databases must upgrade without
  losing guest, rating or completed-match data; initialization failure must stop
  startup rather than produce a partially usable service.
- The existing Fastify JSON logger is the structured production log boundary.
  Startup, requests, missing-client-build fallback and graceful shutdown remain
  logged without tokens, hands or secrets. `/health` remains dependency-light
  and must respond before static routing can mask it.
- CI retains frozen install, formatting, lint, strict type checking, unit/
  integration tests, production build and Chromium E2E on Node 24/pnpm 11.
- Final verification uses a clean local clone with frozen install, build, tests
  and production-server HTTP smoke; generated dependencies, databases and test
  artifacts remain ignored and are never copied back.

### TERRA TASKS

- Own `apps/server/src/guests.ts`, `apps/server/src/guests.test.ts`,
  `apps/server/src/server.ts`, `apps/server/src/server.test.ts` and narrowly
  necessary server package configuration for Phase 5 operations.
- Replace ad-hoc schema initialization with ordered, transactionally applied,
  idempotent SQLite migrations/versioning that upgrades a Phase 3-style guests
  database and a Phase 4 database without data loss. Preserve all current
  repository behavior, exactly-once completion and Node 24 compatibility.
- Harden and test production static serving from an injected Vite-like build:
  root/index and hashed asset requests work while `/health`, `/api/*` and
  Socket.IO remain authoritative and missing build output is logged/nonfatal.
  Do not add containers, external databases, distributed infrastructure or UI.
- Do not edit web, shared/engine/content, root docs/README/CI, this ledger or
  spawn subagents. Do not revert concurrent changes.
- Definition of done: old databases migrate to the current schema exactly once;
  reopen is harmless and preserves data; a production-configured server serves
  the client and APIs with no secret logging; all prior server tests pass.
- Verification: `pnpm.cmd --filter @topthis/server test`, filtered build and
  typecheck, and root ESLint scoped to owned server files.

### LUNA TASKS

- Own `apps/web/src/**`, focused `apps/web/e2e/**`, `README.md`, `.env.example`,
  `docs/CARD_CONTENT.md`, `docs/TEST_PLAN.md` and CSS/documentation polish for
  Phase 5. Do not edit server/shared/engine/content/root package/lock/CI or this
  current-state file; do not spawn subagents or revert concurrent changes.
- Enable How to Play as a real Rules screen covering objective, setup, legal
  plays, skipping/rounds, Tornado/Meteor, scoring/end/ties, turn timeout,
  reconnection and private-hand privacy. Use semantic headings/lists, a clear
  return action, visible focus, responsive containment and reduced-motion-safe
  presentation. Preserve complete keyboard card operation and every game mode.
- Expand focused React/Playwright coverage for the rules action and desktop/
  mobile containment. Audit accessible names, landmark/headline structure,
  loading/status/error announcements and color-independent legality without
  changing game semantics.
- Replace the stale README with complete Node/pnpm prerequisites, Windows and
  POSIX install/dev/build/test commands, local gameplay usage, production start,
  environment variables, SQLite location, single-instance limit, architecture,
  artwork replacement/fallback and troubleshooting. Add a safe `.env.example`
  containing no secrets and keep artwork dimensions/naming/workflow exact.
- Definition of done: every landing action is functional; Rules is usable by
  keyboard and at 390px; web regressions pass; a new contributor can install,
  develop, test and run production solely from committed instructions.
- Verification: `pnpm.cmd --filter @topthis/web test`, build/typecheck, root
  ESLint scoped to web/E2E, Prettier for owned docs, and the focused Playwright
  rules/mobile flow.

### TOO SMALL TO DELEGATE

- Review migration rollback/version semantics, static/API route precedence,
  logging privacy, Rules accuracy and final accessibility behavior.
- Review and, only if necessary, minimally harden CI; run a clean-clone frozen
  install/build/test and production same-origin smoke on Windows.
- Run the full gate and repeated Playwright regression, inspect final desktop
  and mobile landing/Rules/game/leaderboard states in the built-in Browser,
  update this record, commit and push the passing release.

## Phase 5 verification

- Four ordered immediate SQLite migrations are recorded only after successful
  application. Tests create representative Phase 3 and Phase 4 databases,
  preserve guest/rating/history data, reopen harmlessly and prove duplicate
  completion still applies no second rating/stat update.
- A production-configured Fastify test serves injected index/hashed assets while
  health, API and Socket.IO remain authoritative. Native Node 24 ESM imports of
  both server-owned match services are part of the server test command, guarding
  the JSON import attributes that the development/Vitest loaders had masked.
- How to Play is a complete semantic Rules screen with accurate explicit-counter,
  pass/round, Tornado/Meteor, score/end/tie, timeout, reconnect and privacy
  guidance. Keyboard entry focuses the Rules heading and returning restores the
  trigger; mobile containment, visible focus and reduced-motion behavior pass.
- The production document has language, viewport, theme, description and
  branded-favicon metadata. The README and safe environment template cover
  Windows/POSIX setup, every root gate, local modes, production start, exact
  environment names, SQLite/migrations, single-instance operation, architecture,
  artwork replacement/fallback and troubleshooting.
- The final workspace has 69 passing unit/integration tests: 25 engine, 4 shared,
  23 server and 17 web. Production build, strict type checking, ESLint and
  Prettier pass. All five Playwright flows pass in two consecutive full runs,
  including practice, private multiplayer/reconnect, public matchmaking/rating
  persistence, mobile landing and mobile Rules/focus.
- Built-in Browser inspection of the compiled production process passed for the
  landing and Rules screens at desktop and 390x844 widths. Earlier phase checks
  cover live table/card/result, private lobby, queue and leaderboard states.
- A detached candidate was checked out through a real no-checkout local clone on
  Windows. Frozen `pnpm install`, tests/native ESM smoke, typecheck, lint, format,
  root `pnpm dev`, and compiled production start all passed. The production root,
  health, leaderboard and favicon returned 200. This check found and fixed the
  repository's missing LF checkout policy before release.
- CI already performs frozen install, formatting, lint, typecheck, tests/build,
  Chromium installation and all Playwright flows on Node 24 with pnpm 11.

## Remaining non-blocking limitations

- The local MVP is intentionally single-instance. A process restart preserves
  guests, completed matches, ratings and leaderboard data but discards active
  queues, lobbies and matches; horizontal scaling requires shared live state and
  a Socket.IO adapter.
- Identity is anonymous and device-local rather than account based. Supplying
  original 1024x1024 card artwork remains optional; the complete accessible
  deterministic fallback is the shipped presentation until it is replaced.

## Enhancement 1 delegation ledger

### SOL DECISIONS

- Preserve the deterministic engine rules, 400-card master pool, seeded
  200-card match deck, explicit-ID legality and server authority. Longer rounds
  come from a denser, still data-driven matchup graph and redistributed copy
  counts, never a rarity comparison or a client-only rule.
- The measured baseline uses an always-play-first-legal deterministic policy
  over 200 seeds for each player count. Across 40,854 rounds it averages 2.56
  cards overall (two-player 1.88), with only 14.2% reaching five cards. This is
  the regression baseline the enhancement must materially beat.
- Add five intuitive definitions: Rock Common (12 copies), Paper Common (12),
  Scissors Rare (10), Sponge Common (10) and Magnet Rare (8). Redistribute their
  52 copies from Water Common -6, Fire Common -6, Water Rare -4, Fire Rare -4,
  Rust -4, Dirt -6, Mouse/Cat/Dog -4 each, Cloud -4, Sun -2, Gun -2 and Plant
  -2, preserving exactly 400 master-pool instances.
- Use the approved natural counter graph: Rock smashes Scissors, animals,
  weapons, magnets and Fire; Paper covers Rock and obstructs Sun, Cloud, Dirt
  and Gun; Scissors cuts Paper, Plant, Sponge, Mouse and Cloud; Sponge absorbs
  Water/Sea/Cloud and collects Dirt; Magnet diverts Gun, Rocket, Lightning,
  Scissors and Rust. Existing families gain reciprocal natural answers: Water
  erodes Rock/soaks Paper; Fire burns Paper/Plant and dries Sponge/melts Ice;
  Rust ruins Magnet/Scissors; Dirt clogs Sponge/buries Magnet/soils Paper;
  animals damage Paper/Sponge with the documented Cat/Dog variations; Cloud
  smothers Fire and blocks Rocket; Sun disperses Cloud/melts Ice/dries Sponge;
  Rocket blasts Rock/Paper/Plant/Sponge/Ice; Sea overwhelms Fire/Rock/Dirt/
  Plant/Magnet/Gun; Ice freezes Water/Sea/Plant/Sponge; Lightning overloads
  Magnet/Gun/Rocket/Plant/Scissors/Sponge; Plant cracks Rock and grows through
  Paper/Sponge/Magnet. Tornado and Meteor extend their existing invariants to
  every new definition.
- The deterministic balance check must retain exactly 400 copies and pass, over
  at least 40 seeds per 2/3/4-player mode: overall mean pile >=5.0, overall
  median >=4, at least 40% of rounds reaching five cards, and two-player mean
  > =3.4. A final 200-seed run records stronger release evidence.
- Present the game as an oval felt table with the local player at the bottom and
  one-to-three opponents arranged around the other seats. Every seat has an
  avatar/name and captured-card score badge physically above the avatar.
- The center pile is a visible layered stack whose thickness grows with
  `pileCount`; a new challenge animates onto it. During `round_result`, a
  decorative stack travels from the center to the authoritative winner seat.
  Recipient-safe contracts need no extra card identities because only stack
  size and the public top card are required.
- At desktop widths the local hand is a five-column by two-row grid so all ten
  cards are present together with no horizontal scroll. Narrow layouts remain
  contained and use additional rows rather than horizontal hand scrolling.
- Generate a quiet, short Web Audio cue locally when a round result first
  arrives. Unlock audio from Play/Skip interaction, expose an accessible sound
  on/off control, avoid external/copyrighted assets, and never let audio failure
  affect gameplay. Reduced-motion preference disables movement animations.

### TERRA TASKS

- Own `content/**`, `packages/game-engine/**`, a reproducible root balance-check
  script and narrowly necessary root package script/docs for Enhancement 1.
  Implement exactly the five definitions, copy redistribution and approved
  relationship families above in authored and resolved artifacts.
- Add deterministic catalog tests for every new relationship, all reciprocal
  additions, special-card invariants, copy totals and authored/resolved parity.
  Add a reproducible balance analyzer using the real engine and an always-play-
  first-legal policy; it must enforce the decided thresholds and report per
  player-count mean/median/p75/p90 and five/eight-card rates.
- Do not change command/round/scoring semantics, apps, shared public contracts,
  server behavior, UI, CI or this ledger. Do not introduce generic rarity/tag
  legality at runtime or spawn subagents. Preserve concurrent web changes.
- Definition of done: the catalog stays valid and exact; all old/new named
  rules pass; balance thresholds pass deterministically; engine replay and all
  earlier tests remain green; content documentation explains every new card and
  copy change.
- Verification: filtered engine build/test/typecheck, root lint/format on owned
  files, default balance check (>=40 seeds per player count) and a reported
  200-seed release analysis.

### LUNA TASKS

- Own `apps/web/src/**`, focused `apps/web/e2e/**` and the practice-table
  screenshot for Enhancement 1. Recompose the existing accessible table markup
  and CSS into an oval seated-table layout without duplicating gameplay state or
  changing network contracts.
- Render all player seats with score badges above avatars, a center stacked pile
  that grows from `pileCount`, play-in motion keyed by the challenge instance,
  and result collection motion aimed at the winner seat. Keep status, deck,
  leader, turn, privacy, connection and result information accessible.
- Replace horizontal hand scrolling with a desktop five-column/two-row grid and
  contained narrow grids. Preserve legal/illegal/selected cues, arrow/Enter/
  Escape operation, visible focus, card confirmation and every existing mode.
- Add a resilient quiet Web Audio round-win cue, user-interaction unlock and an
  accessible sound toggle. Play at most once for an authoritative round result;
  swallow unsupported/autoplay failures and keep tests deterministic.
- Add focused React tests for seats/scores, pile layer growth, winner collection
  target, two-row hand markup and single sound trigger. Extend Playwright to
  prove ten cards occupy two rows without horizontal hand overflow and update
  the reviewed screenshot. Do not edit engine/content/server/shared/root/docs,
  spawn subagents or revert concurrent work.
- Definition of done: a live 2/3/4-player state reads as people around a table;
  scores sit above heads; the stack visibly grows and collects to the winner;
  ten local cards appear together in two desktop rows; the cue/toggle works;
  desktop/mobile remain contained and all web regressions pass.
- Verification: web test/build/typecheck, scoped lint/format, focused and full
  Playwright flows, and screenshot comparison at desktop plus 390x844.

### TOO SMALL TO DELEGATE

- Review the final graph against the approved semantic families and independently
  rerun the 200-seed balance analysis; reject threshold gaming or runtime rule
  changes.
- Integrate seat geometry, animation targeting, audio lifecycle and existing
  public-state semantics; apply only narrow cross-worker corrections after the
  delegated passes.
- Inspect live two-, three- and four-player tables, play/collection transitions,
  the two-row ten-card hand and mobile containment in the built-in Browser; run
  the complete gate, update records, commit and push the passing enhancement.

## Enhancement 1 completion record

### Delegated implementation

- Terra owned the content and deterministic balance scope. The first pass added
  five definitions, all approved explicit relationships, exact 400-copy parity,
  Tornado/Meteor invariants, 25 passing engine tests, content documentation and
  the reproducible `balance:check` release analyzer. No engine command, scoring
  or round-transition semantics changed.
- Luna owned the initial React/CSS pass. Two attempts delivered the component
  behavior and 20 passing web tests but did not deliver the required Playwright
  geometry/screenshot work; the first layout also left seats outside the table
  and represented collection on the dialog rather than with a moving stack.
  After the two incomplete attempts, Sol took over the narrowly remaining work
  as permitted by the operating instructions.
- Sol integrated all seats into one oval table, targeted a real decorative pile
  stack to the authoritative winner seat, tightened the once-per-result Web
  Audio lifecycle, added audio/seat/stack component coverage, and added desktop,
  two-/three-/four-player and mobile Playwright geometry checks.

### Release evidence

- The independent 200-seed-per-player-count analyzer covered 18,889 rounds.
  Overall pile length is mean 5.53, median 4, p75 8 and p90 12; 45.4% reach five
  cards and 25.0% reach eight. Two-player mean is 3.64. Three-player mean is
  6.53 and four-player mean is 9.35. Every locked threshold passes and all
  metrics materially exceed the recorded baseline.
- The practice Playwright flow proves all ten initial hand cards form exactly
  two rows of five at desktop with no hand overflow. A second flow proves local
  bottom seating, one-to-three opponent seating, visible score badges and table
  containment for two-, three- and four-player states. At 390x844, all ten cards
  remain in a contained multi-row hand and the document has no horizontal
  overflow. The reviewed four-player screenshot is committed with the flow.
- Built-in Browser review measured a 1108x544 desktop table, score badges above
  all four avatars, a contained 5+5 hand and no horizontal document overflow.
  Live play visibly grew the public pile from 2 to 9 cards before collection;
  the winner score then advanced to 13. At 390x844, all seats remained within
  the 343px table width, the hand used four contained rows and the browser error
  log was empty.
- Focused results: engine 25/25, web 20/20 and practice Playwright 3/3. The final
  workspace build, all 72 tests, typecheck, lint and format checks pass. The full
  default-parallel Playwright suite passes 6/6, including private reconnect,
  matchmaking ratings, practice, responsive rules and all new table geometry.

## Enhancement 2 delegation ledger

### SOL DECISIONS

- Keep the existing anonymous guest model: multiplayer asks for a display name,
  the server issues one opaque 256-bit token, only its SHA-256 hash is persisted,
  and the browser restores that guest on later visits. No external account,
  password or third-party credential is required.
- Socket.IO identity is established only during the connection handshake. After
  creating, restoring or changing a guest, the client must set the token,
  replace any stale anonymous connection, wait for the authenticated connection,
  and only then emit a protected lobby, queue or match action. Calling
  `connect()` on an already-connected anonymous socket is insufficient and is
  the reproduced cause of the user-visible `AUTH_REQUIRED` failures.
- Anonymous connections remain permitted for Practice. A handshake that
  explicitly supplies an invalid guest token must be rejected instead of being
  silently downgraded to anonymous access.
- Add an explicit authenticated completed-match leave operation. Returning home
  releases that guest's server-side match ownership so the same profile can
  immediately host, join or queue again; active matches cannot use this release
  path to evade authoritative abandonment/timeout behavior.
- The Fastify/Socket.IO process remains the sole authority for identity, lobby
  membership, host permissions, deck selection, private hands, legal moves,
  command serialization, turn deadlines, scoring, completion and ratings. The
  host browser may choose validated lobby settings but never owns game state or
  adjudicates rules.
- Make authentication discoverable on the landing screen: show whether a saved
  guest is active, explain that multiplayer creates a local guest profile, and
  offer a safe change-player action when no lobby/match is active. Translate
  expired/invalid sessions into a recovery screen rather than exposing raw
  `AUTH_REQUIRED` as a dead end.
- Release evidence must include the exact same-page anonymous Practice to guest
  multiplayer transition, a completed match followed by another protected
  session, real 2/3-client private and two-client matchmaking connections,
  same-token socket replacement, hidden-hand isolation, forged/stale/duplicate
  command rejection, host-only controls, timeout/reconnect behavior and invalid
  token rejection.

### TERRA TASKS

- Own `packages/shared/**`, `apps/server/**` and focused server integration tests
  for Enhancement 2. Add a validated completed-match leave event/ack, release
  completed guest ownership without weakening active-match behavior, and reject
  explicitly invalid Socket.IO guest tokens at handshake while retaining truly
  anonymous Practice connections.
- Extend real-client server tests for invalid-token handshakes, completed release
  followed by a new lobby/queue, repeated release safety, active-match rejection,
  host-only settings/start, same-token replacement, recipient hand isolation and
  client attempts to forge player identity or card ownership. Use the normal
  Socket.IO boundary rather than calling service internals for security claims.
- Do not change engine/content/UI/E2E/docs/root configuration, weaken Zod strict
  schemas, trust client player IDs, move rules into a browser, expose opponent
  hands, or spawn subagents. Preserve concurrent web changes.
- Definition of done: anonymous Practice still connects; malformed/invalid auth
  cannot access multiplayer; real authenticated sockets can complete, release
  and start another protected session; every server-authority/privacy invariant
  is covered through public boundaries.
- Verification: shared and server build/test/typecheck, scoped lint/format, plus
  the new real-Socket.IO integration tests with at least three simultaneous
  authenticated clients.

### LUNA TASKS

- Own `apps/web/src/**`, `apps/web/e2e/**` and the multiplayer auth presentation
  for Enhancement 2. Implement one reusable authenticated-connect path that
  creates/restores the guest, replaces a stale anonymous handshake, waits for
  connection success, and only then emits host/join/queue actions.
- Add visible landing identity status/help and a change-player action; recover
  invalid/expired auth to the display-name screen with a helpful message. On
  networked match completion, send the new leave event before returning home so
  the profile can immediately host/join/queue again.
- Add component tests for an already-connected anonymous Practice socket being
  reconnected with the new token before a protected emit, restored-token reuse,
  auth error recovery and completed-match release. Extend Playwright with a real
  same-page Practice-to-private regression and a second multiplayer session;
  retain the existing multi-context private/matchmaking flows and privacy checks.
- Do not edit server/shared/engine/content/root/docs, add password/OAuth UI,
  expose tokens, bypass the server, duplicate rule logic, or spawn subagents.
  Preserve concurrent server changes and adapt to the agreed event contract.
- Definition of done: users never encounter a dead-end raw `AUTH_REQUIRED`;
  protected actions work after Practice and after completion; identity state is
  understandable; existing practice/private/matchmaking/leaderboard modes and
  accessibility remain intact.
- Verification: web test/build/typecheck, scoped lint/format, focused auth E2E,
  and the full Playwright suite with real separate browser contexts.

### TOO SMALL TO DELEGATE

- Review the handshake/reconnect protocol, completed-match cleanup and event
  schema together; reject any client-authoritative shortcut or token exposure.
- Reproduce the stale anonymous connection against the pre-fix public boundary,
  then independently verify the fixed same-page flow, concurrent private and
  matchmaking games, reconnect, privacy and replay resistance in live clients.
- Run the complete build/test/typecheck/lint/format/Playwright gate, keep this
  record accurate, audit generated files/secrets, commit and push the passing
  enhancement phase.

## Enhancement 2 completion record

### Delegated implementation

- Terra owned the shared-contract, server-authority and public-boundary test
  scope. Its first pass added strict completed-match release contracts, rejected
  explicit invalid-token handshakes while preserving anonymous Practice, and
  implemented completed-only ownership release. The server suite now exercises
  real Socket.IO clients for three-player privacy, same-token replacement,
  forged identity/card commands, stale/duplicate commands, host controls,
  active/repeated release, reconnect and completed release followed by another
  protected session.
- Luna owned the web authentication and presentation scope. Two attempts
  delivered the reusable authenticated reconnect path, identity status,
  recovery UI and completed-match release, but did not deliver the required
  browser regressions; the second attempt improved the socket lifecycle mock.
  After those two incomplete attempts, Sol took over the narrowly remaining
  component assertions and Playwright flows as permitted by the operating
  instructions.
- Sol verified the handshake boundary, added timeout-safe completed release,
  expanded component coverage to 24 tests, and proved the exact anonymous
  Practice-to-host and completed-match-to-second-session regressions through
  the rendered application. No rules or hidden state moved into the client.

### Authority and connection evidence

- The fixed client disconnects a stale anonymous socket, installs the opaque
  guest token, waits for the authenticated Socket.IO handshake, and only then
  emits a protected action. A concrete invalid token is rejected at handshake;
  a missing token remains valid only for anonymous Practice. The raw token is
  kept in that browser's local storage but is neither logged nor persisted by
  the server, which stores only its SHA-256 hash.
- The server remains the sole authority for player identity, lobby membership,
  host permissions, private hands, legal moves, version/idempotency checks,
  turns, deadlines, scoring, completion and ratings. Recipient-specific views
  expose only the requesting player's hand and legal card IDs; opponents expose
  counts and public state. The browser host controls only schema-validated
  settings and cannot adjudicate play.
- Server integration tests use three simultaneous authenticated Socket.IO
  clients. Playwright uses three isolated browser contexts for a private match
  and two for matchmaking, including timeout, disconnect/reconnect and match
  completion. The same-page Practice flow upgrades its already-connected
  anonymous socket before hosting, and the matchmaking flow restores a completed
  match, explicitly releases it, then immediately creates a second lobby with
  the same guest profile.

### Release evidence

- Shared contracts pass 5/5 tests, the deterministic engine passes 25/25, the
  server passes 25/25 plus its production smoke test, and the web client passes
  24/24: 79 tests total. The full workspace build, typecheck, lint and format
  checks pass.
- The default-parallel Playwright suite passes 6/6, including responsive rules,
  practice, real multi-context private and matchmaking sessions, reconnect,
  ratings, the stale anonymous handshake regression and immediate post-match
  profile reuse.
- Built-in Browser review created a fresh local guest, opened an authenticated
  private lobby without an auth error, left it, and confirmed the landing page
  visibly retained `Playing as Browser Ada` with a change-player action.

## Enhancement 3 delegation ledger

### SOL DECISIONS

- Support two through six total players in every game mode. In a private lobby,
  `playerCount` is the total seat count and `botCount` reserves zero through
  five of those seats; at least one human host is always required. Matchmaking
  remains a two-human queue and Practice offers one through five bot opponents.
- Keep every departure authoritative. A lobby host leaving or disconnecting
  closes the lobby and returns all remaining guests to a recoverable landing
  state; a non-host is removed immediately. Same-token socket replacement must
  remain safe by installing the replacement before the old socket disconnects.
- Add a deterministic engine `removePlayer` command for active human departures.
  The departing hand returns to the end of the deck, their public seat and score
  leave the match, turn/pass state is repaired clockwise, and one remaining
  player completes as the winner. If the current pile leader leaves, the next
  clockwise player inherits leadership; if the round winner leaves during the
  result pause, that pile award transfers to the next clockwise player. The
  server alone may construct this command.
- Private-match bots are server-owned seats with opaque engine IDs. Their legal
  cards come from the engine, their modest deterministic strategy preserves
  scarce/broad counters, and bot commands use the same serialized authoritative
  command path as timeouts and human moves. Bots expose no hand data.
- Add a prominent, visually polished top-left Exit control during every match.
  Practice waits for acknowledged server cleanup; an active network match sends
  a strict acknowledged exit event before leaving. Disconnects use the same
  server departure path. Completed results continue to use completed-match
  release.
- Make the pile feel physical with bounded, deterministic per-layer rotation,
  offsets, depth and spring-like play motion while keeping the authoritative top
  challenge card unobscured, accessible and stable under reduced motion.
- Extra improvement selected for this phase: an accessible custom confirmation
  dialog for active exits, clearly warning that the seat cannot be rejoined.
  This prevents accidental forfeits without weakening explicit departures.

### TERRA TASKS

- Own `packages/game-engine/**`, `packages/shared/**`, `apps/server/**` and their
  focused tests for Enhancement 3. Implement the agreed deterministic
  `removePlayer` rules, expand all player-count boundaries to six, add private
  lobby bot settings/seats and serialized server bot turns, strict active-match
  exit plus lobby-closed contracts/events, immediate lobby/match disconnect
  cleanup, and host-disconnect lobby termination.
- Preserve recipient privacy, host authorization, token replacement safety,
  seeded tests and completion/rating idempotency. A client must never submit a
  player ID, bot move or removal command. Do not edit web/docs/root files, move
  rules outside the engine/server, spawn subagents or revert concurrent work.
- Definition of done: 2–6 player engine creation/replay works; departures repair
  every phase and complete at one survivor; mixed human/bot private matches run
  to completion; exited/disconnected humans disappear from every recipient
  view; host lobby departure closes it for all; existing auth/privacy/forgery
  coverage remains green.
- Verification: engine/shared/server build, test and typecheck; scoped lint and
  format; real Socket.IO integration tests for host closure, member removal,
  active exit/disconnect, socket replacement and a mixed six-seat match.

### LUNA TASKS

- Own `apps/web/src/**` and focused `apps/web/e2e/**` for Enhancement 3. Add
  player-count options through six, private-lobby bot-count controls and clear
  capacity/readiness copy; render bot seats from authoritative match views and
  recover from lobby-closed events.
- Add a polished fixed top-left match Exit control, the accessible confirmation
  dialog selected as the extra improvement, acknowledged network exit handling,
  and immediate local Practice exit. Keep the dialog keyboard/focus safe and
  show server failures without discarding the live match.
- Enhance the existing pile layers with deterministic rotations/offsets/depth
  and spring-like play motion while keeping the top challenge face fully
  readable and honoring `prefers-reduced-motion`. Extend seat geometry for up
  to five opponents without document or table overflow.
- Add component tests for lobby bot settings, lobby closure, confirmed/cancelled
  exit, exit failure retention, six-player seats and pile transforms. Extend
  Playwright for mixed human/bot start, visible bot turns, active exit/removal,
  host-disconnect closure, six-seat containment and confirmation accessibility.
  Do not edit engine/shared/server/docs/root files, invent client rules, expose
  private data, spawn subagents or revert concurrent work.
- Definition of done: users can deliberately exit any match; remaining clients
  update correctly; mixed lobbies are understandable; two through six seats and
  the physical pile are attractive, readable, responsive and accessible.
- Verification: web test/build/typecheck, scoped lint/format, focused new E2E
  flows and the full default-parallel Playwright suite.

### TOO SMALL TO DELEGATE

- Review and integrate departure semantics across engine replay, server timers,
  rating completion, recipient views and UI acknowledgements; reject ghost
  seats, client authority or ambiguous host transfer.
- Independently verify same-token replacement, 2–6 creation, a six-seat mixed
  match, pile readability, exit confirmation, member removal and host closure
  with live clients and the built-in Browser.
- Run the complete gate, update this state record and user documentation, audit
  generated files/secrets, commit and push the passing enhancement on `main`.

## Enhancement 3 completion record

### Delegated implementation

- Terra owned the engine, shared-contract and server-authority scope. Its first
  pass established player removal, six-player boundaries, lobby closure and
  private bot orchestration but exposed completion and round-transfer gaps in
  review. Its second pass fixed double completion, leader/pass repair,
  round-result award transfer, sole-survivor completion and forfeit-aware
  all-human ratings, then passed the focused engine/shared/server suites.
- Luna owned the web presentation and browser-test scope. Two passes delivered
  the responsive six-seat table, mixed-lobby controls, top-left Exit UI,
  confirmation dialog, physical pile and component coverage, but omitted the
  required mixed-bot and host-disconnect browser flows. After the two incomplete
  attempts, Sol took over only those remaining integration tests and final UX
  review as permitted by the operating instructions.
- Sol integrated the authoritative contracts, made Practice exit wait for
  server cleanup, completed five- and six-opponent geometry, added deterministic
  pile settling, verified all departure/rating edge cases, and retained the
  original privacy and same-token replacement boundaries.

### Authority and behavior evidence

- Lobbies and matches support two through six total seats. Private games may mix
  one or more humans with up to five opaque server bots; Practice offers one
  through five bots. Matchmaking remains two humans. Mixed-bot games are
  intentionally unranked, while human-only forfeits record the departing player
  as losing regardless of the visible score at departure.
- A lobby host exit or disconnect closes the lobby and releases every guest. A
  non-host exit or disconnect removes that player immediately. Active-match
  removal is an engine command constructed only by the server: hands return to
  the deck, turns and leaders repair clockwise, round awards transfer safely,
  and a sole survivor completes the match. Replacement sockets are installed
  before old same-token sockets disconnect, preventing false removal.
- The client exposes no removal/player-ID authority and receives no opponent or
  bot hand. Server bots submit ordinary serialized commands derived from the
  same legal-card view used by the engine. The top-left Exit control waits for a
  strict acknowledgement, and the added focus-trapped confirmation warns that
  an active seat cannot be rejoined; Escape cancels and restores Exit focus.

### Presentation and release evidence

- The pile now accumulates bounded deterministic rotations, offsets and depth,
  with a spring-like settling motion and a clearly unobscured top challenge;
  reduced-motion preferences remain honored. Five opponents remain contained
  around the table at desktop and mobile sizes.
- The deterministic engine passes 35/35 tests, shared contracts 5/5, server
  integration 30/30 plus production smoke, and the web client 31/31: 101 tests
  total. Workspace production build, typecheck, lint and format checks pass.
- The balance simulation covers 40 seeded games at every size from two through
  six players. The established two-to-four-player gate remains at a 5.38-card
  mean and 4-card median; all sizes produce a 6.85-card mean and 5-card median.
- The default-parallel Playwright suite passes 10/10, including active network
  exit/removal, host-disconnect lobby closure, one-human/five-bot progression,
  six-seat desktop/mobile containment, private multiplayer, matchmaking and
  ratings. Built-in Browser review also completed a real mixed match, confirmed
  the physical pile and bot status, and verified dialog focus, Escape recovery,
  acknowledged exit and return home.

## Enhancement 4 delegation ledger

### SOL DECISIONS

- Cover all 28 unique runtime card definitions with a committed local image;
  physical copies reuse their definition's image. Keep runtime play independent
  of the network and preserve the existing accessible fallback if an asset is
  ever missing or corrupt.
- Use the pinned OpenMoji 17.0 color set as the sole source. It is a cohesive,
  production-stable internet library whose graphics are licensed CC BY-SA 4.0.
  Record title, codepoint, pinned source URL, author/project, license and local
  filename for every card. Derived/resized artwork remains CC BY-SA 4.0 and the
  repository must visibly provide the required attribution without implying
  OpenMoji endorsement.
- Choose a distinct symbol for every definition, including four escalating
  Water images and four escalating Fire images. Prefer immediate recognition at
  small card sizes over photorealism; use rarity framing and the existing card
  typography to unify the art with TopThis.
- Store self-contained square PNGs under `apps/web/public/cards` so play never
  depends on a third-party request. Pin downloads, verify signatures/dimensions,
  validate one-to-one catalog coverage and keep the acquisition reproducible.
- Render the authoritative `iconPath` supplied in each public card view. Use
  contained artwork with a deliberate background treatment so transparent art
  is not cropped, and retain empty-alt decorative images plus card-name text for
  screen-reader clarity.

### TERRA TASKS

- Own `apps/web/src/main.tsx`, `apps/web/src/styles.css`,
  `apps/web/src/main.test.tsx` and focused `apps/web/e2e/**` changes for
  Enhancement 4. Integrate the authoritative `card.iconPath`, tune artwork
  containment/background/rarity presentation across hand and challenge cards,
  and retain reliable fallback behavior.
- Add component assertions for source-path use, successful art presentation and
  broken-image fallback. Add a focused Playwright visual/asset assertion that
  exercises real served artwork on desktop and mobile without making gameplay
  or tests depend on the internet.
- Do not edit downloaded assets, attribution/source manifests, scripts, root
  package files, server/engine/shared code or documentation; do not expose new
  state, change rules, fetch at runtime, spawn subagents or revert concurrent
  work.
- Definition of done: local art is crisp and uncropped in every card context;
  missing art still degrades accessibly; no card text, controls, pile or six-seat
  layout regresses.
- Verification: web test/build/typecheck, scoped lint/format, focused artwork
  E2E and desktop/mobile screenshot review.

### LUNA TASKS

- Own `content/card-art.sources.json`, `apps/web/public/cards/**`, a small
  reproducible downloader/validator under `scripts/`, the associated root
  package scripts, `README.md`, `docs/CARD_CONTENT.md` and a dedicated artwork
  attribution document for Enhancement 4.
- Map all 28 runtime IDs to distinct OpenMoji 17.0 color PNGs, download the
  pinned files locally, and record complete CC BY-SA 4.0 attribution and
  modification/resizing status. Validate exact catalog/manifest/file parity,
  PNG signatures, square dimensions and a practical minimum resolution.
- Do not edit application source/tests/E2E, card rules/data, server/shared/engine
  code, lockfiles or unrelated documentation; do not use scraped, commercial,
  AI-generated or ambiguously licensed imagery; do not spawn subagents or
  revert concurrent work.
- Definition of done: exactly 28 correctly named local images exist, every image
  is recognizable and uniquely mapped, acquisition is reproducible, validation
  fails on any missing/extra/malformed asset, and attribution satisfies the
  pinned source license.
- Verification: run the downloader in validation mode, the committed artwork
  check, root format check and a production web build.

### TOO SMALL TO DELEGATE

- Approve the final 28-image mapping and licensing boundary, review both worker
  diffs, and reject unclear provenance, runtime third-party requests, misleading
  imagery or client-authoritative presentation data.
- Independently inspect a contact sheet plus real desktop/mobile game tables in
  the built-in Browser, including common/rare/epic/legendary cards and fallback.
- Run the complete build/test/typecheck/lint/format/Playwright/artwork gate,
  update this state record, audit asset weight and generated files, commit and
  push the passing enhancement on `main`.

## Enhancement 4 completion record

### Delegated implementation

- Luna owned acquisition, local assets, reproducibility and attribution. Its
  first pass delivered all 28 distinct pinned OpenMoji downloads, the Node-core
  fetch/check script and root commands, but represented entries as codepoint
  strings instead of the required per-card provenance. A focused second attempt
  could not safely complete that conversion. After those two incomplete
  attempts, Sol took over only the manifest expansion, validator enforcement and
  missing documentation as permitted by the operating instructions.
- Terra owned the React/CSS/test presentation scope and completed it in one
  pass. Card faces now consume the authoritative `iconPath`, transparent artwork
  is contained rather than cropped, rarity-aware backdrops improve contrast,
  and the existing decorative-image semantics and accessible fallback remain.
  Component and Playwright coverage prove source use, successful local loading,
  fallback behavior, and desktop/mobile containment.
- Sol approved the mapping against OpenMoji's pinned 17.0 metadata, visually
  reviewed a complete contact sheet and live game, expanded all 28 manifest
  records, and made validation enforce exact runtime catalog, manifest and file
  parity plus complete licensing fields.

### Artwork and licensing evidence

- Exactly 28 local PNGs cover the 28 runtime definitions. They use 28 distinct
  OpenMoji codepoints and 28 distinct file hashes, total 287,983 bytes, and each
  is a square 618×618 color image. Water and Fire tiers use escalating distinct
  symbols; every other card has its own recognizable concept image.
- The files are pinned OpenMoji 17.0 downloads and never require runtime network
  access. OpenMoji contributors are credited under CC BY-SA 4.0 in a visible
  attribution document. Every manifest entry records its title, codepoint,
  pinned source URL, local filename, project, creator, license and modification
  status; image bytes are unmodified and only local filenames differ.
- `pnpm.cmd art:fetch` reproduces the committed assets. `pnpm.cmd art:check`
  rejects missing/extra definitions or files, duplicate sources, incomplete or
  altered provenance, unpinned URLs, invalid filenames/licenses, malformed PNGs,
  non-square images and resolutions below 618px.

### Presentation and release evidence

- A live six-seat Browser review showed the Sea challenge image and ten dealt
  Water, Fire, Sun, Lightning, Ice, Rocket and Gun cards with crisp contained
  artwork and readable text. All inspected image requests were local, all loaded
  at 618×618, and the browser reported no warnings or errors. The full contact
  sheet confirmed all 28 mappings are cohesive and recognizable.
- The production build and all 101 engine/shared/server/web tests pass. Workspace
  typecheck, lint, format, deterministic two-through-six-player balance gate,
  artwork validation and server production smoke all pass.
- The default-parallel Playwright suite passes 11/11, including the new real
  local-art desktop/mobile check plus six-seat containment, exits, disconnects,
  mixed bots, private multiplayer, matchmaking, ratings and responsive rules.

## Deployment 1 delegation ledger

### SOL DECISIONS

- Deploy the existing single authoritative Fastify/Socket.IO process rather
  than splitting the static client and backend. It already serves the production
  Vite build, API and WebSocket endpoint from one origin, avoiding CORS, sticky
  sessions and a second hosting bill.
- Choose Koyeb's free Web Service for the public MVP: one 512 MB/0.1 vCPU
  instance, native Node 24 and pnpm support, WebSockets, managed HTTPS and a
  public `koyeb.app` URL for $0. The free instance sleeps after one hour without
  traffic and wakes within seconds; connected players keep the service active.
- Accept ephemeral SQLite only for this zero-cost MVP. Guest profiles, ratings
  and leaderboard history may reset after a deployment, sleep/reschedule or
  platform maintenance; the browser already recovers invalid saved profiles.
  Active matches are intentionally in-memory and likewise cannot survive a
  process replacement. State this limitation prominently rather than implying
  durability.
- Keep exactly one instance because live lobby/match state is process-local and
  SQLite is single-writer. Do not add horizontal scaling, runtime secrets,
  external databases, CORS, client/server URL splitting or a serverless rewrite.
- Pin Node 24, add explicit production build/start entry points and a one-click
  public-repository Koyeb deployment configured for the free Frankfurt region,
  HTTP port 8000, `/health`, `NODE_ENV=production`, and an ephemeral database
  path. The only blocking external action is the user's Koyeb account creation
  or login and confirmation of the free deployment.
- Document the durable upgrade path without implementing it: a Fly.io 256 MB
  shared machine plus 1 GB volume is approximately $2.17/month before small
  usage-dependent network charges and preserves SQLite across deploys.

### TERRA TASKS

- Own root production runtime metadata/scripts, a focused production-online
  smoke test under `scripts/`, and any narrowly required server startup test for
  Deployment 1. Add explicit Node 24/start behavior and prove the built client,
  `/health`, guest creation and a real Socket.IO Practice session work from one
  production process on a platform-supplied port with ephemeral SQLite.
- Preserve server authority, same-origin production serving, graceful shutdown,
  existing package boundaries and all game behavior. Do not edit hosting docs,
  add cloud SDKs/databases/secrets, weaken auth/privacy, spawn subagents or
  revert concurrent work.
- Definition of done: a clean checkout can install, build and start through the
  root commands expected by the Koyeb Node buildpack; the smoke test fails on a
  missing client, unhealthy endpoint, failed guest API, failed WebSocket or
  unclean shutdown.
- Verification: root build, new deployment smoke, server production smoke,
  typecheck, scoped lint/format and existing server tests.

### LUNA TASKS

- Own `README.md`, a new concise hosting/deployment guide under `docs/`, an
  optional `Procfile` or `.koyebignore` if justified, and no application code.
  Add a correctly encoded one-click Koyeb button for the public repository with
  the decided free-instance settings, exact manual fallback steps, health URL,
  wake/cold-start expectations, and explicit ephemeral-data warning.
- Include a compact current-cost comparison using official sources: Koyeb free,
  Render free, Railway Hobby, Render durable and Fly.io durable. Explain why the
  selected one-service/same-origin shape is cheaper and safer for this app.
- Do not claim that an external deployment exists before it does, do not add
  credentials, cloud SDKs or persistence changes, do not edit code/tests/root
  package metadata, spawn subagents or revert concurrent work.
- Definition of done: a user can click one link, authorize/sign in, confirm the
  prefilled free service and obtain the public URL; limitations and the later
  durable upgrade are unambiguous.
- Verification: validate all links/URL parameters, root format check and compare
  instructions to the committed production commands.

### TOO SMALL TO DELEGATE

- Review current provider documentation/pricing, approve the cost/reliability
  tradeoff, validate the generated deploy URL and integrate both worker diffs.
- Run the full release gate and a local production browser flow. After the user
  completes the external Koyeb account action, verify the public health page,
  static assets, guest identity and a real multi-browser Socket.IO game.
- Keep this state record accurate, audit secrets/artifacts, commit and push the
  deployment-ready phase. Do not mark the public launch complete until the live
  URL passes verification.

## Deployment 1 readiness record

### Provider and runtime outcome

- The deployment target is one Koyeb free Web Service. Koyeb supplies the
  lowest exposed port as `PORT`, so the existing platform-aware server listens
  correctly on the preconfigured HTTP port 8000. Managed HTTPS and WebSocket
  forwarding keep the React client, `/api/*`, `/health` and Socket.IO on one
  public origin.
- The root package now pins Node 24/pnpm 11 compatibility and provides explicit
  `build` and `start` commands for the Node buildpack. The deployment uses
  `NODE_ENV=production` and disposable `/tmp/topthis.sqlite` storage.
- `docs/HOSTING.md` contains a one-click, public-repository deployment link and
  exact manual settings. The service must remain at one instance; free local
  storage and active in-memory games are deliberately non-durable.

### Delegated delivery and review

- Terra added the production runtime metadata and a production-online smoke
  that launches the compiled process on a dynamically selected platform-style
  port and temporary SQLite database. It verifies the built client, a local PNG,
  `/health`, guest creation, a recipient-safe real Socket.IO practice session,
  graceful `SIGTERM` handling and cleanup.
- Luna added the public hosting guide and README handoff, including the Koyeb
  button, manual fallback, cold-start/data-loss warnings and current alternatives
  for free or durable hosting. Sol reviewed the settings against Koyeb's current
  Node, environment-variable, WebSocket, service and storage documentation.

### Verification evidence

- The production listener smoke passes against the same compiled process and
  same-origin topology that Koyeb will run.
- All 101 engine/shared/server/web tests pass. Workspace typecheck, lint,
  formatting, deterministic balance analysis and artwork validation pass.
- Playwright passes 11/11 multiplayer and responsive flows. A separate built-in
  Browser review loaded the compiled production client from Fastify, created a
  one-bot practice game over Socket.IO and rendered the connected table, local
  card artwork, playable hand, pile, timer and exit control correctly.

### Remaining external action

- The code is ready to push, but the public launch is not complete. A Koyeb
  account owner must sign in and confirm the prefilled free service. After Koyeb
  returns its public `.koyeb.app` URL, `/health`, static assets, guest identity
  and a real two-browser Socket.IO game still need to be verified before this
  phase can be marked complete.

## Deployment 1b delegation ledger

### SOL DECISIONS

- Retire Koyeb as the recommended onboarding path. Koyeb's February 17, 2026
  acquisition announcement states that new users must provide a payment method
  and subscribe to a paid Pro-or-higher plan; the signed-in dashboard shown by
  the user no longer exposes ordinary free-service creation.
- Replace it with one Render Free Web Service in Frankfurt. Render currently
  offers free Node web services, native pnpm tooling, managed HTTPS, WebSocket
  connections, a public `onrender.com` URL and Blueprint-based one-click deploys.
- Keep the same one-process, same-origin and single-instance architecture. Use
  Render's supplied `PORT`, the existing root build/start commands, `/health`
  health checks, runtime-only `NODE_ENV=production` and disposable SQLite under
  `/tmp`. Do not expose production mode during dependency installation because
  the build requires root development tools such as Vite and TypeScript.
- Accept Render Free's 15-minute idle spin-down, approximately one-minute cold
  start, 750 monthly running hours and ephemeral local filesystem for this MVP.
  Do not add a temporary 30-day Postgres database or imply durable profiles.

### TERRA TASKS

- Own `render.yaml` and deployment-runtime verification for Deployment 1b.
  Define exactly one Frankfurt Node web service on the free plan with the root
  pnpm build/start commands, `/health`, production mode and ephemeral SQLite.
- Preserve the existing package/runtime and server-authority boundaries. Do not
  add a Dockerfile, database, secrets, application changes or documentation;
  do not spawn subagents or revert concurrent work.
- Definition of done: the Blueprint matches Render's current schema, requires no
  secret input, uses one free instance, and the existing production-online smoke
  proves the commands and platform-supplied port behavior.
- Verification: Blueprint/schema inspection, `pnpm.cmd build`,
  `pnpm.cmd smoke:production`, scoped format check and `git diff --check`.

### LUNA TASKS

- Own `README.md` and `docs/HOSTING.md` for Deployment 1b. Replace Koyeb as the
  recommended path with an explicit-repository Deploy to Render button and exact
  fallback steps. Explain the Koyeb policy change and Render Free limitations.
- Keep the durable alternatives accurate, use only official current sources,
  and do not claim a public deployment exists before live verification. Do not
  edit code, package files, Blueprint/runtime configuration or unrelated docs;
  do not spawn subagents or revert concurrent work.
- Definition of done: a newly signed-up user can authorize GitHub, approve the
  prefilled free Blueprint, and obtain an `onrender.com` URL without entering
  application secrets or payment details.
- Verification: validate all links, compare instructions to `render.yaml`, run
  scoped Prettier and `git diff --check`.

### TOO SMALL TO DELEGATE

- Review the Koyeb policy evidence and Render's current free, WebSocket, pnpm,
  Blueprint, port and health-check documentation; approve the migration.
- Review worker diffs, run the complete release gate, commit and push the fixed
  deployment handoff, then inspect the Render authorization page in the browser.
- After the user confirms the external Render deployment, verify `/health`,
  static assets, guest identity and a real two-browser Socket.IO game before
  marking the public launch complete.

## Deployment 1b readiness record

### Correction and delegated delivery

- The user's signed-in Koyeb dashboard showed only the Mistral transition page.
  Koyeb's official acquisition announcement confirms the cause: new users must
  supply a payment method and subscribe to Pro or higher, so Koyeb is no longer
  a valid $0 onboarding path despite older free-instance documentation.
- Terra added one root `render.yaml` service: Node runtime, Frankfurt, Free plan,
  one instance, explicit pnpm install/build, runtime production start, `/health`,
  ephemeral SQLite and manual deploys as recommended for a public one-click
  Blueprint. Sol corrected production mode to runtime-only so build-time Vite
  and TypeScript dependencies cannot be pruned.
- Luna replaced the README/hosting handoff with the explicit-repository Render
  button, Blueprint/fallback steps, manual-update instructions, official Koyeb
  policy evidence and Render's cold-start, usage and ephemeral-data limitations.

### Verification evidence

- All 101 engine/shared/server/web tests pass. Workspace typecheck, lint,
  formatting, deterministic balance analysis and artwork validation pass.
- The production-online smoke passes against the compiled client, `/health`, a
  local card asset, guest API and a real recipient-safe Socket.IO practice game.
- Playwright passes 11/11 multiplayer and responsive flows. The Blueprint was
  structurally reviewed against Render's current official specification; the
  Render CLI is not installed locally, so the external control plane remains the
  final schema authority when the user approves the Blueprint.

### Remaining external action

- Commit and push this correction, then the user must sign into Render, authorize
  the GitHub repository and approve the prefilled free Blueprint. The launch is
  not complete until the resulting `onrender.com` root, `/health`, static assets,
  guest identity and a real two-browser Socket.IO game pass public verification.
