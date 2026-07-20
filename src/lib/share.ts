import { decodeChallenge, encodeChallenge, ROUNDS, type ChallengeCode } from './seed';
import { emojiForDistance, MAX_GAME_POINTS, MAX_POINTS } from './score';

const SCORE_CHARS = 3; // base36: 'zzz' = 46655 ≥ 5000
const FIELD_SEP = '~'; // unreserved in RFC 3986, so it survives a query string intact
const SCORE_BLOCK = ROUNDS * SCORE_CHARS;

/** Most players a single link will carry. Beyond this the lowest scorer drops off. */
export const MAX_FIELD = 8;

export function formatPoints(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function encodeResults(scores: number[]): string {
  return scores.map((s) => s.toString(36).padStart(SCORE_CHARS, '0')).join('');
}

export function decodeResults(s: string): number[] | null {
  if (!new RegExp(`^[0-9a-z]{${SCORE_BLOCK}}$`).test(s)) return null;
  const scores: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const v = parseInt(s.slice(i * SCORE_CHARS, (i + 1) * SCORE_CHARS), 36);
    if (!Number.isFinite(v) || v > MAX_POINTS) return null;
    scores.push(v);
  }
  return scores;
}

/**
 * Names are rendered as plain text and packed into a URL, so keep them to
 * letters, digits and single spaces. This also removes FIELD_SEP, which would
 * otherwise split one player into two.
 */
export function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

export interface Player {
  name: string | null;
  scores: number[];
  total: number;
}

export function makePlayer(name: string | null, scores: number[]): Player {
  const clean = name ? sanitizeName(name) : '';
  return {
    name: clean || null,
    scores,
    total: scores.reduce((a, b) => a + b, 0),
  };
}

export function encodeField(field: Player[]): string {
  return field
    .slice(0, MAX_FIELD)
    .map((p) => encodeResults(p.scores) + (p.name ?? ''))
    .join(FIELD_SEP);
}

/** Unreadable entries are skipped; a mangled link degrades rather than failing. */
export function decodeField(s: string): Player[] {
  if (!s) return [];
  const field: Player[] = [];
  for (const entry of s.split(FIELD_SEP)) {
    const scores = decodeResults(entry.slice(0, SCORE_BLOCK));
    if (!scores) continue;
    field.push(makePlayer(entry.slice(SCORE_BLOCK) || null, scores));
    if (field.length === MAX_FIELD) break;
  }
  return field;
}

function sameName(a: Player, b: Player): boolean {
  return a.name !== null && b.name !== null && a.name.toLowerCase() === b.name.toLowerCase();
}

/**
 * Adds (or replaces) a player, keeps the board sorted, and trims the tail.
 * `me` is always present in the result: when the board is full, the lowest
 * scorer among everyone else is dropped instead, even if that's `me`'s own
 * score that's actually lowest overall.
 */
export function addToField(field: Player[], me: Player): Player[] {
  const others = field.filter((p) => !sameName(p, me)).sort((a, b) => b.total - a.total);
  return [...others.slice(0, MAX_FIELD - 1), me].sort((a, b) => b.total - a.total);
}

export function standings(field: Player[]): Array<{ position: number; player: Player }> {
  return [...field]
    .sort((a, b) => b.total - a.total)
    .map((player, i) => ({ position: i + 1, player }));
}

export function parseGameParams(search: string): {
  code: ChallengeCode | null;
  field: Player[];
} {
  const params = new URLSearchParams(search);
  return {
    code: params.has('c') ? decodeChallenge(params.get('c')!) : null,
    field: params.has('p') ? decodeField(params.get('p')!) : [],
  };
}

export function buildShareUrl(baseUrl: string, code: ChallengeCode, field: Player[]): string {
  const url = new URL(baseUrl);
  url.searchParams.set('c', encodeChallenge(code));
  url.searchParams.set('p', encodeField(field));
  return url.toString();
}

const RANKS: Array<[number, string]> = [
  [23001, 'True Goenkar'],
  [18001, 'Poder of the Village'],
  [12001, 'Susegad Local'],
  [6001, 'Beach Regular'],
  [0, 'Confused Tourist'],
];

export function rankForScore(total: number): string {
  return RANKS.find(([min]) => total >= min)![1];
}

export function emojiBar(distances: number[]): string {
  return distances.map(emojiForDistance).join('');
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function buildShareText(opts: {
  rank: string;
  bar: string;
  total: number;
  url: string;
  position: number;
  fieldSize: number;
}): string {
  const head =
    `Backyard: Goa 🏖️ — ${opts.rank}\n` +
    `${opts.bar} ${formatPoints(opts.total)} / ${formatPoints(MAX_GAME_POINTS)}\n`;
  // Alone on the board, it's a direct challenge; with a field, it's an invitation to join.
  return opts.fieldSize > 1
    ? head + `${ordinal(opts.position)} of ${opts.fieldSize} on the board\nAdd yours: ${opts.url}`
    : head + `Beat me: ${opts.url}`;
}
