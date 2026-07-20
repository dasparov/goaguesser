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
