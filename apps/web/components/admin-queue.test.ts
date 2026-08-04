import { describe, expect, it } from 'vitest';
import { hasInstanceQueue } from './admin-queue';

describe('hasInstanceQueue', () => {
  it('hides a retained queue when instance data is unavailable', () => {
    expect(hasInstanceQueue(false, { counts: { waiting: 1 }, failed: [] })).toBe(false);
  });
});
