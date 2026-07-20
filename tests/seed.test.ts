import { describe, it, expect } from 'vitest';
import {
  mulberry32, encodeChallenge, decodeChallenge, dealGame, ROUNDS, BACKUPS,
} from '../src/lib/seed';
import type { LocationPool } from '../src/lib/locations';

function makePool(count: number, version = 1): LocationPool {
  return {
    version,
    locations: Array.from({ length: count }, (_, i) => ({
      imageId: `img${i}`, name: `Spot ${i}`, lat: 15 + i * 0.01, lng: 73.8, version: 1,
    })),
  };
}

describe('mulberry32', () => {
  it('is deterministic', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('yields values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('challenge codes', () => {
  it('round-trips', () => {
    const code = { seed: 3735928559, poolVersion: 3 };
    expect(decodeChallenge(encodeChallenge(code))).toEqual(code);
  });
  it.each(['', 'garbage!', '1.2.3', 'xyz.', '.5'])('rejects %j', (s) => {
    expect(decodeChallenge(s)).toBeNull();
  });
});

describe('dealGame', () => {
  it('deals 5 rounds + 2 backups, all distinct', () => {
    const deal = dealGame(makePool(10), { seed: 1, poolVersion: 1 })!;
    expect(deal.rounds).toHaveLength(ROUNDS);
    expect(deal.backups).toHaveLength(BACKUPS);
    const ids = [...deal.rounds, ...deal.backups].map((l) => l.imageId);
    expect(new Set(ids).size).toBe(ROUNDS + BACKUPS);
  });
  it('same code → identical deal', () => {
    const a = dealGame(makePool(20), { seed: 99, poolVersion: 1 })!;
    const b = dealGame(makePool(20), { seed: 99, poolVersion: 1 })!;
    expect(a).toEqual(b);
  });
  it('different seeds → different deals (for a 20-spot pool)', () => {
    const a = dealGame(makePool(20), { seed: 1, poolVersion: 1 })!;
    const b = dealGame(makePool(20), { seed: 2, poolVersion: 1 })!;
    expect(a.rounds.map((l) => l.imageId)).not.toEqual(b.rounds.map((l) => l.imageId));
  });
  it('old codes replay identically after the pool grows', () => {
    const oldPool = makePool(10);
    const grown: LocationPool = {
      version: 2,
      locations: [
        ...oldPool.locations,
        { imageId: 'new1', name: 'New', lat: 15.6, lng: 74.0, version: 2 },
      ],
    };
    const code = { seed: 5, poolVersion: 1 };
    expect(dealGame(grown, code)).toEqual(dealGame(oldPool, code));
  });
  it('returns null when pool is too small', () => {
    expect(dealGame(makePool(6), { seed: 1, poolVersion: 1 })).toBeNull();
  });
  it('returns null for a future pool version', () => {
    expect(dealGame(makePool(10), { seed: 1, poolVersion: 99 })).toBeNull();
  });
});
