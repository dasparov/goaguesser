import { describe, it, expect } from 'vitest';
import { parseSpots, validateImage, toLocation, type MapillaryImage } from '../scripts/curate-lib';

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
