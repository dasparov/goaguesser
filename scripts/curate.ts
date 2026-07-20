import { readFileSync, writeFileSync } from 'node:fs';
import { parseSpots, validateImage, applyCuratedLocations, fetchImage, type CuratedEntry } from './curate-lib';
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
  const curated: CuratedEntry[] = [];

  for (const spot of spots) {
    if (existing.has(spot.imageId)) {
      // already in the pool, or a duplicate of an earlier line in this same spots.txt run
      console.warn(`SKIP image ${spot.imageId} is already in the pool`);
      continue;
    }
    try {
      const img = await fetchImage(spot.imageId, token);
      const problem = validateImage(img, existing);
      if (problem) {
        console.warn(`SKIP ${problem}`);
        continue;
      }
      curated.push({ imageId: spot.imageId, name: spot.name, img });
      existing.add(spot.imageId);
      console.log(`OK   ${spot.imageId} ${spot.name ?? ''}`);
    } catch (e) {
      console.warn(`SKIP ${spot.imageId}: ${(e as Error).message}`);
    }
  }

  const nextPool = applyCuratedLocations(pool, curated);
  if (nextPool.version !== pool.version) {
    writeFileSync(POOL_PATH, JSON.stringify(nextPool, null, 2) + '\n');
  }
  console.log(
    `\nAdded ${curated.length} location(s). Pool now v${nextPool.version} with ${nextPool.locations.length} spots.`
  );
}

main();
