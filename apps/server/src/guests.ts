import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import {
  DisplayNameSchema,
  LeaderboardResponseSchema,
  type Guest,
  type LeaderboardResponse,
} from '@topthis/shared';

export type CompletionPlayer = { guestId: string; score: number; forfeited?: boolean };
export type CompletionInput = {
  matchId: string;
  mode: 'private' | 'matchmaking';
  seed: number;
  commandLog: unknown;
  players: CompletionPlayer[];
};
export type CompletionResult = {
  matchId: string;
  ratings: Record<string, { before: number; after: number }>;
};

/** Pairwise Elo, K=24/(N-1). Largest remainders make integer deltas exactly zero-sum. */
export function calculateElo(
  players: Array<CompletionPlayer & { rating: number }>,
): Record<string, number> {
  const raw = players.map((p) => {
    let delta = 0;
    for (const other of players)
      if (other.guestId !== p.guestId) {
        const actual =
          p.forfeited !== other.forfeited
            ? p.forfeited
              ? 0
              : 1
            : p.score === other.score
              ? 0.5
              : p.score > other.score
                ? 1
                : 0;
        const expected = 1 / (1 + 10 ** ((other.rating - p.rating) / 400));
        delta += (24 / (players.length - 1)) * (actual - expected);
      }
    return { id: p.guestId, value: delta };
  });
  const rounded = raw.map((x) => ({ ...x, value: Math.floor(x.value) }));
  const residual = -rounded.reduce((sum, x) => sum + x.value, 0);
  const order = [...raw].sort(
    (a, b) =>
      b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)) || a.id.localeCompare(b.id),
  );
  for (let i = 0; i < residual; i++) rounded.find((x) => x.id === order[i]!.id)!.value++;
  return Object.fromEntries(rounded.map((x) => [x.id, x.value]));
}

export const hashGuestToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

type TableColumn = { name: string };

const hasColumn = (db: Database.Database, table: string, column: string): boolean =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as TableColumn[]).some(
    (candidate) => candidate.name === column,
  );

/**
 * Keep migrations tolerant of databases created before schema_migrations
 * existed. The checks are intentionally part of each migration: an existing
 * Phase 3 or Phase 4 database is adopted by the marker without data rewrites.
 */
const migrations: Array<(db: Database.Database) => void> = [
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`);
  },
  (db) => {
    for (const column of [
      'rating INTEGER NOT NULL DEFAULT 1000',
      'wins INTEGER NOT NULL DEFAULT 0',
      'losses INTEGER NOT NULL DEFAULT 0',
      'ties INTEGER NOT NULL DEFAULT 0',
      'games_played INTEGER NOT NULL DEFAULT 0',
    ]) {
      const name = column.split(' ')[0]!;
      if (!hasColumn(db, 'guests', name)) db.exec(`ALTER TABLE guests ADD COLUMN ${column}`);
    }
  },
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS completed_matches (
      match_id TEXT PRIMARY KEY NOT NULL, mode TEXT NOT NULL, completed_at INTEGER NOT NULL, seed INTEGER NOT NULL,
      command_log TEXT NOT NULL, result_json TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS completed_match_players (
      match_id TEXT NOT NULL, guest_id TEXT NOT NULL, score INTEGER NOT NULL, placement INTEGER NOT NULL DEFAULT 1, outcome TEXT NOT NULL DEFAULT 'tie' CHECK(outcome IN ('win', 'loss', 'tie')), rating_before INTEGER NOT NULL,
      rating_after INTEGER NOT NULL, PRIMARY KEY (match_id, guest_id), FOREIGN KEY(match_id) REFERENCES completed_matches(match_id), FOREIGN KEY(guest_id) REFERENCES guests(id)
    )`);
  },
  (db) => {
    if (!hasColumn(db, 'completed_match_players', 'placement'))
      db.exec(
        'ALTER TABLE completed_match_players ADD COLUMN placement INTEGER NOT NULL DEFAULT 1',
      );
    if (!hasColumn(db, 'completed_match_players', 'outcome'))
      db.exec("ALTER TABLE completed_match_players ADD COLUMN outcome TEXT NOT NULL DEFAULT 'tie'");
  },
];

function applyMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  for (const [index, migrate] of migrations.entries()) {
    const version = index + 1;
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
    if (applied) continue;
    db.transaction(() => {
      // Recheck after SQLite has acquired the write lock for this migration.
      if (db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)) return;
      migrate(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        Date.now(),
      );
    }).immediate();
  }
}

export interface GuestRepository {
  create(displayName: string): { guest: Guest; token: string };
  findByToken(token: string): Guest | undefined;
  completeMatch(input: CompletionInput): CompletionResult;
  leaderboard(page: number, pageSize: number): LeaderboardResponse;
  close(): void;
}

/** The only persistent Phase 3 boundary. No raw session secrets are stored. */
export class SqliteGuestRepository implements GuestRepository {
  private readonly db: Database.Database;
  constructor(path = process.env.TOPTHIS_DATABASE_PATH ?? 'data/topthis.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    if (path !== ':memory:') this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    applyMigrations(this.db);
  }
  create(rawDisplayName: string): { guest: Guest; token: string } {
    const displayName = DisplayNameSchema.parse(rawDisplayName);
    const guest = { id: `g${randomUUID().replaceAll('-', '')}`, displayName };
    const token = randomBytes(32).toString('base64url');
    this.db
      .prepare('INSERT INTO guests (id, display_name, token_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(guest.id, guest.displayName, hashGuestToken(token), Date.now());
    return { guest, token };
  }
  findByToken(token: string): Guest | undefined {
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return undefined;
    const row = this.db
      .prepare('SELECT id, display_name as displayName FROM guests WHERE token_hash = ?')
      .get(hashGuestToken(token)) as Guest | undefined;
    return row;
  }
  completeMatch(input: CompletionInput): CompletionResult {
    const existing = this.db
      .prepare('SELECT result_json FROM completed_matches WHERE match_id = ?')
      .get(input.matchId) as { result_json: string } | undefined;
    if (existing) return JSON.parse(existing.result_json) as CompletionResult;
    const run = this.db.transaction(() => {
      const duplicate = this.db
        .prepare('SELECT result_json FROM completed_matches WHERE match_id = ?')
        .get(input.matchId) as { result_json: string } | undefined;
      if (duplicate) return JSON.parse(duplicate.result_json) as CompletionResult;
      const rows = input.players.map((p) => {
        const row = this.db.prepare('SELECT rating FROM guests WHERE id = ?').get(p.guestId) as
          { rating: number } | undefined;
        if (!row) throw Error('UNKNOWN_GUEST');
        return { ...p, rating: row.rating };
      });
      if (rows.length < 2) throw Error('INVALID_COMPLETION');
      const deltas = calculateElo(rows);
      const ranked = [...rows].sort(
        (left, right) =>
          Number(!!left.forfeited) - Number(!!right.forfeited) ||
          right.score - left.score ||
          left.guestId.localeCompare(right.guestId),
      );
      const isTop = (row: (typeof rows)[number]) =>
        !row.forfeited && ranked[0]!.score === row.score && !ranked[0]!.forfeited;
      const topCount = rows.filter(isTop).length;
      const ratings: CompletionResult['ratings'] = {};
      for (const row of rows) {
        const after = row.rating + deltas[row.guestId]!;
        const outcome = isTop(row) ? (topCount > 1 ? 'ties' : 'wins') : 'losses';
        this.db
          .prepare(
            `UPDATE guests SET rating = ?, games_played = games_played + 1, ${outcome} = ${outcome} + 1 WHERE id = ?`,
          )
          .run(after, row.guestId);
        ratings[row.guestId] = { before: row.rating, after };
      }
      const result = { matchId: input.matchId, ratings };
      this.db
        .prepare(
          'INSERT INTO completed_matches (match_id, mode, completed_at, seed, command_log, result_json) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          input.matchId,
          input.mode,
          Date.now(),
          input.seed,
          JSON.stringify(input.commandLog),
          JSON.stringify(result),
        );
      for (const row of rows) {
        const placement =
          1 +
          rows.filter(
            (other) =>
              (row.forfeited && !other.forfeited) ||
              (row.forfeited === other.forfeited && other.score > row.score),
          ).length;
        const outcome = isTop(row) ? (topCount > 1 ? 'tie' : 'win') : 'loss';
        this.db
          .prepare(
            'INSERT INTO completed_match_players (match_id, guest_id, score, placement, outcome, rating_before, rating_after) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            input.matchId,
            row.guestId,
            row.score,
            placement,
            outcome,
            ratings[row.guestId]!.before,
            ratings[row.guestId]!.after,
          );
      }
      return result;
    });
    return run();
  }
  leaderboard(page: number, pageSize: number): LeaderboardResponse {
    const total = (
      this.db.prepare('SELECT COUNT(*) AS total FROM guests').get() as { total: number }
    ).total;
    const entries = this.db
      .prepare(
        `SELECT id as guestId, display_name as displayName, rating, wins, losses, ties, games_played as gamesPlayed FROM guests ORDER BY rating DESC, wins DESC, games_played ASC, display_name ASC, id ASC LIMIT ? OFFSET ?`,
      )
      .all(pageSize, (page - 1) * pageSize) as Array<
      Omit<LeaderboardResponse['entries'][number], 'rank'>
    >;
    return LeaderboardResponseSchema.parse({
      total,
      page,
      pageSize,
      entries: entries.map((entry, index) => ({
        ...entry,
        rank: (page - 1) * pageSize + index + 1,
      })),
    });
  }
  close(): void {
    this.db.close();
  }
}
