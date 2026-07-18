# TopThis

Everything beats something. Top this. TopThis is a strategic multiplayer card game where every card has its own counters, and the last successful play takes the pile.

## Current implementation

TopThis currently provides the strict pnpm workspace, branded React/Vite shell,
validated Fastify/Socket.IO boundary, complete resolved card catalog and pure
seeded rules engine. The playable practice and multiplayer interfaces are built
in the following phases.

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
