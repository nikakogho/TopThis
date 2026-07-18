# TopThis Current State

TopThis is a strategic multiplayer card game where every card has its own
counters, and the last successful play takes the pile.

## Status

- Active phase: Phase 1 — card content and deterministic engine (planning)
- Last completed phase: Phase 0 — architecture and scaffolding
- Repository baseline: one configuration-only commit on `main`
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

## Phase 0 verification

- Root install, build, unit/integration tests, type checking, linting and
  formatting checks pass.
- `pnpm.cmd dev` starts Vite on `127.0.0.1:5173` and TopThis Server on port
  3000; `/health` returns the validated service response.
- Playwright launches Chromium and passes the landing-page smoke flow.
- Built-in Browser inspection passed at the default desktop viewport and at
  390x844. The first inspection found a clipped oversized headline; the CSS was
  corrected and reverified with all content visible and no horizontal overflow.

## Remaining non-blocking limitations

- Phase 0 intentionally provides only the branded shell and system boundaries.
  Card content, gameplay, bots, multiplayer, persistence, matchmaking and the
  complete product UI remain for Phases 1 through 5.
