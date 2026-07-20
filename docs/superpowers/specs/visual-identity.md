# Backyard: Goa — Visual Identity (locked)

**Status:** v2 (warm), directed by Kapil 2026-07-20: "warm and slick". Supersedes the cool porcelain v1 palette; type, layout and marker semantics unchanged.
**Binding on:** Tasks 8, 9, 10 (`PanoViewer`, `GuessMap`, `Hud`, `GameFooter`, `Summary`, `App`, and the canvas share card in `card.ts`).

Use these exact values. Do not substitute Tailwind's default palette entries.

## Palette

Light theme (default):

| Token | Hex | Used for |
|---|---|---|
| `--porcelain` | `#F5EDDF` | page ground (sun-washed sand / lime plaster) |
| `--panel` | `#FDF9F0` | map ground, footer, cards (shell white) |
| `--ink` | `#2B1F16` | primary text |
| `--ink-soft` | `#6B5847` | secondary text, body copy |
| `--ink-faint` | `#A08D77` | labels, captions, attribution |
| `--rule` | `#E6D9C4` | borders, grid lines, dividers |
| `--azulejo` | `#1F4E8C` | **primary accent** — buttons, links, "You" bars, total score |
| `--azulejo-pale` | `#E8EDF5` | accent backgrounds, coastline fill, code chips |
| `--laterite` | `#B84A2B` | **signal only** — the reveal distance line, the miss distance, rival bars, challenge banner |
| `--emerald-solid` | `#1B7A4E` | the actual-answer marker |
| `--amber` | `#C8801A` | the player's guess marker |

Dark theme (`prefers-color-scheme: dark` and `:root[data-theme="dark"]`):

| Token | Hex |
|---|---|
| `--porcelain` | `#1B120A` |
| `--panel` | `#261A0E` |
| `--ink` | `#F3EADA` |
| `--ink-soft` | `#C4B49D` |
| `--ink-faint` | `#8A7A63` |
| `--rule` | `#3B2C1C` |
| `--azulejo` | `#86AEE3` |
| `--azulejo-pale` | `#22314E` |
| `--laterite` | `#E06A44` |
| `--emerald-solid` | `#46B584` |
| `--amber` | `#E0A340` |

Shadow: `0 1px 2px rgba(43,31,22,.06), 0 8px 24px -12px rgba(43,31,22,.18)` (light) / `0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.7)` (dark).

**Marker colors are load-bearing.** `GuessMap`'s `divIcon` factory uses `--amber` for the guess pin and `--emerald-solid` for the answer pin; the reveal polyline is `--laterite`, dashed. These three must stay visually distinct — they are how the reveal reads at a glance.

## Type

| Role | Stack |
|---|---|
| Display | `"Palatino Linotype", "Book Antiqua", Palatino, "Iowan Old Style", Georgia, serif` |
| UI / body | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Data / mono | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

- Display serif carries: the rank title, the revealed place name (italic), section headings, the share card title. Used with restraint — never for UI chrome.
- Mono carries every number: scores, distances, round counters. Always with `font-variant-numeric: tabular-nums` so digits don't jitter between rounds.
- No webfonts. The CSP on hosted pages blocks font CDNs, and system stacks render instantly — which matters on a link opened from WhatsApp on mobile data.

## Layout rules

- **Mobile portrait is the primary target** — the game arrives as a WhatsApp link. Panorama on top, map below, footer pinned.
- **Pane split shifts on reveal:** during play the panorama dominates (`flex: 1.25` vs map `1`); on reveal the map grows and the panorama shrinks (`flex: .85` vs map `1.4`) so the distance line has room. This is the payoff moment getting the screen it deserves.
- Pins are teardrops: `border-radius: 50% 50% 50% 0`, rotated `-45deg`, 1.5px white border.
- The map keeps a faint 26px grid over `--panel` — it reads as a map surface without any labels to cheat from.
- Attribution sits in the footer at 7.5px in `--ink-faint`, permanently visible.
- Corner radius: 22px on the outer frame, 4–5px on buttons, chips and stat tiles. Not `rounded-lg` everywhere.


## Slickness rules (v2)

"Slick" is executed as precision, not decoration:

- **Buttons are pills** (`border-radius: 999px`) with a soft top-light: `background: linear-gradient(180deg, color-mix(in srgb, var(--azulejo) 88%, white) 0%, var(--azulejo) 55%)`, shadow from the token above. Pressed state translates down 1px and drops the outer shadow. Transitions: `transform .06s ease, box-shadow .12s ease` — nothing longer.
- Cards/stat tiles: 10px radius (was 4–5px), 1px `--rule` border, panel ground.
- The reveal's stat chips slide up 6px + fade in over .18s, staggered 40ms apart; respect `prefers-reduced-motion`.
- Everything else stays quiet. One signature element carries the boldness:

## Signature: the shot-group share card

The share card is NOT a dark gradient scorecard. It is a **printed survey chart on sand**: concentric target rings with the player's five misses plotted as shots.

- Canvas ground `--porcelain` (sand), header `BACKYARD · GOA` in mono caps letterspaced, `--ink-faint`.
- Four concentric rings centred in the upper 60% of the card, radii at 25% / 50% / 75% / 100% of R, representing miss thresholds **100 m / 1 km / 5 km / 15 km** (piecewise-linear radial scale between thresholds). Rings stroked `--azulejo` at decreasing alpha (.55/.40/.28/.18), 2px. Tiny mono ring labels (`100 m`, `1 km`, `5 km`, `15 km`) sit on each ring at 45°, `--ink-faint`.
- The five shots: ✕ marks in `--laterite`, 3px stroke, plotted at radius = scaled miss distance, angle deterministic per round (`i * 72° − 90°` plus a fixed 20° offset) so the same game always renders the same card. A shot inside the 100 m ring gets a small `--azulejo` halo.
- Below the chart: rank title in the display serif (`--ink`, ~64px at 1080w), then `18,410 / 25,000 · 2nd of 4` in mono tabular (`--ink-soft`), then the accuracy line `avg miss 1.4 km` in mono (`--laterite`).
- If others are on the board: up to three standings rows in mono (`1. Ana 21,340 🏆`), player's own row in `--azulejo`.
- Footer: `same five spots — your turn` in `--ink-faint`.
- Card height computed from content (base 1080×1080; +56px per standings row beyond one).

## Accuracy (derived, zero URL bytes)

Points are a deterministic function of distance, so per-round miss is recoverable: `miss = 15000 × (1 − √(p/5000))` (clamped: ≥5000 pts → 25 m floor, 0 pts → 15 km ceiling). `score.ts` exports `missForPoints(points): number`. Every rival's misses come from the scores already in the link. Summary shows the player's `avg miss`; when the board has ≥2 players, a "Most accurate" chip (lowest avg miss) appears in the standings — it is often a different person from the points leader, which is the fun.

## Reference

Approved mockup: https://claude.ai/code/artifact/652e4ad9-6ab2-4acd-acac-470c55b79f06
