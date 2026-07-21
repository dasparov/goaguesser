import goaJson from '../data/goa.json';
import delhiJson from '../data/delhi.json';
import type { LocationPool } from './locations';
import { MAX_POINTS } from './score';
import { RANKS as GOA_RANKS, type RankTable } from './share';

/**
 * IMSpatial ships as one build serving several cities. The active city is
 * chosen at runtime from the `?city=` query param (default Goa), and carries
 * everything that differs between modes: the panorama pool, where the guess
 * map opens, how many rounds a game runs, whether a per-round timer applies,
 * and the flavour text (name + score ranks). Everything else — scoring,
 * sharing, the whole UI — is city-agnostic and reads from here.
 */
export interface City {
  id: 'goa' | 'delhi';
  name: string;
  center: [number, number];
  zoom: number;
  pool: LocationPool;
  rounds: number;
  backups: number;
  /** Seconds allowed to drop a pin each round, or null for no timer. */
  timerSec: number | null;
  maxGamePoints: number;
  ranks: RankTable;
}

export const APP_NAME = 'IMSpatial';

// Delhi's ranks mirror Goa's proportions, re-scaled to a 3-round max (15,000).
const DELHI_RANKS: RankTable = [
  [13501, 'True Dilliwala'],
  [10501, 'Purani Dilli Regular'],
  [7001, 'Nizamuddin Wanderer'],
  [3501, 'Metro Tourist'],
  [0, 'Lost in Transit'],
];

const CITIES: Record<string, City> = {
  goa: {
    id: 'goa',
    name: 'Goa',
    center: [15.35, 74.0],
    zoom: 10,
    pool: goaJson as LocationPool,
    rounds: 5,
    backups: 2,
    timerSec: null,
    maxGamePoints: 5 * MAX_POINTS,
    ranks: GOA_RANKS,
  },
  delhi: {
    id: 'delhi',
    name: 'Delhi',
    center: [28.57, 77.2],
    zoom: 10,
    pool: delhiJson as LocationPool,
    rounds: 3,
    backups: 2,
    timerSec: 60,
    maxGamePoints: 3 * MAX_POINTS,
    ranks: DELHI_RANKS,
  },
};

const DEFAULT_CITY = 'goa';

export function activeCity(search: string = window.location.search): City {
  const id = new URLSearchParams(search).get('city')?.toLowerCase() ?? '';
  return CITIES[id] ?? CITIES[DEFAULT_CITY];
}

export function cityTitle(city: City): string {
  return `${APP_NAME} · ${city.name}`;
}
