# TopThis Current State

TopThis is a strategic multiplayer card game where every card has its own
counters, and the last successful play takes the pile.

## Status

- Active phase: Phase 4 — matchmaking, ratings and leaderboard (planning)
- Last completed phase: Phase 3 — private online multiplayer
- Phase branch: `main`; completed phases are pushed after their passing gate.
- Runtime: Node.js 24.18.0 and pnpm 11.14.0
- Windows note: use `pnpm.cmd` when a local PowerShell execution policy blocks
  the unsigned `pnpm.ps1` shim; root package scripts remain cross-platform.
- External blockers: none

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

## Remaining non-blocking limitations

- Practice, guest identity and private multiplayer/reconnection are complete.
  Completed-match persistence, matchmaking, ratings, leaderboard and final
  product/operational polish remain for Phases 4 and 5.
