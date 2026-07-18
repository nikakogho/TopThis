import { describe, expect, it } from 'vitest';
import { gameEnginePackage } from './index';
describe('game engine boundary', () => {
  it('exports package identity', () => expect(gameEnginePackage).toBe('@topthis/game-engine'));
});
