import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { DisplayNameSchema, type Guest } from '@topthis/shared';

export const hashGuestToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface GuestRepository {
  create(displayName: string): { guest: Guest; token: string };
  findByToken(token: string): Guest | undefined;
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`);
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
  close(): void {
    this.db.close();
  }
}
