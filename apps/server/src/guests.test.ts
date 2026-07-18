import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGuestRepository } from './guests.js';

const paths: string[] = [];
afterEach(() => {
  for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
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
