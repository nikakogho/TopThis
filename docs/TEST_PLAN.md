# Test plan

Unit tests cover deterministic engine operations, seeded randomness, card legality, ties, and scoring. Shared schemas and server endpoints test malformed input rejection, authorization, hidden-hand isolation, idempotency, timeouts, and reconnect behavior. Browser smoke and Playwright flows verify the client shell and later gameplay journeys.

CI runs formatting, ESLint, strict type checking, package tests, and builds on Node 24 with pnpm 11. Persistence and multiplayer tests are added in their respective future phases.
