import { readFileSync, writeFileSync } from 'node:fs';
import {
  parseSpots,
  validateImage,
  applyCuratedLocations,
  fetchImage,
  parseImportJson,
  dedupeSpots,
  renameLocation,
  autonameLocations,
  type CuratedEntry,
} from './curate-lib';
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

/** `--import <file.json>` — a JSON array exported by the curator page, merged with
 *  spots.txt entries in the same run (spots.txt wins on a duplicate image id). */
function readImportPath(argv: string[]): string | null {
  const flagIndex = argv.indexOf('--import');
  if (flagIndex === -1) return null;
  const path = argv[flagIndex + 1];
  if (!path) throw new Error('--import requires a file path, e.g. --import ~/Downloads/goaguesser-spots.json');
  return path;
}

/** `--rename <imageId> "New name"` — display-name-only edit of one existing entry. */
function readRenameArgs(argv: string[]): { imageId: string; name: string } | null {
  const flagIndex = argv.indexOf('--rename');
  if (flagIndex === -1) return null;
  const imageId = argv[flagIndex + 1];
  const name = argv[flagIndex + 2];
  if (!imageId || !name) {
    throw new Error('--rename requires an imageId and a name, e.g. --rename 123456 "Fontainhas"');
  }
  return { imageId, name };
}

function writePool(pool: LocationPool) {
  writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2) + '\n');
}

async function main() {
  const pool = JSON.parse(readFileSync(POOL_PATH, 'utf8')) as LocationPool;
  const argv = process.argv.slice(2);

  const renameArgs = readRenameArgs(argv);
  if (renameArgs) {
    const next = renameLocation(pool, renameArgs.imageId, renameArgs.name);
    if (!next) {
      console.error(`No location with imageId ${renameArgs.imageId} in the pool`);
      process.exit(1);
    }
    writePool(next);
    console.log(`Renamed ${renameArgs.imageId} → "${renameArgs.name}"`);
    return;
  }

  if (argv.includes('--autoname')) {
    const next = autonameLocations(pool);
    const changed = next.locations.filter((l, i) => l.name !== pool.locations[i].name);
    writePool(next);
    console.log(`Auto-named ${changed.length} location(s): ${changed.map((l) => `${l.imageId} → ${l.name}`).join(', ') || '(none needed it)'}`);
    return;
  }

  const token = process.env.VITE_MAPILLARY_TOKEN ?? readTokenFromDotenv();
  if (!token) {
    console.error('No token. Set VITE_MAPILLARY_TOKEN in .env');
    process.exit(1);
  }
  const existing = new Set(pool.locations.map((l) => l.imageId));

  const importPath = readImportPath(process.argv.slice(2));
  const spotsFromFile = parseSpots(readFileSync(SPOTS_PATH, 'utf8'));
  const imported = importPath ? parseImportJson(readFileSync(importPath, 'utf8')) : [];
  if (importPath) console.log(`Importing ${imported.length} spot(s) from ${importPath}`);
  const spots = dedupeSpots([...spotsFromFile, ...imported]);
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
    writePool(nextPool);
  }
  console.log(
    `\nAdded ${curated.length} location(s). Pool now v${nextPool.version} with ${nextPool.locations.length} spots.`
  );
}

main();
