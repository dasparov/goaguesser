import { describe, it, expect } from 'vitest';
import {
  parseSpots,
  validateImage,
  toLocation,
  applyCuratedLocations,
  parseImportJson,
  dedupeSpots,
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
