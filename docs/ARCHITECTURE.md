# Architecture

The pnpm workspace separates UI (`apps/web`), the single Fastify/Socket.IO process (`apps/server`), boundary schemas (`packages/shared`), and pure deterministic rules (`packages/game-engine`). The server owns matches, hidden state, commands, timers, scores, persistence, and rating application.

Development runs Vite and the server together; production serves the built client from the server. Horizontal scaling is out of scope for MVP and would require shared active-match state plus a Socket.IO adapter.

Process boundaries use schema validation. The engine has no runtime dependencies or filesystem/network access.
