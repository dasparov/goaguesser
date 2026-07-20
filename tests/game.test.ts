import { describe, it, expect } from 'vitest';
import { createGame } from '../src/lib/game.svelte';
import type { Deal } from '../src/lib/seed';

function makeDeal(): Deal {
  const loc = (i: number) => ({
    imageId: `img${i}`, name: `Spot ${i}`, lat: 15.5 + i * 0.001, lng: 73.8, version: 1,
  });
  return { rounds: [loc(0), loc(1), loc(2), loc(3), loc(4)], backups: [loc(5), loc(6)] };
}

describe('createGame', () => {
  it('starts playing round 0', () => {
    const g = createGame(makeDeal());
    expect(g.phase).toBe('playing');
    expect(g.roundIndex).toBe(0);
    expect(g.currentLocation.imageId).toBe('img0');
    expect(g.totalScore).toBe(0);
  });

  it('ignores submit without a pin', () => {
    const g = createGame(makeDeal());
    g.submit();
    expect(g.phase).toBe('playing');
  });

  it('scores a perfect guess with 5000', () => {
    const g = createGame(makeDeal());
    g.pin(g.currentLocation.lat, g.currentLocation.lng);
    g.submit();
    expect(g.phase).toBe('scored');
    expect(g.results[0].points).toBe(5000);
    expect(g.results[0].distanceM).toBe(0);
    expect(g.totalScore).toBe(5000);
  });

  it('ignores pins while scored', () => {
    const g = createGame(makeDeal());
    g.pin(15.5, 73.8);
    g.submit();
    g.pin(14.9, 74.2);
    expect(g.results).toHaveLength(1);
    expect(g.phase).toBe('scored');
  });

  it('advances through 5 rounds to summary', () => {
    const g = createGame(makeDeal());
    for (let i = 0; i < 5; i++) {
      expect(g.roundIndex).toBe(i);
      g.pin(g.currentLocation.lat, g.currentLocation.lng);
      g.submit();
      g.next();
    }
    expect(g.phase).toBe('summary');
    expect(g.totalScore).toBe(25000);
    expect(g.results).toHaveLength(5);
  });

  it('substitutes the current round from backups, deterministically in order', () => {
    const g = createGame(makeDeal());
    expect(g.substituteCurrent()).toBe(true);
    expect(g.currentLocation.imageId).toBe('img5');
    expect(g.substituteCurrent()).toBe(true);
    expect(g.currentLocation.imageId).toBe('img6');
    expect(g.substituteCurrent()).toBe(false);
    expect(g.phase).toBe('error');
  });

  it('only substitutes while playing', () => {
    const g = createGame(makeDeal());
    g.pin(15.5, 73.8);
    g.submit();
    expect(g.substituteCurrent()).toBe(false);
    expect(g.phase).toBe('scored');
  });
});
