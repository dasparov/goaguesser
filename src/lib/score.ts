export const MAX_POINTS = 5000;
export const MAX_GAME_POINTS = 25000;
const EARTH_RADIUS_M = 6371e3;

/**
 * A mode's distance scale — how misses map to points, emoji and the share-card
 * chart. City modes (Goa, Delhi) score within a single city; India scores
 * across the whole country, so it needs a far coarser scale or every round
 * would read as a near-total miss.
 */
export interface DistanceScale {
  /** Full points at or under this miss (metres). */
  fullWithinM: number;
  /** Zero points at or over this miss (metres). */
  zeroAtM: number;
  /** Ascending emoji thresholds; a miss gets the first bucket it's ≤. */
  emojiStops: Array<[m: number, emoji: string]>;
  /** The four share-card rings, inner→outer: [metres, label]. */
  ringStops: Array<[m: number, label: string]>;
}

// City scale — the original single-city behaviour (bullseye ≤25 m, zero ≥15 km).
export const CITY_SCALE: DistanceScale = {
  fullWithinM: 25,
  zeroAtM: 15000,
  emojiStops: [[100, '🎯'], [1000, '🟢'], [5000, '🟡'], [Infinity, '🔴']],
  ringStops: [[100, '100 m'], [1000, '1 km'], [5000, '5 km'], [15000, '15 km']],
};

// National scale — a 50 km bullseye out to a 2500 km total miss.
export const INDIA_SCALE: DistanceScale = {
  fullWithinM: 50000,
  zeroAtM: 2500000,
  emojiStops: [[50000, '🎯'], [250000, '🟢'], [1000000, '🟡'], [Infinity, '🔴']],
  ringStops: [[50000, '50 km'], [250000, '250 km'], [1000000, '1000 km'], [2500000, '2500 km']],
};

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointsForDistance(m: number, scale: DistanceScale = CITY_SCALE): number {
  if (m <= scale.fullWithinM) return MAX_POINTS;
  if (m >= scale.zeroAtM) return 0;
  return Math.round(MAX_POINTS * (1 - m / scale.zeroAtM) ** 2);
}

/** Inverse of pointsForDistance: the miss distance implied by a round score. */
export function missForPoints(points: number, scale: DistanceScale = CITY_SCALE): number {
  if (points >= MAX_POINTS) return scale.fullWithinM;
  if (points <= 0) return scale.zeroAtM;
  return scale.zeroAtM * (1 - Math.sqrt(points / MAX_POINTS));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`;
}

export function emojiForDistance(m: number, scale: DistanceScale = CITY_SCALE): string {
  // Bullseye is inclusive (≤); the middle bands are upper-exclusive (<), so a
  // miss exactly on a threshold falls into the coarser band — matching the
  // original city thresholds (1000 m → 🟡, 5000 m → 🔴).
  const [[b0, e0], [b1, e1], [b2, e2], [, e3]] = scale.emojiStops;
  if (m <= b0) return e0;
  if (m < b1) return e1;
  if (m < b2) return e2;
  return e3;
}
