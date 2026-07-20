import type { Location, LocationPool } from '../src/lib/locations';

export const GOA_BBOX = { minLat: 14.85, maxLat: 15.85, minLng: 73.65, maxLng: 74.35 };

export interface MapillaryImage {
  id: string;
  is_pano: boolean;
  computed_geometry: { coordinates: [number, number] }; // GeoJSON: [lng, lat]
}

/**
 * A spots.txt line is either a bare Mapillary image ID, or a full Mapillary URL
 * containing a `pKey=<id>` query param (e.g. copied straight from the app's address
 * bar). Either form may carry an optional trailing `# name` comment. Returns null for
 * a URL that has no pKey param — the caller treats that like any other unparseable
 * line and drops it, the same way blank lines and full-comment lines are dropped.
 */
function extractImageId(raw: string): string | null {
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw).searchParams.get('pKey');
  } catch {
    return null;
  }
}

export function parseSpots(text: string): Array<{ imageId: string; name: string | null }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [idPart, ...nameParts] = line.split('#');
      const imageId = extractImageId(idPart.trim());
      const name = nameParts.join('#').trim() || null;
      return imageId ? { imageId, name } : null;
    })
    .filter((entry): entry is { imageId: string; name: string | null } => entry !== null);
}

export function validateImage(img: MapillaryImage, existingIds: Set<string>): string | null {
  if (existingIds.has(img.id)) return `image ${img.id} is already in the pool`;
  if (!img.is_pano) return `image ${img.id} is not a 360° panorama`;
  const coordinates = img.computed_geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return `image ${img.id} has missing or malformed geometry`;
  }
  const [lng, lat] = coordinates;
  const b = GOA_BBOX;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
    return `image ${img.id} is outside Goa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return null;
}

export function toLocation(
  imageId: string,
  name: string | null,
  img: MapillaryImage,
  version: number
): Location {
  const [lng, lat] = img.computed_geometry.coordinates;
  return { imageId, name: name ?? 'Somewhere in Goa', lat, lng, version };
}

export interface CuratedEntry {
  imageId: string;
  name: string | null;
  img: MapillaryImage;
}

/**
 * Pure pool-mutation decision: given the current pool and a batch of already-validated
 * new entries, returns the next pool state. Responsible for the three rules that must
 * never regress, since old challenge links pin themselves to a pool version and replay
 * entries at or below it:
 *   - append-only: pre-existing entries are preserved byte-identical and in order
 *   - new entries are stamped with pool.version + 1
 *   - the version only bumps when at least one entry is actually added
 *   - an image ID already in the pool (or already added earlier in this same batch)
 *     is never added twice
 * No I/O happens here; curate.ts is responsible for reading, fetching, and writing.
 */
export function applyCuratedLocations(pool: LocationPool, entries: CuratedEntry[]): LocationPool {
  const existing = new Set(pool.locations.map((l) => l.imageId));
  const nextVersion = pool.version + 1;
  const added: Location[] = [];

  for (const entry of entries) {
    if (existing.has(entry.imageId)) continue;
    added.push(toLocation(entry.imageId, entry.name, entry.img, nextVersion));
    existing.add(entry.imageId);
  }

  if (added.length === 0) return pool;

  return {
    version: nextVersion,
    locations: [...pool.locations, ...added],
  };
}

export interface SpotEntry {
  imageId: string;
  name: string | null;
}

/**
 * Parses the JSON array `[{"imageId", "name"?}]` exported by the curator page
 * (`--import <file>`). Any other fields on an entry — including geometry, if the
 * export ever grew one — are ignored: the Mapillary Graph API remains the only
 * source of coordinates, exactly like a spots.txt line.
 */
export function parseImportJson(text: string): SpotEntry[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error('import file must contain a JSON array of {imageId, name?} entries');
  }
  return data.map((entry, i) => {
    const imageId = (entry as { imageId?: unknown } | null)?.imageId;
    if (typeof imageId !== 'string' || !imageId) {
      throw new Error(`import entry ${i} is missing a string imageId`);
    }
    const rawName = (entry as { name?: unknown }).name;
    return { imageId, name: typeof rawName === 'string' && rawName ? rawName : null };
  });
}

/** Keeps the first occurrence of each image id; drops later duplicates. Used to merge
 *  spots.txt entries with `--import`ed entries into one deduped run. */
export function dedupeSpots(entries: SpotEntry[]): SpotEntry[] {
  const seen = new Set<string>();
  const result: SpotEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.imageId)) continue;
    seen.add(entry.imageId);
    result.push(entry);
  }
  return result;
}

export async function fetchImage(imageId: string, token: string): Promise<MapillaryImage> {
  const url = `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=id,is_pano,computed_geometry`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapillary API ${res.status} for image ${imageId}`);
  return (await res.json()) as MapillaryImage;
}
