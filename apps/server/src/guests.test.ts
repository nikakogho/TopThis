import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateElo, hashGuestToken, SqliteGuestRepository } from './guests.js';

const paths: string[] = [];
afterEach(() => {
  for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('ratings and leaderboard', () => {
  it('applies pairwise ratings once and returns stable pages', () => {
    const dir = mkdtempSync(join(tmpdir(), 'topthis-ratings-'));
    paths.push(dir);
    const repo = new SqliteGuestRepository(join(dir, 'ratings.sqlite'));
    const a = repo.create('Alpha').guest,
      b = repo.create('Bravo').guest,
      c = repo.create('Charlie').guest;
    const input = {
      matchId: 'm-result',
      mode: 'private' as const,
      seed: 4,
      commandLog: [],
      players: [
        { guestId: a.id, score: 5 },
        { guestId: b.id, score: 5 },
        { guestId: c.id, score: 1 },
      ],
    };
    const first = repo.completeMatch(input),
      again = repo.completeMatch(input);
    expect(again).toEqual(first);
    expect(
      Object.values(first.ratings).reduce((sum, rating) => sum + rating.after - rating.before, 0),
    ).toBe(0);
    const page = repo.leaderboard(1, 2);
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page.entries.map((x) => x.rank)).toEqual([1, 2]);
    expect(
      calculateElo([
        { guestId: a.id, score: 1, rating: 1000 },
        { guestId: b.id, score: 1, rating: 1000 },
      ]),
    ).toEqual({ [a.id]: 0, [b.id]: 0 });
    repo.close();
  });
  it('uses largest-remainder rounding and stores tied placement history', () => {
    const players = [
      { guestId: 'a', score: 3, rating: 921 },
      { guestId: 'b', score: 2, rating: 1465 },
      { guestId: 'c', score: 3, rating: 1580 },
    ];
    expect(Object.values(calculateElo(players)).reduce((sum, value) => sum + value, 0)).toBe(0);
    const dir = mkdtempSync(join(tmpdir(), 'topthis-history-'));
    paths.push(dir);
    const file = join(dir, 'history.sqlite');
    const repo = new SqliteGuestRepository(file);
    const a = repo.create('Ari').guest,
      b = repo.create('Bea').guest,
      c = repo.create('Cam').guest;
    repo.completeMatch({
      matchId: 'm-history',
      mode: 'matchmaking',
      seed: 1,
      commandLog: [],
      players: [
        { guestId: a.id, score: 4 },
        { guestId: b.id, score: 4 },
        { guestId: c.id, score: 1 },
      ],
    });
    repo.close();
    const reopened = new SqliteGuestRepository(file);
    expect(reopened.leaderboard(1, 10).total).toBe(3);
    reopened.close();
    const db = new Database(file, { readonly: true });
    const rows = db
      .prepare(
        'SELECT placement, outcome FROM completed_match_players WHERE match_id = ? ORDER BY score DESC, guest_id',
      )
      .all('m-history');
    expect(rows).toEqual([
      { placement: 1, outcome: 'tie' },
      { placement: 1, outcome: 'tie' },
      { placement: 3, outcome: 'loss' },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM completed_matches').get()).toEqual({
      count: 1,
    });
    db.close();
  });
  it('ranks a forfeiter below every active player despite a higher captured score', () => {
    const players = [
      { guestId: 'forfeit', score: 99, forfeited: true, rating: 1000 },
      { guestId: 'active', score: 1, rating: 1000 },
    ];
    expect(calculateElo(players)).toEqual({ forfeit: -12, active: 12 });
    const dir = mkdtempSync(join(tmpdir(), 'topthis-forfeit-'));
    paths.push(dir);
    const repo = new SqliteGuestRepository(join(dir, 'forfeit.sqlite'));
    const forfeit = repo.create('Forfeit').guest;
    const active = repo.create('Active').guest;
    const input = {
      matchId: 'm-forfeit',
      mode: 'private' as const,
      seed: 1,
      commandLog: [],
      players: [
        { guestId: forfeit.id, score: 99, forfeited: true },
        { guestId: active.id, score: 1 },
      ],
    };
    const first = repo.completeMatch(input);
    expect(repo.completeMatch(input)).toEqual(first);
    expect(repo.leaderboard(1, 2).entries.map((entry) => entry.guestId)).toEqual([
      active.id,
      forfeit.id,
    ]);
    repo.close();
  });
});

describe('SqliteGuestRepository', () => {
  it('adopts a Phase 3 guest database once and preserves exactly-once completion after reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'topthis-phase3-migration-'));
    paths.push(dir);
    const file = join(dir, 'phase3.sqlite');
    const token = 'a'.repeat(43);
    const legacy = new Database(file);
    legacy.exec(`CREATE TABLE guests (
      id TEXT PRIMARY KEY NOT NULL, display_name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`);
    legacy
      .prepare('INSERT INTO guests (id, display_name, token_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('legacy-a', 'Ari', hashGuestToken(token), 1);
    legacy.close();

    const repo = new SqliteGuestRepository(file);
    expect(repo.findByToken(token)).toEqual({ id: 'legacy-a', displayName: 'Ari' });
    const first = repo.completeMatch({
      matchId: 'm-legacy',
      mode: 'private',
      seed: 2,
      commandLog: [],
      players: [
        { guestId: 'legacy-a', score: 2 },
        { guestId: repo.create('Bea').guest.id, score: 1 },
      ],
    });
    repo.close();

    const reopened = new SqliteGuestRepository(file);
    const again = reopened.completeMatch({
      matchId: 'm-legacy',
      mode: 'private',
      seed: 999,
      commandLog: ['ignored on retry'],
      players: [
        { guestId: 'legacy-a', score: 0 },
        { guestId: 'also-ignored', score: 99 },
      ],
    });
    expect(again).toEqual(first);
    reopened.close();

    const inspected = new Database(file, { readonly: true });
    expect(
      inspected.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all(),
    ).toEqual([1, 2, 3, 4]);
    expect(
      inspected.prepare('SELECT games_played FROM guests WHERE id = ?').get('legacy-a'),
    ).toEqual({
      games_played: 1,
    });
    inspected.close();
  });

  it('marks an existing Phase 4 database without changing its history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'topthis-phase4-migration-'));
    paths.push(dir);
    const file = join(dir, 'phase4.sqlite');
    const legacy = new Database(file);
    legacy.exec(`CREATE TABLE guests (
      id TEXT PRIMARY KEY NOT NULL, display_name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL, rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0, ties INTEGER NOT NULL DEFAULT 0, games_played INTEGER NOT NULL DEFAULT 0
    ); CREATE TABLE completed_matches (
      match_id TEXT PRIMARY KEY NOT NULL, mode TEXT NOT NULL, completed_at INTEGER NOT NULL, seed INTEGER NOT NULL,
      command_log TEXT NOT NULL, result_json TEXT NOT NULL
    ); CREATE TABLE completed_match_players (
      match_id TEXT NOT NULL, guest_id TEXT NOT NULL, score INTEGER NOT NULL, placement INTEGER NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('win', 'loss', 'tie')), rating_before INTEGER NOT NULL,
      rating_after INTEGER NOT NULL, PRIMARY KEY (match_id, guest_id)
    )`);
    legacy
      .prepare('INSERT INTO guests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('phase4-a', 'Ada', 'hash', 1, 1017, 1, 0, 0, 1);
    legacy
      .prepare('INSERT INTO completed_matches VALUES (?, ?, ?, ?, ?, ?)')
      .run('old-match', 'private', 2, 3, '[]', '{"matchId":"old-match","ratings":{}}');
    legacy
      .prepare('INSERT INTO completed_match_players VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('old-match', 'phase4-a', 3, 1, 'win', 1000, 1017);
    legacy.close();

    const repo = new SqliteGuestRepository(file);
    expect(repo.leaderboard(1, 10).entries[0]).toMatchObject({
      guestId: 'phase4-a',
      rating: 1017,
      wins: 1,
    });
    repo.close();
    const reopened = new SqliteGuestRepository(file);
    reopened.close();

    const inspected = new Database(file, { readonly: true });
    expect(inspected.prepare('SELECT COUNT(*) AS count FROM completed_matches').get()).toEqual({
      count: 1,
    });
    expect(inspected.prepare('SELECT rating_after FROM completed_match_players').get()).toEqual({
      rating_after: 1017,
    });
    expect(inspected.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
      count: 4,
    });
    inspected.close();
  });

  it('persists opaque guests across reopen and stores only a token hash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'topthis-guests-'));
    paths.push(dir);
    const file = join(dir, 'guests.sqlite');
    const first = new SqliteGuestRepository(file);
    const issued = first.create('Ari');
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.findByToken(issued.token)).toEqual(issued.guest);
    expect(first.findByToken('wrong')).toBeUndefined();
    first.close();
    expect(readFileSync(file).includes(Buffer.from(issued.token))).toBe(false);
    const reopened = new SqliteGuestRepository(file);
    expect(reopened.findByToken(issued.token)).toEqual(issued.guest);
    expect(() => reopened.create('!!!')).toThrow();
    reopened.close();
  });
});
