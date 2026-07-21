import { poolAtVersion, type Location, type LocationPool } from './locations';

export const ROUNDS = 5;
export const BACKUPS = 2;

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * A deterministic seed for "today" — the daily rotating challenge. Everyone
 * playing the same local calendar day gets the same seed (hence the same
 * spots), and it rotates at local midnight. `salt` keeps each mode's daily
 * distinct, so India / Goa / Delhi each get their own challenge per day.
 */
export function dailySeed(salt: number, now: Date = new Date()): number {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  let h = (day ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export interface ChallengeCode {
  seed: number;
  poolVersion: number;
}

export function encodeChallenge(c: ChallengeCode): string {
  return `${c.seed.toString(36)}.${c.poolVersion.toString(36)}`;
}

export function decodeChallenge(s: string): ChallengeCode | null {
  const m = /^([0-9a-z]+)\.([0-9a-z]+)$/.exec(s);
  if (!m) return null;
  const seed = parseInt(m[1], 36);
  const poolVersion = parseInt(m[2], 36);
  if (!Number.isFinite(seed) || !Number.isFinite(poolVersion) || poolVersion < 1) return null;
  return { seed, poolVersion };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Deal {
  rounds: Location[];
  backups: Location[];
}

export function dealGame(
  pool: LocationPool,
  code: ChallengeCode,
  rounds: number = ROUNDS,
  backups: number = BACKUPS,
): Deal | null {
  if (code.poolVersion > pool.version) return null;
  const eligible = poolAtVersion(pool, code.poolVersion);
  const need = rounds + backups;
  // Non-repeating rotation: the seed is a game index. Each cycle is a distinct
  // shuffle of the whole pool, carved into non-overlapping game-sized slices;
  // consecutive indices walk those slices, so no spot repeats until the pool is
  // used up — then the next cycle reshuffles into a fresh order. Bigger pool →
  // more games before anything comes round again.
  const gamesPerCycle = Math.floor(eligible.length / need);
  if (gamesPerCycle < 1) return null;
  const g = code.seed >>> 0;
  const cycle = Math.floor(g / gamesPerCycle) >>> 0;
  const pos = g % gamesPerCycle;
  const shuffled = shuffle(eligible, mulberry32(cycle));
  const slice = shuffled.slice(pos * need, pos * need + need);
  return { rounds: slice.slice(0, rounds), backups: slice.slice(rounds, need) };
}
