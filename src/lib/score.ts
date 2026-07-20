export const MAX_POINTS = 5000;
export const MAX_GAME_POINTS = 25000;
const FULL_POINTS_WITHIN_M = 25;
const ZERO_POINTS_AT_M = 15000;
const EARTH_RADIUS_M = 6371e3;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointsForDistance(m: number): number {
  if (m <= FULL_POINTS_WITHIN_M) return MAX_POINTS;
  if (m >= ZERO_POINTS_AT_M) return 0;
  return Math.round(MAX_POINTS * (1 - m / ZERO_POINTS_AT_M) ** 2);
}

/** Inverse of pointsForDistance: the miss distance implied by a round score. */
export function missForPoints(points: number): number {
  if (points >= MAX_POINTS) return FULL_POINTS_WITHIN_M;
  if (points <= 0) return ZERO_POINTS_AT_M;
  return ZERO_POINTS_AT_M * (1 - Math.sqrt(points / MAX_POINTS));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`;
}

export function emojiForDistance(m: number): string {
  if (m <= 100) return '🎯';
  if (m < 1000) return '🟢';
  if (m < 5000) return '🟡';
  return '🔴';
}
