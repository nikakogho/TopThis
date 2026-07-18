# Test plan

Unit tests cover deterministic engine operations, seeded randomness, card legality, ties, and scoring. Shared schemas and server endpoints test malformed input rejection, authorization, hidden-hand isolation, idempotency, timeouts, and reconnect behavior. Browser smoke and Playwright flows verify the client shell and later gameplay journeys.

CI runs formatting, ESLint, strict type checking, package tests, and builds on
Node 24 with pnpm 11.

Phase 4 coverage includes `QueueAckSchema` and `LeaderboardResponseSchema`
shared queue/leaderboard validation,
server integration tests for FIFO pairing, queue cleanup, reconnect/privacy,
exactly-once completion persistence, pairwise Elo/stat updates and stable
leaderboard pagination. Web Vitest tests cover guest-first queue entry,
`queue:status` rendering and cancellation, `match:state` transition into the
private table, leaderboard rows, bounded pagination, empty and error states.
The Phase 4 multi-context Playwright flow queues two isolated guests, checks
recipient privacy, completes a real authoritative match, verifies zero-sum
rating changes and win/loss records, reloads into the completed match, and
reopens the persisted leaderboard. Practice and private multiplayer flows
remain part of the regression suite.

Phase 5 web coverage includes a focused Vitest assertion that the landing
How to Play action opens semantic Rules content and that Return to menu restores
the landing actions. `apps/web/e2e/rules.spec.ts` drives the same action by
keyboard at 390x844, verifies visible headings and focus, checks no horizontal
containment overflow, and returns to the menu. Run it with
`pnpm exec playwright test apps/web/e2e/rules.spec.ts --workers=1`.
