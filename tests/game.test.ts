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
    expect(g.results).toHaveLength(0);
    expect(g.roundIndex).toBe(0);
  });

  it('submitting twice for the same round records only one result', () => {
    const g = createGame(makeDeal());
    g.pin(g.currentLocation.lat, g.currentLocation.lng);
    g.submit();
    expect(g.results).toHaveLength(1);
    g.submit();
    expect(g.results).toHaveLength(1);
    expect(g.phase).toBe('scored');
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

  it('calling next() again after reaching summary is a no-op', () => {
    const g = createGame(makeDeal());
    for (let i = 0; i < 5; i++) {
      g.pin(g.currentLocation.lat, g.currentLocation.lng);
      g.submit();
      g.next();
    }
    expect(g.phase).toBe('summary');
    const roundIndexAtSummary = g.roundIndex;
    const resultsAtSummary = g.results.length;

    g.next();

    expect(g.phase).toBe('summary');
    expect(g.roundIndex).toBe(roundIndexAtSummary);
    expect(g.results).toHaveLength(resultsAtSummary);
  });

  it('records the substituted location, not the original, once submitted', () => {
    const g = createGame(makeDeal());
    const original = g.currentLocation;
    expect(g.substituteCurrent()).toBe(true);
    const substituted = g.currentLocation;
    expect(substituted.imageId).not.toBe(original.imageId);

    g.pin(substituted.lat, substituted.lng);
    g.submit();

    expect(g.results[0].location.imageId).toBe(substituted.imageId);
    expect(g.results[0].distanceM).toBe(0);
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

  it('pin() and submit() are no-ops once both backups are exhausted', () => {
    const g = createGame(makeDeal());
    expect(g.substituteCurrent()).toBe(true);
    expect(g.substituteCurrent()).toBe(true);
    expect(g.substituteCurrent()).toBe(false);
    expect(g.phase).toBe('error');

    g.pin(15.5, 73.8);
    expect(g.guess).toBeNull();

    g.submit();
    expect(g.results).toHaveLength(0);
    expect(g.phase).toBe('error');
  });
});
