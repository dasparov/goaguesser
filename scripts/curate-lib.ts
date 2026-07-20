import type { Location, LocationPool } from '../src/lib/locations';
import { haversineM } from '../src/lib/score';

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

/**
 * Pure display-name edit: returns a new pool with exactly one entry's `name`
 * changed, same order, same pool version, everything else byte-identical.
 * Names are display-only — they must never touch id, coords, or version, so
 * old challenge links (which pin a pool version, not a name) stay intact.
 * Returns null if `imageId` isn't in the pool.
 */
export function renameLocation(pool: LocationPool, imageId: string, name: string): LocationPool | null {
  if (!pool.locations.some((l) => l.imageId === imageId)) return null;
  return {
    version: pool.version,
    locations: pool.locations.map((l) => (l.imageId === imageId ? { ...l, name } : l)),
  };
}

/** Audited coarse-area centers for --autoname (haversine nearest-center lookup). */
export const AREA_CENTERS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Arambol', lat: 15.697, lng: 73.694 },
  { name: 'Mandrem', lat: 15.642, lng: 73.723 },
  { name: 'Ashvem–Morjim', lat: 15.614, lng: 73.723 },
  { name: 'Candolim–Nerul', lat: 15.503, lng: 73.781 },
  { name: 'Canacona', lat: 14.975, lng: 74.044 },
];

/** The nearest audited area center's name, by haversine distance. */
export function nearestAreaName(lat: number, lng: number): string {
  return AREA_CENTERS.reduce((best, center) =>
    haversineM(lat, lng, center.lat, center.lng) < haversineM(lat, lng, best.lat, best.lng) ? center : best
  ).name;
}

/** A name that carries no real information — the untouched default, or blank. */
function isPlaceholderName(name: string): boolean {
  return name.trim() === '' || name.trim().toLowerCase() === 'somewhere in goa';
}

/**
 * For every location whose name is empty or "Somewhere in Goa"-ish, sets a
 * coarse area name from the nearest audited center. Names only — order, ids,
 * coords, and version are all untouched; real (already-set) names are left
 * exactly as they are.
 */
export function autonameLocations(pool: LocationPool): LocationPool {
  return {
    version: pool.version,
    locations: pool.locations.map((l) =>
      isPlaceholderName(l.name) ? { ...l, name: nearestAreaName(l.lat, l.lng) } : l
    ),
  };
}
