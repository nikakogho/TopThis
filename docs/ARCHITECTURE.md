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
Gameplay, server-only player removal and internal round-advance commands include
match/version/turn expectations as applicable. An accepted command increments
state version and is logged once; invalid, duplicate and stale commands do not
mutate state. Replaying the accepted log from the same creation input produces
byte-equivalent stable JSON.

Private matches may add server-owned bot seats up to six total players. Bot
decisions use engine-produced legal IDs and enter the same serialized command
queue as humans and timeouts. Human exits and disconnects become deterministic
server-only removal commands; clients cannot select the player being removed.

## Matchmaking and persistence

Authenticated matchmaking is an in-memory FIFO queue with two-player pairing.
It reuses the private active-match runner rather than introducing a second
rules path. Recipient views remain isolated: only the local hand and legal IDs
are sent. A simultaneously replacing socket with the same token safely takes
over before the older socket closes; a genuine disconnect immediately removes
the lobby or active-match seat.

The SQLite repository extends guest rows with rating and win/loss/tie/game
statistics and adds `completed_matches` plus `completed_match_players`. Match
completion, player result rows and rating/stat updates run in one transaction
keyed by match ID; a duplicate completion returns the stored result without
applying changes again. Leaderboard pagination is bounded (page >= 1,
pageSize 1-100) and uses the documented stable ordering.

Schema initialization is an ordered migration sequence recorded in
`schema_migrations`. Each unapplied version runs in an immediate SQLite
transaction and records its marker only after the schema change succeeds.
Databases created in Phase 3 or Phase 4 are adopted by shape checks, preserving
guest and completed-match data; a failed startup can safely retry the remaining
versions.

## Production process

After the workspace build, `@topthis/server` is the only production process. In
production mode Fastify serves the Vite `index.html` and hashed assets while
registered `/health`, `/api/*` and Socket.IO boundaries remain authoritative.
The client build is considered present only when its index exists; a missing
build is logged and leaves the API process available for diagnosis.

Fastify's JSON logger records startup, request completion, missing-client-build
and graceful-shutdown events. Guest tokens, private hands, legal moves and raw
command state are not application log fields. The health endpoint remains a
small validated liveness response and is registered before static serving.
