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
  if (eligible.length < rounds + backups) return null;
  const shuffled = shuffle(eligible, mulberry32(code.seed));
  return { rounds: shuffled.slice(0, rounds), backups: shuffled.slice(rounds, rounds + backups) };
}
