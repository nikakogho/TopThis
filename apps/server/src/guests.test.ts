import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateElo, SqliteGuestRepository } from './guests.js';

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
});

describe('SqliteGuestRepository', () => {
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
