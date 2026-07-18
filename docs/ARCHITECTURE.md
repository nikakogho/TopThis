# Architecture

The pnpm workspace separates UI (`apps/web`), the single Fastify/Socket.IO process (`apps/server`), boundary schemas (`packages/shared`), and pure deterministic rules (`packages/game-engine`). The server owns active matches, hidden-state delivery, command serialization, timers, persistence, and rating application. The engine owns deterministic legality, turns, round scoring and match winners after the server accepts a command.

Development runs Vite and the server together; production serves the built client from the server. Horizontal scaling is out of scope for MVP and would require shared active-match state plus a Socket.IO adapter.

Process boundaries use schema validation. The engine has no runtime dependencies or filesystem/network access.

## Deterministic engine boundary

The engine receives validated values rather than reading card files. Content
authoring expands tag-based conveniences once into explicit definition IDs;
normal legality is a direct membership check. Card-definition order is not
authoritative: the engine sorts definitions, creates stable physical instance
IDs, shuffles with its own seeded PRNG and selects 200 of the 400 instances
without replacement.

Full `MatchState` is server-private and contains hands, the selected deck and
the accepted command log. It is not a public network contract. Recipient-safe
serialization belongs in `@topthis/shared` and the server layer so one player's
hand can never be sent to another client.

The match state machine is `playing -> round_result -> playing|completed`.
Gameplay and internal round-advance commands include match/version/turn
expectations as applicable. An accepted command increments state version and is
logged once; invalid, duplicate and stale commands do not mutate state. Replaying
the accepted log from the same creation input produces byte-equivalent stable
JSON.
