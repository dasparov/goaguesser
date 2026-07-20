import { describe, it, expect } from 'vitest';
import { poolAtVersion, type LocationPool } from '../src/lib/locations';

const pool: LocationPool = {
  version: 2,
  locations: [
    { imageId: 'a', name: 'A', lat: 15.5, lng: 73.8, version: 1 },
    { imageId: 'b', name: 'B', lat: 15.4, lng: 73.9, version: 1 },
    { imageId: 'c', name: 'C', lat: 15.3, lng: 74.0, version: 2 },
  ],
};

describe('poolAtVersion', () => {
  it('includes only entries at or below the requested version', () => {
    expect(poolAtVersion(pool, 1).map((l) => l.imageId)).toEqual(['a', 'b']);
  });
  it('includes everything at the current version', () => {
    expect(poolAtVersion(pool, 2)).toHaveLength(3);
  });
});
