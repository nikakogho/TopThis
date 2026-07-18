# Game rules (design contract)

The game is a turn-based pile contest. Each card defines counters and legal responses in data, and the last successful legal play claims the pile. Rules are deterministic, seeded in tests, and resolved only by the authoritative server.

Legality is based on card counters and state, never rarity, ownership, price, or artwork. A player may only play cards from their private hand; clients never receive another player's hand. Commands are validated, idempotent, and rejected when stale. Timeouts, scoring, identity, and ratings are server decisions.

Future phases specify deck construction, turn order, tie handling, reconnects, and persistence. No rule implementation is claimed in Phase 0.
