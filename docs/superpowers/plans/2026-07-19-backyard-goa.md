# Backyard: Goa Edition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, backend-free GeoGuessr-style game for Goa: 5 rounds of guess-the-panorama with seeded challenge links, head-to-head ghost competition, and a shareable scorecard.

**Architecture:** Svelte 5 (runes) + Vite static SPA. All game logic (scoring, seeding, share encoding, state machine) lives in pure/plain TS modules under `src/lib/` and is unit-tested with Vitest; the only files touching mapillary-js and Leaflet are two wrapper components. Locations are generated into `src/data/locations.json` by a curation script that derives coordinates from Mapillary image IDs.

**Tech Stack:** Svelte 5, TypeScript, Vite, Tailwind CSS v4, mapillary-js v4, Leaflet 1.9, Vitest, tsx (script runner), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-19-backyard-goa-design.md` — read it first.

## Global Constraints

- Svelte 5 **runes** syntax only: `$state`, `$derived`, `$props`, `$effect`, `onclick` (never `on:click`, never Svelte-4 implicit reactivity).
- No backend, no serverless functions, no analytics. Only external calls: Mapillary API/tiles, CartoDB tiles.
- Map tiles: CartoDB Positron **No Labels** — `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png`.
- Mapillary viewer components `sequence`, `direction`, `tag`, `popup`, `cover`, `keyboard` all **disabled** (look-around only; `direction` and `keyboard` can navigate).
- All Leaflet markers use `L.divIcon` (never the default icon — its assets break under Vite).
- Scoring: 5,000 max/round; full points ≤ 25 m; 0 at ≥ 15,000 m; between: `5000 × (1 − d/15000)²`, rounded.
- Game deals **5 rounds + 2 backups**. `ROUNDS = 5`, `BACKUPS = 2`.
- `src/data/locations.json` is generated — never hand-edited. Append-only; entries carry `version`.
- Goa bounding box for curation: lat 14.85–15.85, lng 73.65–74.35.
- Build must fail if `VITE_MAPILLARY_TOKEN` is unset (production mode).
- Attribution for Mapillary, OpenStreetMap, and CARTO must be visible in the UI at all times.
- Emoji distance bands: 🎯 ≤ 100 m · 🟢 < 1 km · 🟡 < 5 km · 🔴 ≥ 5 km.
- Rank titles (total score): 0–6000 Confused Tourist · 6001–12000 Beach Regular · 12001–18000 Susegad Local · 18001–23000 Poder of the Village · 23001–25000 True Goenkar.
- Commit after every green test cycle. Conventional-commit style messages (`feat:`, `test:`, `chore:`).

**Manual prerequisites (owner: Kapil, needed from Task 9 onward):** a free Mapillary client token in `.env`, and ≥ 7 real curated locations via the Task 7 script. Tasks 1–8 run fully without either.

---

### Task 1: Project scaffold

**Files:**
- Create: entire Vite project in repo root (`package.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/app.css`, `src/App.svelte`, `tsconfig.json` via template)
- Create: `.env.example`, `.gitignore` addition, `tests/smoke.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm test`, `npm run build`; env var `VITE_MAPILLARY_TOKEN`; Tailwind + Leaflet + Mapillary CSS available globally.

- [ ] **Step 1: Scaffold Vite + Svelte 5 + TS into the existing repo**

```bash
cd /Users/kapil/Documents/bckyrd
npm create vite@latest . -- --template svelte-ts
npm install
npm install leaflet mapillary-js
npm install -D @types/leaflet vitest tailwindcss @tailwindcss/vite tsx
```

If `npm create vite` balks at the non-empty directory (docs/, .git), let it scaffold into `tmp-scaffold/` and move everything up: `npm create vite@latest tmp-scaffold -- --template svelte-ts && rsync -a tmp-scaffold/ ./ && rm -rf tmp-scaffold` — then run the installs.

- [ ] **Step 2: Replace `vite.config.ts` with token gate + Tailwind + Vitest config**

```ts
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !env.VITE_MAPILLARY_TOKEN) {
    throw new Error(
      'VITE_MAPILLARY_TOKEN is not set. Copy .env.example to .env and add your Mapillary client token.'
    );
  }
  return {
    base: './',
    plugins: [svelte(), tailwindcss()],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
```

- [ ] **Step 3: Wire global CSS**

Replace `src/app.css` entirely with:

```css
@import 'tailwindcss';
@import 'leaflet/dist/leaflet.css';
@import 'mapillary-js/dist/mapillary.css';
```

Confirm `src/main.ts` imports `./app.css` (the template does). Replace the template's `src/App.svelte` body with a placeholder that proves Tailwind works:

```svelte
<main class="w-full h-screen flex items-center justify-center bg-slate-950 text-amber-400 font-bold text-2xl">
  Backyard: Goa — scaffold OK
</main>
```

Delete `src/lib/Counter.svelte` and `src/assets/` if the template created them.

- [ ] **Step 4: Create `.env.example` and a smoke test**

`.env.example`:

```
# Free client token from https://www.mapillary.com/dashboard/developers
VITE_MAPILLARY_TOKEN=MLY|xxxx|xxxx
```

Ensure `.gitignore` contains `.env` (append if missing). Add `"test": "vitest run"` to package.json scripts.

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Verify everything**

```bash
npm test                 # PASS: 1 test
npm run build            # FAIL: "VITE_MAPILLARY_TOKEN is not set"
echo 'VITE_MAPILLARY_TOKEN=MLY|dummy|dummy' > .env
npm run build            # PASS: dist/ produced
npm run dev              # loads http://localhost:5173 showing "scaffold OK" (manual check, then Ctrl-C)
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Svelte 5 + Vite + Tailwind + Vitest with Mapillary token gate"
```

---

### Task 2: Scoring module (`score.ts`)

**Files:**
- Create: `src/lib/score.ts`
- Test: `tests/score.test.ts`

**Interfaces:**
- Produces: `haversineM(lat1, lng1, lat2, lng2): number` · `pointsForDistance(m: number): number` · `formatDistance(m: number): string` · `emojiForDistance(m: number): string` · constants `MAX_POINTS = 5000`, `MAX_GAME_POINTS = 25000`.

- [ ] **Step 1: Write failing tests** — `tests/score.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve `../src/lib/score`.

- [ ] **Step 3: Implement** — `src/lib/score.ts`:

```ts
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

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`;
}

export function emojiForDistance(m: number): string {
  if (m <= 100) return '🎯';
  if (m < 1000) return '🟢';
  if (m < 5000) return '🟡';
  return '🔴';
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS (all score tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score.ts tests/score.test.ts
git commit -m "feat: scoring — haversine, points curve, distance format, emoji bands"
```

---

### Task 3: Location types & pool (`locations.ts`)

**Files:**
- Create: `src/lib/locations.ts`, `src/data/locations.json`
- Test: `tests/locations.test.ts`

**Interfaces:**
- Produces: `interface Location { imageId: string; name: string; lat: number; lng: number; version: number }` · `interface LocationPool { version: number; locations: Location[] }` · `poolAtVersion(pool, version): Location[]` · `loadPool(): LocationPool`.

- [ ] **Step 1: Write failing tests** — `tests/locations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { poolAtVersion, type LocationPool } from '../src/lib/locations';

const pool: LocationPool = {
  version: 2,
  locations: [
    { imageId: 'a', name: 'A', lat: 15.5, lng: 73.8, version: 1 },
    { imageId: 'b', name: 'B', lat: 15.4, lng: 73.9, version: 1 },
    { imageId: 'c', name: 'C', lat: 15.3, lng: 74.0, version: 2 },
  ],
};

describe('poolAtVersion', () => {
  it('includes only entries at or below the requested version', () => {
    expect(poolAtVersion(pool, 1).map((l) => l.imageId)).toEqual(['a', 'b']);
  });
  it('includes everything at the current version', () => {
    expect(poolAtVersion(pool, 2)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve module.

- [ ] **Step 3: Implement** — `src/lib/locations.ts`:

```ts
import poolJson from '../data/locations.json';

export interface Location {
  imageId: string;
  name: string;
  lat: number;
  lng: number;
  version: number;
}

export interface LocationPool {
  version: number;
  locations: Location[];
}

export function poolAtVersion(pool: LocationPool, version: number): Location[] {
  return pool.locations.filter((l) => l.version <= version);
}

export function loadPool(): LocationPool {
  return poolJson as LocationPool;
}
```

And the starter `src/data/locations.json` (empty pool — the Task 7 script fills it):

```json
{
  "version": 1,
  "locations": []
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/locations.ts src/data/locations.json tests/locations.test.ts
git commit -m "feat: location pool types with version filtering"
```

---

### Task 4: Seeding & dealing (`seed.ts`)

**Files:**
- Create: `src/lib/seed.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: `LocationPool`, `Location`, `poolAtVersion` from `src/lib/locations.ts`.
- Produces: `ROUNDS = 5` · `BACKUPS = 2` · `mulberry32(seed: number): () => number` · `randomSeed(): number` · `interface ChallengeCode { seed: number; poolVersion: number }` · `encodeChallenge(c: ChallengeCode): string` · `decodeChallenge(s: string): ChallengeCode | null` · `interface Deal { rounds: Location[]; backups: Location[] }` · `dealGame(pool: LocationPool, code: ChallengeCode): Deal | null`.

- [ ] **Step 1: Write failing tests** — `tests/seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  mulberry32, encodeChallenge, decodeChallenge, dealGame, ROUNDS, BACKUPS,
} from '../src/lib/seed';
import type { LocationPool } from '../src/lib/locations';

function makePool(count: number, version = 1): LocationPool {
  return {
    version,
    locations: Array.from({ length: count }, (_, i) => ({
      imageId: `img${i}`, name: `Spot ${i}`, lat: 15 + i * 0.01, lng: 73.8, version: 1,
    })),
  };
}

describe('mulberry32', () => {
  it('is deterministic', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('yields values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('challenge codes', () => {
  it('round-trips', () => {
    const code = { seed: 3735928559, poolVersion: 3 };
    expect(decodeChallenge(encodeChallenge(code))).toEqual(code);
  });
  it.each(['', 'garbage!', '1.2.3', 'xyz.', '.5'])('rejects %j', (s) => {
    expect(decodeChallenge(s)).toBeNull();
  });
});

describe('dealGame', () => {
  it('deals 5 rounds + 2 backups, all distinct', () => {
    const deal = dealGame(makePool(10), { seed: 1, poolVersion: 1 })!;
    expect(deal.rounds).toHaveLength(ROUNDS);
    expect(deal.backups).toHaveLength(BACKUPS);
    const ids = [...deal.rounds, ...deal.backups].map((l) => l.imageId);
    expect(new Set(ids).size).toBe(ROUNDS + BACKUPS);
  });
  it('same code → identical deal', () => {
    const a = dealGame(makePool(20), { seed: 99, poolVersion: 1 })!;
    const b = dealGame(makePool(20), { seed: 99, poolVersion: 1 })!;
    expect(a).toEqual(b);
  });
  it('different seeds → different deals (for a 20-spot pool)', () => {
    const a = dealGame(makePool(20), { seed: 1, poolVersion: 1 })!;
    const b = dealGame(makePool(20), { seed: 2, poolVersion: 1 })!;
    expect(a.rounds.map((l) => l.imageId)).not.toEqual(b.rounds.map((l) => l.imageId));
  });
  it('old codes replay identically after the pool grows', () => {
    const oldPool = makePool(10);
    const grown: LocationPool = {
      version: 2,
      locations: [
        ...oldPool.locations,
        { imageId: 'new1', name: 'New', lat: 15.6, lng: 74.0, version: 2 },
      ],
    };
    const code = { seed: 5, poolVersion: 1 };
    expect(dealGame(grown, code)).toEqual(dealGame(oldPool, code));
  });
  it('returns null when pool is too small', () => {
    expect(dealGame(makePool(6), { seed: 1, poolVersion: 1 })).toBeNull();
  });
  it('returns null for a future pool version', () => {
    expect(dealGame(makePool(10), { seed: 1, poolVersion: 99 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve module.

- [ ] **Step 3: Implement** — `src/lib/seed.ts`:

```ts
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

export function dealGame(pool: LocationPool, code: ChallengeCode): Deal | null {
  if (code.poolVersion > pool.version) return null;
  const eligible = poolAtVersion(pool, code.poolVersion);
  if (eligible.length < ROUNDS + BACKUPS) return null;
  const shuffled = shuffle(eligible, mulberry32(code.seed));
  return { rounds: shuffled.slice(0, ROUNDS), backups: shuffled.slice(ROUNDS, ROUNDS + BACKUPS) };
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seed.ts tests/seed.test.ts
git commit -m "feat: seeded RNG, challenge codes, deterministic 5+2 deal with pool-version pinning"
```

---

### Task 5: Share & competition encoding (`share.ts`)

**Files:**
- Create: `src/lib/share.ts`
- Test: `tests/share.test.ts`

**Interfaces:**
- Consumes: `ChallengeCode`, `encodeChallenge`, `decodeChallenge`, `ROUNDS` from `seed.ts`; `emojiForDistance`, `MAX_POINTS`, `MAX_GAME_POINTS` from `score.ts`.
- Produces: `encodeResults(scores: number[]): string` · `decodeResults(s: string): number[] | null` · `sanitizeName(raw: string): string` · `interface Challenger { name: string | null; scores: number[]; total: number }` · `parseGameParams(search: string): { code: ChallengeCode | null; challenger: Challenger | null }` · `buildShareUrl(baseUrl: string, code: ChallengeCode, scores: number[], name: string | null): string` · `rankForScore(total: number): string` · `emojiBar(distances: number[]): string` · `buildShareText(opts: { rank: string; bar: string; total: number; url: string }): string` · `formatPoints(n: number): string`.

- [ ] **Step 1: Write failing tests** — `tests/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  encodeResults, decodeResults, sanitizeName, parseGameParams,
  buildShareUrl, rankForScore, emojiBar, buildShareText, formatPoints,
} from '../src/lib/share';

describe('formatPoints', () => {
  it('groups thousands with commas', () => {
    expect(formatPoints(18240)).toBe('18,240');
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(25000)).toBe('25,000');
  });
});

describe('result encoding', () => {
  it('round-trips five scores', () => {
    const scores = [5000, 0, 1250, 4999, 320];
    expect(decodeResults(encodeResults(scores))).toEqual(scores);
  });
  it('encodes to exactly 15 base36 chars', () => {
    expect(encodeResults([0, 0, 0, 0, 0])).toMatch(/^[0-9a-z]{15}$/);
  });
  it.each(['', 'short', '!'.repeat(15)])('rejects malformed %j', (s) => {
    expect(decodeResults(s)).toBeNull();
  });
  it('rejects scores above 5000', () => {
    // 'zzz' base36 = 46655 > 5000
    expect(decodeResults('zzz' + '000'.repeat(4))).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('trims and caps at 20 chars', () => {
    expect(sanitizeName('  ' + 'a'.repeat(30))).toBe('a'.repeat(20));
  });
  it('strips angle brackets, ampersands and quotes', () => {
    expect(sanitizeName('<b>K&"a\'p</b>')).toBe('bKap/b');
  });
});

describe('parseGameParams', () => {
  it('parses a full challenge URL', () => {
    const r = encodeResults([1000, 2000, 3000, 4000, 5000]);
    const { code, challenger } = parseGameParams(`?c=5.1&r=${r}&n=Kapil`);
    expect(code).toEqual({ seed: 5, poolVersion: 1 });
    expect(challenger).toEqual({ name: 'Kapil', scores: [1000, 2000, 3000, 4000, 5000], total: 15000 });
  });
  it('gives a nameless challenger without n', () => {
    const r = encodeResults([0, 0, 0, 0, 0]);
    expect(parseGameParams(`?c=5.1&r=${r}`).challenger?.name).toBeNull();
  });
  it('drops the challenger on malformed r but keeps the code', () => {
    const { code, challenger } = parseGameParams('?c=5.1&r=nonsense');
    expect(code).toEqual({ seed: 5, poolVersion: 1 });
    expect(challenger).toBeNull();
  });
  it('returns nulls for an empty query', () => {
    expect(parseGameParams('')).toEqual({ code: null, challenger: null });
  });
});

describe('buildShareUrl', () => {
  it('builds a decodable URL', () => {
    const url = buildShareUrl('https://x.test/', { seed: 9, poolVersion: 2 }, [1, 2, 3, 4, 5], 'Kapil');
    const { code, challenger } = parseGameParams(new URL(url).search);
    expect(code).toEqual({ seed: 9, poolVersion: 2 });
    expect(challenger?.scores).toEqual([1, 2, 3, 4, 5]);
    expect(challenger?.name).toBe('Kapil');
  });
});

describe('rankForScore', () => {
  it.each([
    [0, 'Confused Tourist'], [6000, 'Confused Tourist'],
    [6001, 'Beach Regular'], [12000, 'Beach Regular'],
    [12001, 'Susegad Local'], [18000, 'Susegad Local'],
    [18001, 'Poder of the Village'], [23000, 'Poder of the Village'],
    [23001, 'True Goenkar'], [25000, 'True Goenkar'],
  ])('%d → %s', (score, rank) => expect(rankForScore(score)).toBe(rank));
});

describe('emojiBar & share text', () => {
  it('maps distances to the emoji story', () => {
    expect(emojiBar([50, 500, 3000, 9000, 101])).toBe('🎯🟢🟡🔴🟢');
  });
  it('builds the share text', () => {
    expect(
      buildShareText({ rank: 'Susegad Local', bar: '🎯🟢🔴🟢🟡', total: 18240, url: 'https://x.test/?c=a.1' })
    ).toBe('Backyard: Goa 🏖️ — Susegad Local\n🎯🟢🔴🟢🟡 18,240 / 25,000\nBeat me: https://x.test/?c=a.1');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve module.

- [ ] **Step 3: Implement** — `src/lib/share.ts`:

```ts
import { decodeChallenge, encodeChallenge, ROUNDS, type ChallengeCode } from './seed';
import { emojiForDistance, MAX_GAME_POINTS, MAX_POINTS } from './score';

const SCORE_CHARS = 3; // base36: 'zzz' = 46655 ≥ 5000

export function formatPoints(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function encodeResults(scores: number[]): string {
  return scores.map((s) => s.toString(36).padStart(SCORE_CHARS, '0')).join('');
}

export function decodeResults(s: string): number[] | null {
  if (!new RegExp(`^[0-9a-z]{${ROUNDS * SCORE_CHARS}}$`).test(s)) return null;
  const scores: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const v = parseInt(s.slice(i * SCORE_CHARS, (i + 1) * SCORE_CHARS), 36);
    if (!Number.isFinite(v) || v > MAX_POINTS) return null;
    scores.push(v);
  }
  return scores;
}

export function sanitizeName(raw: string): string {
  return raw.replace(/[<>&"']/g, '').trim().slice(0, 20);
}

export interface Challenger {
  name: string | null;
  scores: number[];
  total: number;
}

export function parseGameParams(search: string): {
  code: ChallengeCode | null;
  challenger: Challenger | null;
} {
  const params = new URLSearchParams(search);
  const code = params.has('c') ? decodeChallenge(params.get('c')!) : null;
  let challenger: Challenger | null = null;
  const scores = params.has('r') ? decodeResults(params.get('r')!) : null;
  if (scores) {
    const rawName = params.get('n');
    const name = rawName ? sanitizeName(rawName) || null : null;
    challenger = { name, scores, total: scores.reduce((a, b) => a + b, 0) };
  }
  return { code, challenger };
}

export function buildShareUrl(
  baseUrl: string,
  code: ChallengeCode,
  scores: number[],
  name: string | null
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('c', encodeChallenge(code));
  url.searchParams.set('r', encodeResults(scores));
  if (name) url.searchParams.set('n', sanitizeName(name));
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

export function buildShareText(opts: { rank: string; bar: string; total: number; url: string }): string {
  return `Backyard: Goa 🏖️ — ${opts.rank}\n${opts.bar} ${formatPoints(opts.total)} / ${formatPoints(MAX_GAME_POINTS)}\nBeat me: ${opts.url}`;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share.ts tests/share.test.ts
git commit -m "feat: share encoding — results codec, challenger parsing, ranks, emoji bar, share text"
```

---

### Task 6: Game state machine (`game.svelte.ts`)

**Files:**
- Create: `src/lib/game.svelte.ts`
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: `Deal`, `ROUNDS` from `seed.ts`; `haversineM`, `pointsForDistance` from `score.ts`; `Location` from `locations.ts`.
- Produces: `type Phase = 'playing' | 'scored' | 'summary' | 'error'` · `interface RoundResult { location: Location; guessLat: number; guessLng: number; distanceM: number; points: number }` · `createGame(deal: Deal)` returning `{ phase, roundIndex, currentLocation, guess, results, totalScore, pin(lat, lng), submit(), next(), substituteCurrent(): boolean }` (state exposed via getters).

The `.svelte.ts` extension lets us use `$state` runes; the Svelte Vite plugin compiles it for both the app and Vitest.

- [ ] **Step 1: Write failing tests** — `tests/game.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve module.

- [ ] **Step 3: Implement** — `src/lib/game.svelte.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS. (If Vitest fails to compile `$state`, confirm the file is named `game.svelte.ts` and `svelte()` is in the plugins array of `vite.config.ts`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/game.svelte.ts tests/game.test.ts
git commit -m "feat: game state machine with backup substitution (runes)"
```

---

### Task 7: Curation script (`scripts/curate.ts`)

**Files:**
- Create: `scripts/curate-lib.ts`, `scripts/curate.ts`, `scripts/spots.txt`
- Modify: `package.json` (add `"curate": "tsx scripts/curate.ts"` to scripts)
- Test: `tests/curate.test.ts`

**Interfaces:**
- Consumes: `Location`, `LocationPool` from `src/lib/locations.ts`.
- Produces: `parseSpots(text: string): Array<{ imageId: string; name: string | null }>` · `GOA_BBOX` · `interface MapillaryImage { id: string; is_pano: boolean; computed_geometry: { coordinates: [number, number] } }` · `validateImage(img: MapillaryImage, existingIds: Set<string>): string | null` (error reason or null) · `toLocation(imageId: string, name: string | null, img: MapillaryImage, version: number): Location` · `fetchImage(imageId: string, token: string): Promise<MapillaryImage>` · CLI `npm run curate`.

- [ ] **Step 1: Write failing tests** — `tests/curate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSpots, validateImage, toLocation, type MapillaryImage } from '../scripts/curate-lib';

const goodImg = (id = '123'): MapillaryImage => ({
  id, is_pano: true, computed_geometry: { coordinates: [73.83, 15.49] }, // [lng, lat]
});

describe('parseSpots', () => {
  it('parses ids with optional names, skipping blanks and comment lines', () => {
    const text = `# my Goa picks\n123456 # Fontainhas\n\n789012\n   \n# note\n345678#Baga bend`;
    expect(parseSpots(text)).toEqual([
      { imageId: '123456', name: 'Fontainhas' },
      { imageId: '789012', name: null },
      { imageId: '345678', name: 'Baga bend' },
    ]);
  });
});

describe('validateImage', () => {
  it('accepts a pano inside Goa', () => {
    expect(validateImage(goodImg(), new Set())).toBeNull();
  });
  it('rejects non-panos', () => {
    expect(validateImage({ ...goodImg(), is_pano: false }, new Set())).toMatch(/not a 360/i);
  });
  it('rejects duplicates', () => {
    expect(validateImage(goodImg('123'), new Set(['123']))).toMatch(/already/i);
  });
  it('rejects coordinates outside Goa', () => {
    const mumbai: MapillaryImage = { id: 'x', is_pano: true, computed_geometry: { coordinates: [72.87, 19.07] } };
    expect(validateImage(mumbai, new Set())).toMatch(/outside goa/i);
  });
});

describe('toLocation', () => {
  it('maps GeoJSON [lng, lat] to lat/lng fields and stamps the version', () => {
    expect(toLocation('123', 'Panjim', goodImg(), 3)).toEqual({
      imageId: '123', name: 'Panjim', lat: 15.49, lng: 73.83, version: 3,
    });
  });
  it('falls back to a generic name', () => {
    expect(toLocation('123', null, goodImg(), 1).name).toBe('Somewhere in Goa');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve module.

- [ ] **Step 3: Implement the library** — `scripts/curate-lib.ts`:

```ts
import type { Location } from '../src/lib/locations';

export const GOA_BBOX = { minLat: 14.85, maxLat: 15.85, minLng: 73.65, maxLng: 74.35 };

export interface MapillaryImage {
  id: string;
  is_pano: boolean;
  computed_geometry: { coordinates: [number, number] }; // GeoJSON: [lng, lat]
}

export function parseSpots(text: string): Array<{ imageId: string; name: string | null }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [idPart, ...nameParts] = line.split('#');
      return { imageId: idPart.trim(), name: nameParts.join('#').trim() || null };
    });
}

export function validateImage(img: MapillaryImage, existingIds: Set<string>): string | null {
  if (existingIds.has(img.id)) return `image ${img.id} is already in the pool`;
  if (!img.is_pano) return `image ${img.id} is not a 360° panorama`;
  const [lng, lat] = img.computed_geometry.coordinates;
  const b = GOA_BBOX;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
    return `image ${img.id} is outside Goa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return null;
}

export function toLocation(
  imageId: string,
  name: string | null,
  img: MapillaryImage,
  version: number
): Location {
  const [lng, lat] = img.computed_geometry.coordinates;
  return { imageId, name: name ?? 'Somewhere in Goa', lat, lng, version };
}

export async function fetchImage(imageId: string, token: string): Promise<MapillaryImage> {
  const url = `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=id,is_pano,computed_geometry`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapillary API ${res.status} for image ${imageId}`);
  return (await res.json()) as MapillaryImage;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Write the CLI** — `scripts/curate.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parseSpots, validateImage, toLocation, fetchImage } from './curate-lib';
import type { LocationPool } from '../src/lib/locations';

const POOL_PATH = 'src/data/locations.json';
const SPOTS_PATH = 'scripts/spots.txt';

function readTokenFromDotenv(): string | null {
  try {
    const m = /^VITE_MAPILLARY_TOKEN=(.+)$/m.exec(readFileSync('.env', 'utf8'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function main() {
  const token = process.env.VITE_MAPILLARY_TOKEN ?? readTokenFromDotenv();
  if (!token) {
    console.error('No token. Set VITE_MAPILLARY_TOKEN in .env');
    process.exit(1);
  }
  const pool = JSON.parse(readFileSync(POOL_PATH, 'utf8')) as LocationPool;
  const existing = new Set(pool.locations.map((l) => l.imageId));
  const spots = parseSpots(readFileSync(SPOTS_PATH, 'utf8'));
  const newVersion = pool.version + 1;
  let added = 0;

  for (const spot of spots) {
    if (existing.has(spot.imageId)) continue; // already curated on a previous run
    try {
      const img = await fetchImage(spot.imageId, token);
      const problem = validateImage(img, existing);
      if (problem) {
        console.warn(`SKIP ${problem}`);
        continue;
      }
      pool.locations.push(toLocation(spot.imageId, spot.name, img, newVersion));
      existing.add(spot.imageId);
      added++;
      console.log(`OK   ${spot.imageId} ${spot.name ?? ''}`);
    } catch (e) {
      console.warn(`SKIP ${spot.imageId}: ${(e as Error).message}`);
    }
  }

  if (added > 0) {
    pool.version = newVersion;
    writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2) + '\n');
  }
  console.log(`\nAdded ${added} location(s). Pool now v${pool.version} with ${pool.locations.length} spots.`);
}

main();
```

And `scripts/spots.txt`:

```
# Backyard: Goa — curation list
# One Mapillary image ID per line, optional "# Name" after it.
# Find IDs: https://www.mapillary.com/app/ → zoom to Goa → click a green
# line → copy the pKey value from the URL. Then run: npm run curate
```

Add to `package.json` scripts: `"curate": "tsx scripts/curate.ts"`.

- [ ] **Step 6: Verify the CLI handles an empty list** — `npm run curate` → prints `Added 0 location(s). Pool now v1 with 0 spots.` (with the `.env` from Task 1 present).

- [ ] **Step 7: Commit**

```bash
git add scripts/ tests/curate.test.ts package.json
git commit -m "feat: curation script — image IDs to validated locations.json via Mapillary API"
```

---

### Task 8: Library wrapper components (`PanoViewer`, `GuessMap`)

**Files:**
- Create: `src/components/PanoViewer.svelte`, `src/components/GuessMap.svelte`

**Interfaces:**
- Consumes: `RoundResult` from `game.svelte.ts`.
- Produces: `PanoViewer` props `{ imageId: string; token: string; onloaderror: (imageId: string) => void }` · `GuessMap` props `{ interactive: boolean; roundIndex: number; result: RoundResult | null; onpin: (lat: number, lng: number) => void }`.

No unit tests (browser-only libraries; per spec, verified by the Task 9 smoke test). Verify with `npx svelte-check` instead.

- [ ] **Step 1: Write `src/components/PanoViewer.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Viewer } from 'mapillary-js';

  let { imageId, token, onloaderror }: {
    imageId: string;
    token: string;
    onloaderror: (imageId: string) => void;
  } = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | undefined;

  onMount(() => {
    viewer = new Viewer({
      container,
      accessToken: token,
      component: {
        cover: false,
        direction: false,
        sequence: false,
        keyboard: false,
        tag: false,
        popup: false,
        zoom: true,
        bearing: false,
      },
    });
  });

  $effect(() => {
    const id = imageId;
    viewer?.moveTo(id).catch(() => onloaderror(id));
  });

  onDestroy(() => viewer?.remove());
</script>

<div bind:this={container} class="w-full h-full bg-slate-900"></div>
```

Note: the `$effect` reads `imageId` so it re-runs on every round change and on backup substitution. `onMount` runs before the first `$effect` flush, so the viewer exists by then.

- [ ] **Step 2: Write `src/components/GuessMap.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import type { RoundResult } from '../lib/game.svelte';

  let { interactive, roundIndex, result, onpin }: {
    interactive: boolean;
    roundIndex: number;
    result: RoundResult | null;
    onpin: (lat: number, lng: number) => void;
  } = $props();

  const GOA_CENTER: L.LatLngTuple = [15.35, 74.0];
  const GOA_ZOOM = 10;

  let el: HTMLDivElement;
  let map: L.Map | undefined;
  let guessMarker: L.Marker | null = null;
  let actualMarker: L.Marker | null = null;
  let line: L.Polyline | null = null;

  const pinIcon = (bg: string) =>
    L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:9999px;background:${bg};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  onMount(() => {
    map = L.map(el, { center: GOA_CENTER, zoom: GOA_ZOOM });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!interactive) return;
      onpin(e.latlng.lat, e.latlng.lng);
      if (guessMarker) guessMarker.setLatLng(e.latlng);
      else guessMarker = L.marker(e.latlng, { icon: pinIcon('#f59e0b') }).addTo(map!);
    });
  });

  // New round: clear all layers, reset the view.
  $effect(() => {
    void roundIndex;
    if (!map) return;
    for (const layer of [guessMarker, actualMarker, line]) layer && map.removeLayer(layer);
    guessMarker = actualMarker = line = null;
    map.setView(GOA_CENTER, GOA_ZOOM);
  });

  // Reveal: answer marker + dashed line + fit both pins.
  $effect(() => {
    if (!map || !result) return;
    const actual: L.LatLngTuple = [result.location.lat, result.location.lng];
    const guessed: L.LatLngTuple = [result.guessLat, result.guessLng];
    actualMarker = L.marker(actual, { icon: pinIcon('#10b981') }).addTo(map);
    line = L.polyline([guessed, actual], { color: '#ef4444', weight: 3, dashArray: '6 6' }).addTo(map);
    map.fitBounds(L.latLngBounds([guessed, actual]).pad(0.25));
  });

  onDestroy(() => map?.remove());
</script>

<div bind:this={el} class="w-full h-full"></div>
```

- [ ] **Step 3: Typecheck** — `npx svelte-check --tsconfig ./tsconfig.json` → 0 errors (warnings acceptable). Also `npm test` still PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: Mapillary and Leaflet wrapper components with cleanup and reveal drawing"
```

---

### Task 9: Playable game — `Hud`, `GameFooter`, `App.svelte`

**Files:**
- Create: `src/components/Hud.svelte`, `src/components/GameFooter.svelte`
- Modify: `src/App.svelte` (replace scaffold placeholder entirely)

**Interfaces:**
- Consumes: everything produced by Tasks 2–8.
- Produces: `Hud` props `{ round: number; totalScore: number; challenger: Challenger | null }` · `GameFooter` props `{ phase: Phase; result: RoundResult | null; canSubmit: boolean; isLastRound: boolean; challengerRoundScore: number | null; onsubmit: () => void; onnext: () => void }` · a playable 5-round game (summary screen arrives in Task 10).

- [ ] **Step 1: Write `src/components/Hud.svelte`**

```svelte
<script lang="ts">
  import type { Challenger } from '../lib/share';
  import { formatPoints } from '../lib/share';

  let { round, totalScore, challenger }: {
    round: number;
    totalScore: number;
    challenger: Challenger | null;
  } = $props();

  const challengerRunning = $derived(
    challenger ? challenger.scores.slice(0, round).reduce((a, b) => a + b, 0) : 0
  );
</script>

<div class="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-4 shadow-xl">
  <h1 class="text-sm font-bold uppercase tracking-wide text-amber-400">Backyard: Goa</h1>
  <div class="h-4 w-px bg-slate-700"></div>
  <span class="text-xs font-mono text-slate-400">Round {round + 1}/5</span>
  <div class="h-4 w-px bg-slate-700"></div>
  <span class="text-xs font-mono text-slate-300">You {formatPoints(totalScore)}</span>
  {#if challenger}
    <span class="text-xs font-mono text-orange-400">
      {challenger.name ?? 'Rival'} {formatPoints(challengerRunning)}
    </span>
  {/if}
</div>

{#if challenger}
  <div class="absolute top-16 left-4 z-[1000] bg-orange-950/90 border border-orange-800 rounded px-3 py-1 text-xs text-orange-300 shadow">
    {challenger.name ?? 'A rival'} scored {formatPoints(challenger.total)} — beat them!
  </div>
{/if}

<div class="absolute bottom-1 left-1 z-[1000] text-[10px] text-slate-500 bg-slate-950/70 px-1 rounded">
  Imagery © <a class="underline" href="https://www.mapillary.com" target="_blank" rel="noreferrer">Mapillary</a>
  · Map © <a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
  © <a class="underline" href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>
</div>
```

- [ ] **Step 2: Write `src/components/GameFooter.svelte`**

```svelte
<script lang="ts">
  import type { Phase, RoundResult } from '../lib/game.svelte';
  import { formatDistance } from '../lib/score';
  import { formatPoints } from '../lib/share';

  let { phase, result, canSubmit, isLastRound, challengerRoundScore, onsubmit, onnext }: {
    phase: Phase;
    result: RoundResult | null;
    canSubmit: boolean;
    isLastRound: boolean;
    challengerRoundScore: number | null;
    onsubmit: () => void;
    onnext: () => void;
  } = $props();
</script>

<footer class="w-full bg-slate-950/95 backdrop-blur border-t border-slate-800 p-4 min-h-[90px] flex flex-col sm:flex-row items-center justify-between gap-4">
  {#if phase === 'playing'}
    <div class="text-center sm:text-left">
      <p class="text-sm font-semibold text-slate-300">Where in Goa is this?</p>
      <p class="text-xs text-slate-500 mt-0.5">Look around, then drop a pin on the map.</p>
    </div>
    <button
      disabled={!canSubmit}
      onclick={onsubmit}
      class="w-full sm:w-auto px-6 py-2.5 bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 hover:bg-amber-400 text-slate-950 disabled:cursor-not-allowed font-bold uppercase text-xs tracking-wider rounded transition-colors">
      Submit guess
    </button>
  {:else if phase === 'scored' && result}
    <div class="flex items-center gap-3 flex-wrap justify-center">
      <div class="bg-slate-900 border border-slate-800 rounded px-3 py-1.5">
        <span class="text-[10px] text-slate-500 block uppercase font-bold">Distance</span>
        <span class="text-sm font-mono font-bold text-orange-400">{formatDistance(result.distanceM)}</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded px-3 py-1.5">
        <span class="text-[10px] text-slate-500 block uppercase font-bold">You</span>
        <span class="text-sm font-mono font-bold text-emerald-400">+{formatPoints(result.points)}</span>
      </div>
      {#if challengerRoundScore !== null}
        <div class="bg-slate-900 border border-slate-800 rounded px-3 py-1.5">
          <span class="text-[10px] text-slate-500 block uppercase font-bold">Rival</span>
          <span class="text-sm font-mono font-bold text-orange-400">+{formatPoints(challengerRoundScore)}</span>
        </div>
      {/if}
      <span class="text-xs text-slate-400">{result.location.name}</span>
    </div>
    <button
      onclick={onnext}
      class="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase text-xs tracking-wider rounded transition-colors">
      {isLastRound ? 'See summary' : 'Next round'}
    </button>
  {/if}
</footer>
```

- [ ] **Step 3: Replace `src/App.svelte` entirely**

```svelte
<script lang="ts">
  import PanoViewer from './components/PanoViewer.svelte';
  import GuessMap from './components/GuessMap.svelte';
  import Hud from './components/Hud.svelte';
  import GameFooter from './components/GameFooter.svelte';
  import { loadPool } from './lib/locations';
  import { dealGame, encodeChallenge, randomSeed, ROUNDS, BACKUPS, type ChallengeCode } from './lib/seed';
  import { parseGameParams, type Challenger } from './lib/share';
  import { createGame } from './lib/game.svelte';

  const TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN as string;
  const pool = loadPool();

  // Resolve challenge code (falling back to a fresh seed) and challenger ghost.
  const parsed = parseGameParams(window.location.search);
  let code: ChallengeCode | null = parsed.code;
  let challenger: Challenger | null = parsed.challenger;
  let deal = code ? dealGame(pool, code) : null;
  if (!deal) {
    challenger = null; // stale/malformed link: play a plain new game instead
    code = { seed: randomSeed(), poolVersion: pool.version };
    deal = dealGame(pool, code);
  }
  if (deal) {
    const url = new URL(window.location.href);
    url.searchParams.set('c', encodeChallenge(code));
    url.searchParams.delete('r');
    url.searchParams.delete('n');
    history.replaceState(null, '', url);
  }

  const game = deal ? createGame(deal) : null;

  const lastResult = $derived(
    game && game.results.length > 0 ? game.results[game.results.length - 1] : null
  );
</script>

{#if !game}
  <main class="w-full h-screen flex items-center justify-center bg-slate-950 text-slate-300 p-8 text-center">
    <div>
      <h1 class="text-2xl font-bold text-amber-400 mb-2">Backyard: Goa 🏖️</h1>
      <p>Not enough locations curated yet. Run <code class="text-emerald-400">npm run curate</code> with at least {ROUNDS + BACKUPS} spots.</p>
    </div>
  </main>
{:else if game.phase === 'error'}
  <main class="w-full h-screen flex items-center justify-center bg-slate-950 text-slate-300 p-8 text-center">
    <div>
      <h1 class="text-2xl font-bold text-amber-400 mb-2">Can't reach street view 😕</h1>
      <p class="mb-4">Check your connection and try again.</p>
      <button onclick={() => location.reload()} class="px-6 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Retry</button>
    </div>
  </main>
{:else}
  <main class="w-full h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 overflow-hidden">
    <section class="w-full md:w-1/2 h-1/2 md:h-full relative border-b md:border-b-0 md:border-r border-slate-800">
      <PanoViewer
        imageId={game.currentLocation.imageId}
        token={TOKEN}
        onloaderror={() => game.substituteCurrent()}
      />
      <Hud round={game.roundIndex} totalScore={game.totalScore} {challenger} />
    </section>
    <section class="w-full md:w-1/2 h-1/2 md:h-full flex flex-col">
      <div class="flex-grow relative">
        <GuessMap
          interactive={game.phase === 'playing'}
          roundIndex={game.roundIndex}
          result={game.phase === 'scored' ? lastResult : null}
          onpin={(lat, lng) => game.pin(lat, lng)}
        />
      </div>
      <GameFooter
        phase={game.phase}
        result={lastResult}
        canSubmit={game.guess !== null}
        isLastRound={game.roundIndex === ROUNDS - 1}
        challengerRoundScore={challenger && lastResult ? challenger.scores[game.roundIndex] : null}
        onsubmit={() => game.submit()}
        onnext={() => game.next()}
      />
    </section>
  </main>
{/if}
```

Note: the summary phase renders nothing yet — Task 10 adds it. That's expected here.

- [ ] **Step 4: Typecheck and test** — `npx svelte-check --tsconfig ./tsconfig.json` → 0 errors; `npm test` → PASS.

- [ ] **Step 5: Curate real locations (MANUAL — needs Kapil or a browser)**

Get a free token at mapillary.com/dashboard/developers into `.env`. In the Mapillary web app, zoom to Goa, click green sequence lines, copy `pKey` values from the URL into `scripts/spots.txt` (aim for 7+ now, 15–20 before sharing widely). Run `npm run curate` — expect `OK` lines and a written `src/data/locations.json`. Commit:

```bash
git add src/data/locations.json scripts/spots.txt
git commit -m "data: first curated location pool"
```

If executing agentically without a browser: skip curation, note it as a blocker for the smoke test, and continue — everything else proceeds.

- [ ] **Step 6: Manual smoke test** — `npm run dev`, open http://localhost:5173: panorama loads and pans (no navigation arrows), pin drops, Submit reveals dashed line + both pins + distance + points, Next advances, URL shows `?c=…`, reloading the same URL deals the same locations.

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte src/components/Hud.svelte src/components/GameFooter.svelte
git commit -m "feat: playable 5-round game with challenge URLs and head-to-head HUD"
```

---

### Task 10: Summary screen, share card & share flow

**Files:**
- Create: `src/lib/card.ts`, `src/components/Summary.svelte`
- Modify: `src/App.svelte` (render Summary in the summary phase)

**Interfaces:**
- Consumes: `RoundResult` from `game.svelte.ts`; `rankForScore`, `emojiBar`, `buildShareText`, `buildShareUrl`, `formatPoints`, `Challenger` from `share.ts`; `formatDistance`, `emojiForDistance`, `MAX_GAME_POINTS` from `score.ts`; `ChallengeCode` from `seed.ts`.
- Produces: `renderShareCard(opts: { total: number; rank: string; bar: string; rounds: Array<{ name: string; distanceM: number; points: number }> }): Promise<Blob>` · `Summary` props `{ results: RoundResult[]; totalScore: number; code: ChallengeCode; challenger: Challenger | null }`.

- [ ] **Step 1: Write `src/lib/card.ts`**

```ts
import { formatDistance, MAX_GAME_POINTS } from './score';
import { formatPoints } from './share';

export async function renderShareCard(opts: {
  total: number;
  rank: string;
  bar: string;
  rounds: Array<{ name: string; distanceM: number; points: number }>;
}): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1080;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('Backyard: Goa 🏖️', 80, 150);

  ctx.fillStyle = '#34d399';
  ctx.font = '900 170px system-ui, sans-serif';
  ctx.fillText(formatPoints(opts.total), 80, 360);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(`/ ${formatPoints(MAX_GAME_POINTS)} — ${opts.rank}`, 80, 430);

  ctx.font = '72px system-ui, sans-serif';
  ctx.fillText(opts.bar, 80, 550);

  ctx.font = '34px system-ui, sans-serif';
  opts.rounds.forEach((r, i) => {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${i + 1}.  ${r.name}`, 80, 650 + i * 60);
    ctx.fillStyle = '#f97316';
    ctx.fillText(`${formatDistance(r.distanceM)} · +${formatPoints(r.points)}`, 620, 650 + i * 60);
  });

  ctx.fillStyle = '#475569';
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText('Think you know Goa better? Play the link!', 80, 1010);

  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
}
```

- [ ] **Step 2: Write `src/components/Summary.svelte`**

```svelte
<script lang="ts">
  import type { RoundResult } from '../lib/game.svelte';
  import type { ChallengeCode } from '../lib/seed';
  import { buildShareText, buildShareUrl, emojiBar, rankForScore, formatPoints, type Challenger } from '../lib/share';
  import { formatDistance, emojiForDistance, MAX_GAME_POINTS } from '../lib/score';
  import { renderShareCard } from '../lib/card';

  let { results, totalScore, code, challenger }: {
    results: RoundResult[];
    totalScore: number;
    code: ChallengeCode;
    challenger: Challenger | null;
  } = $props();

  const rank = $derived(rankForScore(totalScore));
  const bar = $derived(emojiBar(results.map((r) => r.distanceM)));
  const outcome = $derived(
    challenger ? (totalScore > challenger.total ? 'win' : totalScore < challenger.total ? 'lose' : 'tie') : null
  );

  let playerName = $state(localStorage.getItem('backyard-name') ?? '');
  let copied = $state(false);

  async function share() {
    localStorage.setItem('backyard-name', playerName);
    const url = buildShareUrl(
      window.location.origin + window.location.pathname,
      code,
      results.map((r) => r.points),
      playerName || null
    );
    const text = buildShareText({ rank, bar, total: totalScore, url });
    try {
      const blob = await renderShareCard({
        total: totalScore, rank, bar,
        rounds: results.map((r) => ({ name: r.location.name, distanceM: r.distanceM, points: r.points })),
      });
      const file = new File([blob], 'backyard-goa.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch { /* fall through to clipboard */ }
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function playAgain() {
    window.location.href = window.location.origin + window.location.pathname; // bare URL → fresh seed
  }
</script>

<main class="w-full h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col items-center p-6 gap-5">
  <h1 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mt-4">
    CHALLENGE COMPLETE
  </h1>

  <div class="bg-slate-900 border border-slate-800 rounded-xl px-10 py-5 text-center">
    <div class="text-5xl font-black text-emerald-400">{formatPoints(totalScore)}</div>
    <div class="text-xs text-slate-500 uppercase tracking-widest mt-1">/ {formatPoints(MAX_GAME_POINTS)}</div>
    <div class="text-amber-400 font-bold mt-2">{rank}</div>
    <div class="text-2xl mt-2">{bar}</div>
  </div>

  {#if challenger}
    <div class="bg-slate-900 border border-slate-800 rounded-xl px-8 py-4 text-center w-full max-w-md">
      <div class="text-lg font-bold">
        {#if outcome === 'win'}🏆 You beat {challenger.name ?? 'your rival'}!{:else if outcome === 'lose'}😤 {challenger.name ?? 'Your rival'} wins!{:else}🤝 It's a tie!{/if}
      </div>
      <div class="text-sm font-mono text-slate-400 mt-2">
        You {formatPoints(totalScore)} · {challenger.name ?? 'Rival'} {formatPoints(challenger.total)}
      </div>
      <div class="mt-3 flex flex-col gap-1">
        {#each results as r, i}
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="w-4 text-slate-500">{i + 1}</span>
            <div class="flex-1 bg-slate-800 rounded h-2 overflow-hidden">
              <div class="bg-emerald-500 h-full" style="width:{(r.points / 5000) * 100}%"></div>
            </div>
            <div class="flex-1 bg-slate-800 rounded h-2 overflow-hidden">
              <div class="bg-orange-500 h-full" style="width:{(challenger.scores[i] / 5000) * 100}%"></div>
            </div>
          </div>
        {/each}
        <div class="flex justify-between text-[10px] text-slate-500 uppercase"><span>You</span><span>{challenger.name ?? 'Rival'}</span></div>
      </div>
    </div>
  {/if}

  <div class="w-full max-w-md flex flex-col gap-1.5">
    {#each results as r}
      <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm">
        <span>{emojiForDistance(r.distanceM)} {r.location.name}</span>
        <span class="font-mono text-slate-400">{formatDistance(r.distanceM)} · <span class="text-emerald-400">+{formatPoints(r.points)}</span></span>
      </div>
    {/each}
  </div>

  <div class="flex flex-col sm:flex-row items-center gap-3 mb-6">
    <input
      bind:value={playerName}
      maxlength="20"
      placeholder="Your name (for the challenge)"
      class="bg-slate-900 border border-slate-700 rounded px-4 py-2.5 text-sm w-56 placeholder:text-slate-600"
    />
    <button onclick={share}
      class="px-8 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-bold uppercase text-sm rounded-lg text-slate-950">
      {copied ? 'Copied!' : 'Challenge friends'}
    </button>
    <button onclick={playAgain} class="px-6 py-2.5 border border-slate-700 hover:border-slate-500 font-bold uppercase text-sm rounded-lg text-slate-300">
      Play again
    </button>
  </div>
</main>
```

- [ ] **Step 3: Render it from `App.svelte`** — add `import Summary from './components/Summary.svelte';` to the imports and a summary branch so the final structure is:

```svelte
{#if !game}
  <!-- (unchanged: not-enough-locations screen) -->
{:else if game.phase === 'error'}
  <!-- (unchanged: error screen) -->
{:else if game.phase === 'summary'}
  <Summary results={game.results} totalScore={game.totalScore} code={code!} {challenger} />
{:else}
  <!-- (unchanged: game layout) -->
{/if}
```

(`code!` is safe: `game` exists only when a deal succeeded, which implies `code` was set.)

- [ ] **Step 4: Typecheck and test** — `npx svelte-check --tsconfig ./tsconfig.json` → 0 errors; `npm test` → PASS.

- [ ] **Step 5: Manual smoke test** — play 5 rounds: summary shows rank, emoji bar, per-round distances; "Challenge friends" copies text (desktop) — paste it, open the URL in a new tab: rival totals in HUD, rival round scores in footer, winner section in summary all appear; same locations dealt.

- [ ] **Step 6: Commit**

```bash
git add src/lib/card.ts src/components/Summary.svelte src/App.svelte
git commit -m "feat: summary with head-to-head comparison, canvas share card, share flow"
```

---

### Task 11: Deploy to GitHub Pages + README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `npm run build`, `npm test` from Task 1; repo secret `VITE_MAPILLARY_TOKEN` (manual: GitHub → Settings → Secrets and variables → Actions).

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_MAPILLARY_TOKEN: ${{ secrets.VITE_MAPILLARY_TOKEN }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `README.md`**

```markdown
# Backyard: Goa 🏖️

A GeoGuessr-style guessing game set entirely in Goa. See a 360° street view,
drop a pin, score by proximity. 5 rounds, 25,000 max. Free stack: Mapillary +
Leaflet + CartoDB, no backend.

## Develop

1. `npm install`
2. Copy `.env.example` → `.env`, add a free Mapillary client token
   (mapillary.com/dashboard/developers).
3. `npm run dev`

## Add locations

1. Open https://www.mapillary.com/app/ and zoom to Goa.
2. Click a green sequence line, copy the `pKey` value from the URL.
3. Add it to `scripts/spots.txt` (one per line, `# Name` optional).
4. `npm run curate` — validates it's a 360° pano inside Goa and derives the
   coordinates. Never edit `src/data/locations.json` by hand.

## Deploy

Push to `main`. GitHub Actions builds and deploys to Pages. One-time setup:
repo Settings → Pages → Source: GitHub Actions; and Settings → Secrets and
variables → Actions → add `VITE_MAPILLARY_TOKEN`.

## Design docs

- Spec: `docs/superpowers/specs/2026-07-19-backyard-goa-design.md`
- Plan: `docs/superpowers/plans/2026-07-19-backyard-goa.md`
```

- [ ] **Step 3: Verify** — `npm test` → PASS; `npm run build` → PASS. (The workflow itself is verified on first push; enabling Pages and adding the secret are manual steps for Kapil.)

- [ ] **Step 4: Commit**

```bash
git add .github/ README.md
git commit -m "chore: GitHub Pages deploy workflow and README"
```

---

## Post-plan manual checklist (Kapil)

- [ ] Mapillary token in `.env` and as a GitHub Actions secret
- [ ] 15–20 curated spots in `spots.txt` → `npm run curate` → commit the JSON
- [ ] Create the GitHub repo, push `main`, enable Pages (Source: GitHub Actions)
- [ ] Play one full game on your phone; send yourself the challenge link on WhatsApp
