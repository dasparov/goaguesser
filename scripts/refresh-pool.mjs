// Self-sustaining Delhi pool refresh — run weekly by
// .github/workflows/refresh-pool.yml (or `node scripts/refresh-pool.mjs`).
//
// Discovers real street-level 360° coverage across Delhi NCR, keeps ONLY
// outdoor moving-camera sequences (a much stronger filter than a short indoor
// loop can pass), EXCLUDES imageIds already in the pool, and APPENDS a fresh,
// well-spread batch up to a cap. So the reservoir grows over time and the
// in-game rotation keeps pulling unseen spots — "use up the batch, pull the
// next one" — with no manual work.
//
// Reads VITE_MAPILLARY_TOKEN from the environment (CI secret) or ./.env.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const POOL_PATH = new URL('../src/data/delhi.json', import.meta.url).pathname;

let token = process.env.VITE_MAPILLARY_TOKEN;
if (!token && existsSync(new URL('../.env', import.meta.url).pathname)) {
  token = readFileSync(new URL('../.env', import.meta.url).pathname, 'utf8').match(/VITE_MAPILLARY_TOKEN=(\S+)/)?.[1];
}
if (!token) throw new Error('no VITE_MAPILLARY_TOKEN');

// Delhi NCR footprint, tiled into API-sized cells.
const LAT_MIN = 28.30, LAT_MAX = 28.92, LON_MIN = 76.82, LON_MAX = 77.58, STEP = 0.05;
const LIMIT = 800;
const CAP = 120;                // grow the reservoir up to this many spots total
const ADD_PER_RUN = 40;         // ...adding at most this many new spots per run
const MIN_SPACING_M = 450;      // non-repetitive spread
// Stronger outdoor filter: a real street drive shows MANY images over a LONG
// track within a cell; indoor/object captures do not.
const MIN_SEQ_IMAGES = 8;
const MIN_TRACK_M = 200;

// Landmarks, for naming only (nearest wins; regional fallback otherwise).
const LANDMARKS = [
  ['Chandni Chowk', 28.6562, 77.2301], ['Jama Masjid', 28.6507, 77.2334],
  ['Red Fort', 28.6562, 77.2410], ['Connaught Place', 28.6315, 77.2167],
  ['India Gate', 28.6129, 77.2295], ['Humayun’s Tomb', 28.5933, 77.2507],
  ['Hauz Khas', 28.5535, 77.1940], ['Saket', 28.5245, 77.2066],
  ['Qutub Minar', 28.5245, 77.1855], ['Lotus Temple', 28.5535, 77.2588],
  ['Akshardham', 28.6127, 77.2773], ['Dwarka', 28.5921, 77.0460],
  ['Rajouri Garden', 28.6490, 77.1200], ['Rohini', 28.7360, 77.1150],
  ['Mayur Vihar', 28.6090, 77.2960], ['Cyber Hub Gurugram', 28.4945, 77.0880],
  ['Old Gurugram', 28.4670, 77.0270], ['Sohna Road', 28.4200, 77.0500],
  ['Sector 18 Noida', 28.5700, 77.3210], ['Surajkund', 28.4600, 77.2860],
  ['Ghaziabad', 28.6690, 77.4530], ['Indirapuram', 28.6420, 77.3710],
  ['Lajpat Nagar', 28.5677, 77.2433], ['Sultanpuri', 28.6930, 77.0680],
];
function regionName(lat, lng) {
  if (lng > 77.36) return lat > 28.62 ? 'East Delhi' : 'Noida';
  if (lng < 77.05) return lat > 28.60 ? 'West Delhi' : 'Gurugram';
  if (lat > 28.72) return 'North Delhi';
  if (lat < 28.48) return 'South NCR';
  return 'Delhi';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hav(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bboxDiag(pts) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (const p of pts) { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lng); d = Math.max(d, p.lng); }
  return hav(a, c, b, d);
}
function nameFor(lat, lng) {
  let best = null, bd = Infinity;
  for (const [n, la, lo] of LANDMARKS) { const d = hav(lat, lng, la, lo); if (d < bd) { bd = d; best = n; } }
  return bd <= 4000 ? best : regionName(lat, lng);
}

const existing = JSON.parse(readFileSync(POOL_PATH, 'utf8'));
const existingLoc = existing.locations ?? [];
const existingIds = new Set(existingLoc.map((l) => l.imageId));
console.error(`existing pool: ${existingLoc.length} spots (cap ${CAP})`);
if (existingLoc.length >= CAP) { console.error('pool already at cap — nothing to add'); process.exit(0); }

const cells = [];
for (let lat = LAT_MIN; lat < LAT_MAX - 1e-9; lat += STEP)
  for (let lon = LON_MIN; lon < LON_MAX - 1e-9; lon += STEP)
    cells.push([lon, lat, lon + STEP, lat + STEP]);

const candidates = [];
const seen = new Set();
let idx = 0;
async function worker() {
  while (idx < cells.length) {
    const bbox = cells[idx++];
    const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,computed_geometry,sequence&is_pano=true&bbox=${bbox.join(',')}&limit=${LIMIT}`;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const r = await fetch(url);
        if (!r.ok) { await sleep(800 * 2 ** (attempt - 1)); continue; }
        const imgs = (await r.json()).data ?? [];
        for (const img of imgs) {
          const c = img.computed_geometry?.coordinates;
          if (!c || seen.has(img.id) || existingIds.has(img.id)) continue;
          seen.add(img.id);
          candidates.push({ id: img.id, lat: c[1], lng: c[0], seq: img.sequence });
        }
        break;
      } catch { await sleep(800 * 2 ** (attempt - 1)); }
    }
    await sleep(250);
  }
}
await Promise.all(Array.from({ length: 2 }, () => worker()));
console.error(`collected ${candidates.length} new candidates`);

// Strong outdoor filter over the full candidate set.
const bySeq = new Map();
for (const c of candidates) { if (!c.seq) continue; if (!bySeq.has(c.seq)) bySeq.set(c.seq, []); bySeq.get(c.seq).push(c); }
const good = new Set();
for (const [seq, pts] of bySeq) if (pts.length >= MIN_SEQ_IMAGES && bboxDiag(pts) >= MIN_TRACK_M) good.add(seq);
const street = candidates.filter((c) => c.seq && good.has(c.seq));
console.error(`street-level new candidates: ${street.length}`);

// Farthest-point, spaced from existing spots AND each other.
const selected = [];
const anchors = existingLoc.map((l) => ({ lat: l.lat, lng: l.lng }));
while (selected.length < ADD_PER_RUN && existingLoc.length + selected.length < CAP) {
  let far = null, farD = -1;
  for (const c of street) {
    let min = Infinity;
    for (const p of [...anchors, ...selected]) { const d = hav(c.lat, c.lng, p.lat, p.lng); if (d < min) min = d; if (min < MIN_SPACING_M) break; }
    if (min > farD) { farD = min; far = c; }
  }
  if (!far || farD < MIN_SPACING_M) break;
  selected.push(far);
}

const added = selected.map((s) => ({ imageId: s.id, name: nameFor(s.lat, s.lng), lat: s.lat, lng: s.lng, version: existing.version ?? 1 }));
const merged = [...existingLoc, ...added];
writeFileSync(POOL_PATH, JSON.stringify({ version: existing.version ?? 1, locations: merged }, null, 2) + '\n');
console.error(`added ${added.length} spots -> ${merged.length} total`);
for (const a of added) console.error(`  + ${a.name} (${a.lat.toFixed(4)}, ${a.lng.toFixed(4)})`);
