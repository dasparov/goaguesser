import { describe, it, expect } from 'vitest';
import {
  parseSpots,
  validateImage,
  toLocation,
  applyCuratedLocations,
  parseImportJson,
  dedupeSpots,
  renameLocation,
  autonameLocations,
  nearestAreaName,
  type MapillaryImage,
} from '../scripts/curate-lib';
import type { Location, LocationPool } from '../src/lib/locations';

const goodImg = (id = '123'): MapillaryImage => ({
  id, is_pano: true, computed_geometry: { coordinates: [73.83, 15.49] }, // [lng, lat]
});

describe('parseSpots', () => {
  it('parses ids with optional names, skipping blanks and comment lines', () => {
    const text = `# my Goa picks\n123456 # Fontainhas\n\n789012\n   \n# note\n345678#Baga bend`;
    expect(parseSpots(text)).toEqual([
      { imageId: '123456', name: 'Fontainhas' },
      { imageId: '789012', name: null },
      { imageId: '345678', name: 'Baga bend' },
    ]);
  });

  it('extracts the image id from a full Mapillary URL containing pKey', () => {
    const text = 'https://www.mapillary.com/app/?pKey=1234567890&focus=photo&lat=15.49&lng=73.83';
    expect(parseSpots(text)).toEqual([{ imageId: '1234567890', name: null }]);
  });

  it('extracts the image id from a full Mapillary URL and keeps the trailing name', () => {
    const text = 'https://www.mapillary.com/app/?pKey=1234567890&focus=photo&lat=15.49&lng=73.83 # Baga bend';
    expect(parseSpots(text)).toEqual([{ imageId: '1234567890', name: 'Baga bend' }]);
  });

  it('skips a malformed Mapillary URL that has no pKey param', () => {
    const text = 'bare-id-kept\nhttps://www.mapillary.com/app/?focus=photo&lat=15.49&lng=73.83\nanother-id-kept';
    expect(parseSpots(text)).toEqual([
      { imageId: 'bare-id-kept', name: null },
      { imageId: 'another-id-kept', name: null },
    ]);
  });
});

describe('validateImage', () => {
  it('accepts a pano inside Goa', () => {
    expect(validateImage(goodImg(), new Set())).toBeNull();
  });
  it('rejects non-panos', () => {
    expect(validateImage({ ...goodImg(), is_pano: false }, new Set())).toMatch(/not a 360/i);
  });
  it('rejects duplicates', () => {
    expect(validateImage(goodImg('123'), new Set(['123']))).toMatch(/already/i);
  });
  it('rejects coordinates outside Goa', () => {
    const mumbai: MapillaryImage = { id: 'x', is_pano: true, computed_geometry: { coordinates: [72.87, 19.07] } };
    expect(validateImage(mumbai, new Set())).toMatch(/outside goa/i);
  });
  it('rejects a missing computed_geometry with a clear message instead of throwing', () => {
    const malformed = { id: 'no-geo', is_pano: true, computed_geometry: undefined } as unknown as MapillaryImage;
    expect(() => validateImage(malformed, new Set())).not.toThrow();
    expect(validateImage(malformed, new Set())).toMatch(/missing.*geometry|geometry.*missing/i);
  });
  it('rejects null coordinates with a clear message instead of throwing', () => {
    const malformed = {
      id: 'null-coords',
      is_pano: true,
      computed_geometry: { coordinates: null },
    } as unknown as MapillaryImage;
    expect(() => validateImage(malformed, new Set())).not.toThrow();
    expect(validateImage(malformed, new Set())).toMatch(/missing.*geometry|malformed.*geometry|geometry.*malformed/i);
  });
});

describe('applyCuratedLocations', () => {
  const existingLocation = (imageId: string, version = 1): Location => ({
    imageId,
    name: `Spot ${imageId}`,
    lat: 15.49,
    lng: 73.83,
    version,
  });

  const entry = (imageId: string, name: string | null = null) => ({
    imageId,
    name,
    img: goodImg(imageId),
  });

  it('appends new entries and leaves every pre-existing entry byte-identical and in original order', () => {
    const pre = [existingLocation('1'), existingLocation('2'), existingLocation('3')];
    const pool: LocationPool = { version: 1, locations: pre };

    const result = applyCuratedLocations(pool, [entry('4', 'Fourth'), entry('5', 'Fifth')]);

    expect(result.locations.slice(0, 3)).toEqual(pre);
    expect(result.locations[0]).toBe(pre[0]);
    expect(result.locations[1]).toBe(pre[1]);
    expect(result.locations[2]).toBe(pre[2]);
    expect(result.locations.map((l) => l.imageId)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('stamps new entries with the bumped pool version', () => {
    const pool: LocationPool = { version: 4, locations: [existingLocation('1', 4)] };

    const result = applyCuratedLocations(pool, [entry('2', 'New spot')]);

    expect(result.version).toBe(5);
    const added = result.locations.find((l) => l.imageId === '2');
    expect(added?.version).toBe(5);
  });

  it('bumps the pool version only when at least one entry is actually added', () => {
    const pool: LocationPool = { version: 2, locations: [existingLocation('1', 2)] };

    const result = applyCuratedLocations(pool, []);

    expect(result.version).toBe(2);
    expect(result.locations).toEqual(pool.locations);
  });

  it('does not add an image ID already present in the pool twice across separate runs', () => {
    const firstRun = applyCuratedLocations({ version: 1, locations: [] }, [entry('1', 'First')]);
    expect(firstRun.version).toBe(2);
    expect(firstRun.locations).toHaveLength(1);

    const secondRun = applyCuratedLocations(firstRun, [entry('1', 'First again'), entry('2', 'Second')]);

    expect(secondRun.locations.filter((l) => l.imageId === '1')).toHaveLength(1);
    expect(secondRun.locations.map((l) => l.imageId)).toEqual(['1', '2']);
    expect(secondRun.version).toBe(3);
  });

  it('handles the empty pool (the current shipped state) correctly', () => {
    const emptyPool: LocationPool = { version: 1, locations: [] };

    const result = applyCuratedLocations(emptyPool, [entry('1', 'Fontainhas')]);

    expect(result).toEqual({
      version: 2,
      locations: [{ imageId: '1', name: 'Fontainhas', lat: 15.49, lng: 73.83, version: 2 }],
    });
  });

  it('leaves an empty pool with no new entries completely unchanged', () => {
    const emptyPool: LocationPool = { version: 1, locations: [] };

    const result = applyCuratedLocations(emptyPool, []);

    expect(result).toEqual(emptyPool);
  });
});

describe('parseImportJson', () => {
  it('parses a JSON array of {imageId, name} exported by the curator page', () => {
    const text = JSON.stringify([
      { imageId: '111', name: 'Fontainhas' },
      { imageId: '222', name: '' },
      { imageId: '333' },
    ]);
    expect(parseImportJson(text)).toEqual([
      { imageId: '111', name: 'Fontainhas' },
      { imageId: '222', name: null },
      { imageId: '333', name: null },
    ]);
  });

  it('ignores any geometry fields present in the file — the API remains the source of coordinates', () => {
    const text = JSON.stringify([{ imageId: '111', name: 'X', lat: 15.49, lng: 73.83 }]);
    expect(parseImportJson(text)).toEqual([{ imageId: '111', name: 'X' }]);
  });

  it('throws a clear error when the file is not a JSON array', () => {
    expect(() => parseImportJson(JSON.stringify({ imageId: '111' }))).toThrow(/array/i);
  });

  it('throws a clear error when an entry has no imageId', () => {
    expect(() => parseImportJson(JSON.stringify([{ name: 'no id' }]))).toThrow(/imageId/i);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseImportJson('not json')).toThrow();
  });
});

describe('dedupeSpots', () => {
  it('keeps the first occurrence of each image id and drops later duplicates', () => {
    const entries = [
      { imageId: '1', name: 'From spots.txt' },
      { imageId: '2', name: null },
      { imageId: '1', name: 'From import' },
      { imageId: '3', name: 'Third' },
    ];
    expect(dedupeSpots(entries)).toEqual([
      { imageId: '1', name: 'From spots.txt' },
      { imageId: '2', name: null },
      { imageId: '3', name: 'Third' },
    ]);
  });

  it('returns an empty array unchanged', () => {
    expect(dedupeSpots([])).toEqual([]);
  });
});

describe('toLocation', () => {
  it('maps GeoJSON [lng, lat] to lat/lng fields and stamps the version', () => {
    expect(toLocation('123', 'Panjim', goodImg(), 3)).toEqual({
      imageId: '123', name: 'Panjim', lat: 15.49, lng: 73.83, version: 3,
    });
  });
  it('falls back to a generic name', () => {
    expect(toLocation('123', null, goodImg(), 1).name).toBe('Somewhere in Goa');
  });
});

describe('renameLocation', () => {
  const loc = (imageId: string, name: string): Location => ({
    imageId, name, lat: 15.49, lng: 73.83, version: 1,
  });

  it('changes only the named entry, keeping order, other fields, and pool version', () => {
    const pool: LocationPool = {
      version: 3,
      locations: [loc('1', 'First'), loc('2', 'Second'), loc('3', 'Third')],
    };

    const result = renameLocation(pool, '2', 'Renamed Spot');

    expect(result).not.toBeNull();
    expect(result!.version).toBe(3);
    expect(result!.locations.map((l) => l.name)).toEqual(['First', 'Renamed Spot', 'Third']);
    expect(result!.locations.map((l) => l.imageId)).toEqual(['1', '2', '3']);
    // untouched entries are byte-identical (same reference)
    expect(result!.locations[0]).toBe(pool.locations[0]);
    expect(result!.locations[2]).toBe(pool.locations[2]);
    // the renamed entry keeps its own id/coords/version — only name differs
    expect(result!.locations[1]).toEqual({ ...loc('2', 'Renamed Spot') });
  });

  it('does not mutate the input pool', () => {
    const pool: LocationPool = { version: 1, locations: [loc('1', 'First')] };
    renameLocation(pool, '1', 'Changed');
    expect(pool.locations[0].name).toBe('First');
  });

  it('returns null when the imageId is not present', () => {
    const pool: LocationPool = { version: 1, locations: [loc('1', 'First')] };
    expect(renameLocation(pool, 'missing', 'X')).toBeNull();
  });
});

describe('nearestAreaName', () => {
  it('names the nearest of the audited area centers by haversine distance', () => {
    expect(nearestAreaName(15.697, 73.694)).toBe('Arambol');
    expect(nearestAreaName(15.642, 73.723)).toBe('Mandrem');
    expect(nearestAreaName(15.614, 73.723)).toBe('Ashvem–Morjim');
    expect(nearestAreaName(15.503, 73.781)).toBe('Candolim–Nerul');
    expect(nearestAreaName(14.975, 74.044)).toBe('Canacona');
  });

  it('picks the closest center for a point that is not exactly on one', () => {
    // just south of Arambol's center, still clearly closer to Arambol than Mandrem
    expect(nearestAreaName(15.69, 73.695)).toBe('Arambol');
  });
});

describe('autonameLocations', () => {
  const loc = (imageId: string, name: string, lat: number, lng: number): Location => ({
    imageId, name, lat, lng, version: 1,
  });

  it('replaces placeholder names with a coarse area name, leaving real names untouched', () => {
    const pool: LocationPool = {
      version: 1,
      locations: [
        loc('1', 'Somewhere in Goa', 15.697, 73.694), // Arambol
        loc('2', 'Fontainhas', 15.503, 73.781), // already named — untouched
        loc('3', '', 14.975, 74.044), // Canacona, empty name
      ],
    };

    const result = autonameLocations(pool);

    expect(result.locations.map((l) => l.name)).toEqual(['Arambol', 'Fontainhas', 'Canacona']);
    expect(result.version).toBe(1);
    expect(result.locations.map((l) => l.imageId)).toEqual(['1', '2', '3']);
    // untouched entry is byte-identical (same reference)
    expect(result.locations[1]).toBe(pool.locations[1]);
  });

  it('leaves a pool with no placeholder names completely unchanged', () => {
    const pool: LocationPool = { version: 2, locations: [loc('1', 'Fontainhas', 15.49, 73.83)] };
    const result = autonameLocations(pool);
    expect(result).toEqual(pool);
  });

  it('is case-insensitive about the placeholder name', () => {
    const pool: LocationPool = {
      version: 1,
      locations: [loc('1', 'somewhere in goa', 15.697, 73.694)],
    };
    expect(autonameLocations(pool).locations[0].name).toBe('Arambol');
  });
});
