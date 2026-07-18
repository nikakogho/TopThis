# Elemental Card Game — Codex operating instructions

## Parent responsibility

The parent model is GPT-5.6 Sol at medium reasoning.

Sol is the technical lead. Sol owns:

- architecture;
- decomposition;
- interpreting ambiguous game rules;
- security and server-authority decisions;
- multiplayer concurrency and idempotency;
- difficult cross-system debugging;
- integrating worker contributions;
- final code and product review.

Sol must not personally perform substantial routine implementation merely
because doing it directly feels convenient.

## Mandatory delegation

Before each implementation phase, create a delegation ledger in
`docs/CURRENT_STATE.md` containing:

1. SOL DECISIONS
2. TERRA TASKS
3. LUNA TASKS
4. TOO SMALL TO DELEGATE

Use `terra_worker` for:

- ordinary feature implementation;
- rules-engine operations with agreed semantics;
- Fastify and Socket.IO work;
- meaningful React features;
- persistence;
- integration tests;
- Playwright flows;
- localized debugging.

Use `luna_worker` for:

- scaffolding;
- repetitive card data;
- fixtures;
- simple components;
- CSS and accessibility work;
- documentation;
- tests following existing patterns;
- formatting, linting and mechanical edits.

At most one Terra worker and one Luna worker may run concurrently.

Do not assign the same problem to multiple workers.

Workers may not create more workers.

Sol may take over delegated work only after two failed worker attempts, an
unsafe result, or discovery of a genuine architectural ambiguity.

Every delegated task must specify:

- exact scope;
- constraints;
- definition of done;
- verification command.

Review worker diffs and concise reports. Do not repeat their entire
investigation without a concrete reason.

## Engineering rules

- Use strict TypeScript.
- Keep the rules engine deterministic and independent of UI, networking,
  databases and filesystem access.
- Keep all card relationships data-driven.
- The server is authoritative.
- Never send one player's private hand to another client.
- Use seeded randomness in tests.
- Use schema validation at process boundaries.
- Prefer small, understandable systems over speculative abstractions.
- Use pnpm workspaces.
- Run tests, type checking and linting before declaring a phase complete.
- Use Playwright and the built-in browser to verify rendered behavior.
- Keep `docs/CURRENT_STATE.md` accurate.
- Commit each completed, passing phase.
- Do not commit secrets, generated databases, browser videos or dependency
  directories.
- Make reasonable reversible decisions instead of asking the user about minor
  details.
- Pause only for unavailable credentials, external-account actions, usage
  exhaustion or genuinely unknowable requirements.
