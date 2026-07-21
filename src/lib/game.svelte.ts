import type { Location } from './locations';
import type { Deal } from './seed';
import { haversineM, pointsForDistance } from './score';

export type Phase = 'playing' | 'scored' | 'summary' | 'error';

// Distance recorded for a round the player let time out without dropping a pin
// — the score module's zero-points threshold, so it reads as a full miss.
const TIMEOUT_MISS_M = 15000;

export interface RoundResult {
  location: Location;
  guessLat: number | null;
  guessLng: number | null;
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

  // Score the current round. A pin scores by distance; no pin (timer ran out)
  // is a full miss worth nothing.
  function score() {
    const loc = rounds[roundIndex];
    if (guess) {
      const distanceM = haversineM(guess.lat, guess.lng, loc.lat, loc.lng);
      results.push({
        location: loc,
        guessLat: guess.lat,
        guessLng: guess.lng,
        distanceM,
        points: pointsForDistance(distanceM),
      });
    } else {
      results.push({
        location: loc,
        guessLat: null,
        guessLng: null,
        distanceM: TIMEOUT_MISS_M,
        points: 0,
      });
    }
    phase = 'scored';
  }

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
      score();
    },

    /** Timer expiry: score the round even with no pin (a 0-point miss). */
    forceSubmit() {
      if (phase !== 'playing') return;
      score();
    },

    next() {
      if (phase !== 'scored') return;
      guess = null;
      if (roundIndex < rounds.length - 1) {
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
