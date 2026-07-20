import poolJson from '../data/locations.json';

export interface Location {
  imageId: string;
  name: string;
  lat: number;
  lng: number;
  version: number;
}

export interface LocationPool {
  version: number;
  locations: Location[];
}

export function poolAtVersion(pool: LocationPool, version: number): Location[] {
  return pool.locations.filter((l) => l.version <= version);
}

export function loadPool(): LocationPool {
  return poolJson as LocationPool;
}
