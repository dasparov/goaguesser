# GoaGuesser — Handover

**Live:** https://dasparov.github.io/goaguesser/
**Curator:** https://dasparov.github.io/goaguesser/curate.html
**Repo:** https://github.com/dasparov/goaguesser · **Actions:** https://github.com/dasparov/goaguesser/actions
**Local:** `~/Documents/bckyrd` (branch `main`) · 148 tests · 75 commits · deployed 2026-07-20

---

## What it is

A GeoGuessr-style game set only in Goa. Five 360° panoramas per game; you drop a pin, it scores you by distance. Entirely static — no server, no accounts, no database. Everything that would normally need a backend lives in the URL.

---

## The two things you actually do

### Play and share
Open the site. The URL becomes `?c=<code>` immediately — **that is the challenge**, shareable at any moment. Play five rounds, tap **Share your score**: WhatsApp gets your rank, emoji bar, a dark shot-group card, and the challenge link. Whoever opens it plays your exact five spots with you as the ghost to beat. Each finisher adds themselves, so the board grows down the chat, up to 8 players. Tap the banner on any challenge link to see the standings without playing.

### Add spots
Open the curator on your phone → tap a hotspot chip (Arambol / Mandrem–Morjim / Candolim) → tap dots → preview the panorama → **Keep** → open the basket pill → **Publish to game**. A GitHub Action validates each spot against the Mapillary API, appends the good ones, and redeploys. Live in ~3 minutes.

First publish asks for a GitHub token (it links you to the page and names the two settings). Stored on that device only. Revoke at github.com/settings/tokens; the curator has a "Forget GitHub token" button.

**Fallbacks if you ever need them:** Export downloads the JSON → upload it to the `spots-inbox/` folder on GitHub (same robot picks it up), or locally `npm run curate -- --import file.json`.

---

## Things that will bite you if you forget them

- **`src/data/locations.json` is append-only and generated.** Never hand-edit or reorder it. Old challenge links pin to a pool version and replay their original five spots forever — reordering silently breaks every link ever shared.
- **Don't reintroduce mapillary-js.** Mapillary's API returns HTTP 500 for the `sfm_cluster` field on Goa's images, so their own viewer can never load them. The game uses `src/lib/pano360.ts`, a dependency-free WebGL equirect viewer that fetches `thumb_2048_url` via minimal-fields requests. Side benefit: the bundle is 27 KB instead of 1.27 MB.
- **Mapillary bbox queries must stay under 0.010 square degrees.** `CuratorMap` tiles the viewport into sub-cells for this reason. Per-cell failures are tolerated; only a fully failed viewport shows an error.
- **Goa's 360° coverage is thin** — roughly 280 panoramas in three clusters (audited 2026-07-20). That's why the curator has hotspot jump buttons. Spread picks across all three or players will learn "it's probably Arambol".
- **Regenerate the lockfile properly when deps change:** `rm -rf node_modules package-lock.json && npm install`. A Mac-only lockfile omits Linux binaries and CI's `npm ci` fails.
- **The Mapillary token** lives in gitignored `.env` and as the Actions secret `VITE_MAPILLARY_TOKEN`. It's a public client token — safe in the bundle, but keep it out of commits.

---

## Where things live

| Concern | File |
|---|---|
| Scoring, distance, emoji bands, `missForPoints` | `src/lib/score.ts` |
| Seeded dealing, challenge codes | `src/lib/seed.ts` |
| Field/standings encoding, ranks, share text | `src/lib/share.ts` |
| Game state machine (runes) | `src/lib/game.svelte.ts` |
| 360° viewer (custom WebGL) | `src/lib/pano360.ts` |
| Canvas share card | `src/lib/card.ts` |
| Curator + GitHub publish | `src/curate/` |
| Curation CLI (`--import`, `--rename`, `--autoname`) | `scripts/curate.ts`, `scripts/curate-lib.ts` |
| Design system (binding) | `docs/superpowers/specs/visual-identity.md` |
| Behaviour spec | `docs/superpowers/specs/2026-07-19-backyard-goa-design.md` |
| Build history / decisions | `.superpowers/sdd/progress.md` |

Design in one line: warm dark by default (`#1B120A`, never black), tile-blue accent, laterite reserved as a signal colour, Palatino display + mono numerals, flat — no gradients or shadows, no emoji in the UI, one animated moment (the trophy).

---

## Ideas noted but not built

- **Season / fixtures** — needs no code: post a fresh link each Sunday, "board closes Friday".
- **Short domain** — the only good way to shorten links. A real `.in` domain (~₹500–800/yr) points straight at the game; GitHub Pages supports it natively. URL shorteners were tried and removed: TinyURL bounces visitors through its own page first.
- **Rename spots** — `npm run curate -- --rename <imageId> "Chapora Fort Road"` for better names than the auto-assigned areas.
- Per-score OG previews (needs a server), more curator hotspots as Mapillary coverage grows.

---

## Commands

```bash
npm run dev                                   # localhost:5173 (game) + /curate.html
npm test                                      # 148 tests
npx svelte-check --tsconfig ./tsconfig.app.json
npm run build                                 # needs VITE_MAPILLARY_TOKEN
npm run curate -- --import <file.json>
npm run curate -- --rename <imageId> "Name"
npm run curate -- --autoname
```

Push to `main` deploys automatically.
