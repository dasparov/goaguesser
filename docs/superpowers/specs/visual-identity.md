# Backyard: Goa — Visual Identity (locked)

**Status:** Approved by Kapil, 2026-07-20, from the screen walkthrough mockups.
**Binding on:** Tasks 8, 9, 10 (`PanoViewer`, `GuessMap`, `Hud`, `GameFooter`, `Summary`, `App`, and the canvas share card in `card.ts`).

Use these exact values. Do not substitute Tailwind's default palette entries.

## Palette

Light theme (default):

| Token | Hex | Used for |
|---|---|---|
| `--porcelain` | `#F6F8FB` | page ground (cool white, blue bias) |
| `--panel` | `#FFFFFF` | map ground, footer, cards |
| `--ink` | `#0E1F2E` | primary text |
| `--ink-soft` | `#4A6076` | secondary text, body copy |
| `--ink-faint` | `#8098AE` | labels, captions, attribution |
| `--rule` | `#DBE4EE` | borders, grid lines, dividers |
| `--azulejo` | `#2C5AA8` | **primary accent** — buttons, links, "You" bars, total score |
| `--azulejo-pale` | `#E2EAF7` | accent backgrounds, coastline fill, code chips |
| `--laterite` | `#BE4228` | **signal only** — the reveal distance line, the miss distance, rival bars, challenge banner |
| `--emerald-solid` | `#167851` | the actual-answer marker |
| `--amber` | `#C8801A` | the player's guess marker |

Dark theme (`prefers-color-scheme: dark` and `:root[data-theme="dark"]`):

| Token | Hex |
|---|---|
| `--porcelain` | `#0A141D` |
| `--panel` | `#12212E` |
| `--ink` | `#E6EDF5` |
| `--ink-soft` | `#9BB0C4` |
| `--ink-faint` | `#63798E` |
| `--rule` | `#23384A` |
| `--azulejo` | `#79A5E8` |
| `--azulejo-pale` | `#1B3050` |
| `--laterite` | `#E8674A` |
| `--emerald-solid` | `#3FB489` |
| `--amber` | `#E0A340` |

Shadow: `0 1px 2px rgba(14,31,46,.06), 0 8px 24px -12px rgba(14,31,46,.18)` (light) / `0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.7)` (dark).

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

## Reference

Approved mockup: https://claude.ai/code/artifact/652e4ad9-6ab2-4acd-acac-470c55b79f06
