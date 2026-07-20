# GoaGuesser 🏖️

A GeoGuessr-style guessing game set entirely in Goa. See a 360° street view,
drop a pin, score by proximity. 5 rounds, 25,000 max. Free stack: Mapillary +
Leaflet + CartoDB, no backend.

## Develop

1. `npm install`
2. Copy `.env.example` → `.env`, add a free Mapillary client token
   (mapillary.com/dashboard/developers). It's a public client-side token —
   safe to bake into the bundle — but keep the `.env` file itself out of git
   (it's already gitignored).
3. `npm run dev`

The production build (`npm run build`) fails deliberately if
`VITE_MAPILLARY_TOKEN` is unset, so the game can never ship without one.

## Add locations

The easiest way in is the **curator page**: run `npm run dev` and open
`/curate.html`. It's a full-screen map of Goa (labels on, unlike the game's
map) — zoom in past street level and every Mapillary panorama in view shows
up as a dot. Click one to look around in the same panorama viewer the game
uses, give it an optional name, and hit **Keep**. Kept spots collect in the
basket panel (persisted in your browser via `localStorage`, so you can close
the tab and come back). Spots already shipped in the game render grey and
can't be kept again. A **Surprise me** button jumps to a random un-kept dot
in the current view. The page ships with the game itself — anyone with the
link can curate, since it's read-only Graph API access on a public token.

When you're happy with the basket, either:

- **Export n spots** — downloads `goaguesser-spots.json`. Then run:

  ```
  npm run curate -- --import ~/Downloads/goaguesser-spots.json
  ```

- **Copy for spots.txt** — copies `id # name` lines to your clipboard to
  paste into `scripts/spots.txt` directly.

You can also skip the curator page and add spots to `scripts/spots.txt` by
hand, one per line: a bare Mapillary image ID, *or* a full Mapillary URL
(anything containing `pKey=<id>`, e.g. copied straight from
https://www.mapillary.com/app/) — both forms take an optional trailing
`# Name` comment.

Either way, `npm run curate` does the real work: it looks up each image (from
spots.txt, an `--import` file, or both in the same run) on the Mapillary
Graph API, keeps only images that are a real panorama, fall inside Goa's
bounding box, and aren't already in the pool, then appends the valid ones to
`src/data/locations.json`. The curator page's export never carries
coordinates — the Graph API is always the source of truth for where a spot
actually is.

`src/data/locations.json` is generated and **append-only** — never hand-edit
it. Old challenge links pin themselves to a pool version, and rewriting or
reordering existing entries would break them.

## Deploy

Push to `main`. GitHub Actions builds and deploys to Pages. One-time setup:
repo Settings → Pages → Source: GitHub Actions; and Settings → Secrets and
variables → Actions → add `VITE_MAPILLARY_TOKEN`.

## Design docs

- Spec: `docs/superpowers/specs/2026-07-19-backyard-goa-design.md`
- Plan: `docs/superpowers/plans/2026-07-19-backyard-goa.md`
