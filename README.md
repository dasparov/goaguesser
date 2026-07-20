# Backyard: Goa 🏖️

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

1. Find a Mapillary 360° image in Goa (e.g. via
   https://www.mapillary.com/app/) and copy its image ID.
2. Add it to `scripts/spots.txt`, one per line, with an optional `# Name`
   comment.
3. Run `npm run curate`. It looks up each image on the Mapillary Graph API,
   keeps only images that are a real panorama, fall inside Goa's bounding
   box, and aren't already in the pool, then appends the valid ones to
   `src/data/locations.json`.

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
