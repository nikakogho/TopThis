# TopThis

Everything beats something. Top this. TopThis is a strategic multiplayer card game where every card has its own counters, and the last successful play takes the pile.

## Phase 0

Phase 0 provides a strict pnpm workspace, a branded blank React/Vite client, a dependency-free game-engine boundary, and a Fastify server scaffold. Gameplay is not implemented yet.

Requires Node 24 and pnpm 11. On Windows use `pnpm.cmd` if PowerShell blocks the shim.

```sh
pnpm install
pnpm exec playwright install chromium
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm format:check
```

On Linux CI, install Chromium and its system dependencies with `pnpm exec playwright install --with-deps chromium`.

The server is authoritative and the MVP is single-instance. `apps/web` is the client, `apps/server` the process boundary, `packages/shared` validated schemas, and `packages/game-engine` deterministic rules.
