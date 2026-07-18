import { describe, expect, it } from 'vitest';
import {
  ClientHandshakeSchema,
  GuestProfileCreationIntentSchema,
  HealthResponseSchema,
  SafeIdSchema,
} from './index.js';

describe('shared boundary contracts', () => {
  it('accepts a valid guest profile creation intent', () => {
    expect(
      GuestProfileCreationIntentSchema.parse({ displayName: 'Ari Stone', requestId: 'guest_01' }),
    ).toEqual({ displayName: 'Ari Stone', requestId: 'guest_01' });
  });

  it('rejects malformed public input', () => {
    expect(() => SafeIdSchema.parse('../../private-state')).toThrow();
    expect(() => GuestProfileCreationIntentSchema.parse({ displayName: '   ' })).toThrow();
    expect(() => ClientHandshakeSchema.parse({ protocolVersion: 2 })).toThrow();
    expect(() =>
      HealthResponseSchema.parse({ service: 'TopThis Server', status: 'debug' }),
    ).toThrow();
  });
});
