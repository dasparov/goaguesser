import { describe, it, expect } from 'vitest';
import { haversineM, pointsForDistance, formatDistance, emojiForDistance } from '../src/lib/score';

describe('haversineM', () => {
  it('is zero for identical points', () => {
    expect(haversineM(15.5, 73.8, 15.5, 73.8)).toBe(0);
  });
  it('measures one degree of latitude as ~111.2 km', () => {
    expect(haversineM(15, 73.8, 16, 73.8)).toBeCloseTo(111195, -3); // ±500 m
  });
  it('is symmetric', () => {
    expect(haversineM(15.49, 73.82, 15.27, 73.95)).toBeCloseTo(haversineM(15.27, 73.95, 15.49, 73.82), 6);
  });
});

describe('pointsForDistance', () => {
  it('gives max points at and under 25 m', () => {
    expect(pointsForDistance(0)).toBe(5000);
    expect(pointsForDistance(25)).toBe(5000);
  });
  it('gives zero at and beyond 15 km', () => {
    expect(pointsForDistance(15000)).toBe(0);
    expect(pointsForDistance(80000)).toBe(0);
  });
  it('follows the quadratic curve between', () => {
    expect(pointsForDistance(7500)).toBe(1250); // 5000 * 0.5^2
  });
  it('is monotonically non-increasing', () => {
    let prev = Infinity;
    for (let d = 0; d <= 16000; d += 250) {
      const p = pointsForDistance(d);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('formatDistance', () => {
  it('uses meters under 1 km', () => expect(formatDistance(340.4)).toBe('340 m away'));
  it('uses km with one decimal from 1 km', () => expect(formatDistance(4230)).toBe('4.2 km away'));
});

describe('emojiForDistance', () => {
  it.each([
    [50, '🎯'], [100, '🎯'], [101, '🟢'], [999, '🟢'],
    [1000, '🟡'], [4999, '🟡'], [5000, '🔴'], [60000, '🔴'],
  ])('%d m → %s', (m, e) => expect(emojiForDistance(m)).toBe(e));
});
