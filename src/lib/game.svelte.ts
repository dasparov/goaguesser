import type { Location } from './locations';
import { ROUNDS, type Deal } from './seed';
import { haversineM, pointsForDistance } from './score';

export type Phase = 'playing' | 'scored' | 'summary' | 'error';

export interface RoundResult {
  location: Location;
  guessLat: number;
  guessLng: number;
  distanceM: number;
  points: number;
}

export function createGame(deal: Deal) {
  const rounds = $state([...deal.rounds]);
  const backups = $state([...deal.backups]);
  let roundIndex = $state(0);
  let phase = $state<Phase>('playing');
  let guess = $state<{ lat: number; lng: number } | null>(null);
  const results = $state<RoundResult[]>([]);

  return {
    get phase() { return phase; },
    get roundIndex() { return roundIndex; },
    get currentLocation() { return rounds[roundIndex]; },
    get guess() { return guess; },
    get results() { return results; },
    get totalScore() { return results.reduce((a, r) => a + r.points, 0); },

    pin(lat: number, lng: number) {
      if (phase !== 'playing') return;
      guess = { lat, lng };
    },

    submit() {
      if (phase !== 'playing' || !guess) return;
      const loc = rounds[roundIndex];
      const distanceM = haversineM(guess.lat, guess.lng, loc.lat, loc.lng);
      results.push({
        location: loc,
        guessLat: guess.lat,
        guessLng: guess.lng,
        distanceM,
        points: pointsForDistance(distanceM),
      });
      phase = 'scored';
    },

    next() {
      if (phase !== 'scored') return;
      guess = null;
      if (roundIndex < ROUNDS - 1) {
        roundIndex += 1;
        phase = 'playing';
      } else {
        phase = 'summary';
      }
    },

    substituteCurrent(): boolean {
      if (phase !== 'playing') return false;
      const backup = backups.shift();
      if (!backup) {
        phase = 'error';
        return false;
      }
      rounds[roundIndex] = backup;
      return true;
    },
  };
}
