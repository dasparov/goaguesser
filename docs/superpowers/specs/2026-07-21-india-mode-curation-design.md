# India Mode — Curation Design

**Date:** 2026-07-21
**Status:** Approved design, pending spec review → implementation plan

## Goal

Add an **India mode** to IMSpatial: one mode covering the length and breadth of
India, with spots **auto-curated for maximum spread and variation** across four
lenses, never repetitive. India becomes the **default** mode; Goa and Delhi
remain reachable via `?city=goa` / `?city=delhi`.

The player experience is unchanged in shape (guess-the-street-view, drop a pin);
the novelty is the curation — a subcontinent's worth of deliberately varied
places, assembled by rules rather than hand-picked.

## Scope

**In scope:**
- India `city.ts` entry + default.
- A tagged region-cell atlas + a rule-based generator producing `india.json`.
- India-flavoured ranks; a 90s per-round timer.
- **Per-mode scoring & charts** — each mode owns an independent distance scale.
  India scores on a national scale; Goa/Delhi keep their exact city scale.

## The four lenses

Axes of variation the curation deliberately spreads across:

1. **Region / zone** — N, S, E, W, Central, NE. The backbone of "length & breadth."
2. **Terrain / landscape** — mountains, desert, coast, Western Ghats, plains,
   backwaters, forest, plateau.
3. **Settlement scale** — metro, tier-2 city, town, village, highway/rural.
4. **Place character** — heritage, bazaar, colonial, religious, nature, modern.

## Per-mode scoring & charts (each mode independent)

Today `score.ts` hardcodes one city-scale curve (full points ≤ 25 m, zero ≥ 15 km)
and `card.ts` hardcodes city-scale rings (100 m / 1 km / 5 km / 15 km) and emoji
thresholds. India-scale guesses miss by hundreds of km, so **each mode gets its
own `DistanceScale`** carried on its `city.ts` config:

```ts
interface DistanceScale {
  fullWithinM: number;                 // full points at/under this miss
  zeroAtM: number;                     // zero points at/over this miss
  ringStops: Array<[m: number, label: string]>;   // 4 rings, card chart
  emojiStops: Array<[m: number, emoji: string]>;   // emoji-bar thresholds
}
```

- **Goa / Delhi:** `fullWithinM 25`, `zeroAtM 15_000`, rings `[100m,1km,5km,15km]`,
  emoji `[100m→🎯, 1km→🟢, 5km→🟡, else 🔴]` — i.e. today's exact behaviour.
- **India:** `fullWithinM ≈ 50_000`, `zeroAtM ≈ 2_500_000`, rings
  `[50km, 250km, 1000km, 2500km]`, emoji scaled to national distances.

Threading:
- `pointsForDistance(m, scale)` and `missForPoints(points, scale)` take the scale
  (default = Goa scale, so existing tests and Goa/Delhi are unchanged).
- `emojiForDistance(m, scale)` likewise (default Goa) → `emojiBar` in `share.ts`
  passes the active scale.
- `game.svelte.ts` `createGame(deal, scale)` uses `scale` for `pointsForDistance`
  and sets the timeout-miss distance to `scale.zeroAtM`.
- `card.ts` `renderShareCard({ ..., scale })` derives `RADIUS_STOPS`, ring labels,
  the caption, and the shot-halo threshold from `scale` instead of constants.
- `Summary.svelte` passes `city.scale` into share text + card; `App.svelte` passes
  it into `createGame`.

`maxGamePoints` stays `rounds × 5000` regardless of scale (points are always
0–5000 per round; only the distance→points mapping changes).

## Architecture

- **`src/lib/city.ts`** — add `india` to `CITIES`; set `DEFAULT_CITY = 'india'`.
  Config: `{ id:'india', name:'India', center:[22.5, 79], zoom:5,
  pool: indiaJson, rounds:5, backups:3, timerSec:90, maxGamePoints:25000,
  ranks: INDIA_RANKS, scale: INDIA_SCALE }`. Goa/Delhi gain `scale: CITY_SCALE`.
  All existing UI (HUD title "IMSpatial · India", map center/zoom, the 90s timer
  via the existing timer effect, "Where in India is this?", share links carrying
  `?city=india`, ranks) is already city-driven and inherits automatically.
- **`src/data/india.json`** — generated `LocationPool` (version 1). **Pool schema
  unchanged** (`{version, locations:[{imageId,name,lat,lng,version}]}`); lens tags
  live only in the atlas/generator.
- **`scripts/india-atlas.ts`** — the tagged region-cell atlas (exported const).
- **`scripts/generate-india.ts`** — the generator, run via `npm run curate:india`
  (tsx). Reads `.env` `VITE_MAPILLARY_TOKEN`, discovers coverage, applies rules,
  writes `india.json` + a human-readable coverage/gaps log to stderr.

## The atlas (region-cells)

```ts
type Zone = 'N' | 'S' | 'E' | 'W' | 'C' | 'NE';
type Terrain = 'mountains' | 'desert' | 'coast' | 'ghats' | 'plains'
             | 'backwaters' | 'forest' | 'plateau';
type Settlement = 'metro' | 'tier2' | 'town' | 'village' | 'rural';
type Character = 'heritage' | 'bazaar' | 'colonial' | 'religious' | 'nature' | 'modern';

interface AtlasCell {
  id: string;
  name: string;              // evocative place name used for spot naming
  zone: Zone;
  state: string;
  bbox: [w: number, s: number, e: number, n: number];
  terrain: Terrain;
  settlement: Settlement;
  character: Character;
}
```

~40–60 cells spanning the lens matrix. Starter set (illustrative, not exhaustive):

| Cell | Zone | State | Terrain | Settlement | Character |
|---|---|---|---|---|---|
| Jaisalmer / Thar | W | Rajasthan | desert | town | heritage |
| Rann of Kutch | W | Gujarat | desert | rural | nature |
| Kerala backwaters (Alleppey) | S | Kerala | backwaters | town | nature |
| Varanasi ghats | N | UP | plains | metro | religious |
| Shimla / Manali | N | HP | mountains | town | nature |
| Hampi | S | Karnataka | plateau | town | heritage |
| Darjeeling / Gangtok | NE | WB/Sikkim | mountains | town | heritage |
| Shillong / Kaziranga | NE | Meghalaya/Assam | forest | town/rural | nature |
| Goa coast | W | Goa | coast | town | nature |
| Pondicherry | S | Puducherry | coast | town | colonial |
| Old Delhi | N | Delhi | plains | metro | bazaar |
| Mumbai | W | Maharashtra | coast | metro | modern |
| Kolkata | E | WB | plains | metro | colonial |
| Chennai | S | TN | coast | metro | modern |
| Bengaluru | S | Karnataka | plateau | metro | modern |
| Hyderabad | S | Telangana | plateau | metro | heritage |
| Amritsar | N | Punjab | plains | tier2 | religious |
| Udaipur | W | Rajasthan | plains | tier2 | heritage |
| Rishikesh / Mussoorie | N | Uttarakhand | mountains | town | religious |
| Konkan / Gokarna | W | Karnataka | coast | village | nature |

The full atlas is authored during implementation, over-provisioning cells per
lens value so sparse coverage still fills quotas.

## Curation rules (generator algorithm)

Config constants: `TARGET ≈ 65`, `PER_CELL_CAP = 3`, `MIN_SPACING_KM = 25`,
`PER_STATE_CAP = 4`, per-zone soft min/max.

1. **Discover** per cell: fetch `is_pano` images within `bbox` (expand ×2 up to
   twice if under a candidate floor); thin to a bounded set; keep `{id, lat, lng}`.
2. **Intra-cell sample**: farthest-point-sample up to `PER_CELL_CAP`, enforcing
   an intra-cell minimum spacing.
3. **Global assembly** (round-robin zones for balance): add candidates honouring
   global `MIN_SPACING_KM`, `PER_STATE_CAP`, and per-zone quota; stop at `TARGET`.
4. **Lens-coverage check**: verify each terrain / settlement / character value
   appears ≥ once; **log gaps, never silently drop** (no-silent-caps rule).
5. **Determinism**: sort candidates by `id`; no `Math.random` / `Date`.
6. **Naming**: `spot.name = cell.name` (optionally + nearest sub-place). Lens tags
   are *not* written to `india.json`.
7. **Output**: `india.json` + stderr log of each cell's contribution and gaps.

## Ranks (proposal, tuned to 25,000)

```
[23001, 'Bharat Yatri']            // covered the whole country
[18001, 'Seasoned Wayfarer']
[12001, 'Cross-Country Rambler']
[6001,  'Weekend Wanderer']
[0,     'Armchair Tourist']
```

## Testing

- Generator is network-bound/manual (not unit-tested) but logs coverage and gaps.
- **Validation unit test** over committed `india.json`: ≥ `rounds+backups` spots,
  every pair ≥ `MIN_SPACING_KM` apart, `version === 1`.
- **Scoring unit tests**: `pointsForDistance`/`missForPoints`/`emojiForDistance`
  with the India scale (e.g. a 200 km miss scores > 0 under India, 0 under city
  scale) — and existing Goa-scale tests still pass via the default scale.

## Rollout

1. Add `DistanceScale` to `score.ts` + `city.ts`; thread through game/card/share;
   confirm Goa/Delhi behaviour byte-identical (defaults).
2. Author `india-atlas.ts`.
3. Run `npm run curate:india`; review the log + eyeball spread on the map.
4. Commit `india.json`.
5. Add `india` to `city.ts` and flip `DEFAULT_CITY`.
6. Add validation + scoring tests.
7. Manual playtest: `?city=india` and the bare default; confirm Goa/Delhi links
   still work.
