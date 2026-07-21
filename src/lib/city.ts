import goaJson from '../data/goa.json';
import delhiJson from '../data/delhi.json';
import indiaJson from '../data/india.json';
import type { LocationPool } from './locations';
import { MAX_POINTS, CITY_SCALE, INDIA_SCALE, type DistanceScale } from './score';
import { RANKS as GOA_RANKS, type RankTable } from './share';

/**
 * IMSpatial ships as one build serving several modes. The active mode is chosen
 * at runtime from the `?city=` query param (default India), and carries
 * everything that differs: the panorama pool, where the guess map opens, how
 * many rounds a game runs, the per-round timer, the flavour text (name + score
 * ranks), and the distance scale (city modes score within a city; India scores
 * across the whole country). Everything else is mode-agnostic and reads here.
 */
export interface City {
  id: 'goa' | 'delhi' | 'india';
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
  scale: DistanceScale;
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

// India ranks — a whole-country traveller ladder, tuned to a 5-round max (25,000).
const INDIA_RANKS: RankTable = [
  [23001, 'Bharat Yatri'],
  [18001, 'Seasoned Wayfarer'],
  [12001, 'Cross-Country Rambler'],
  [6001, 'Weekend Wanderer'],
  [0, 'Armchair Tourist'],
];

const CITIES: Record<string, City> = {
  india: {
    id: 'india',
    name: 'India',
    center: [22.5, 79.0],
    zoom: 5,
    pool: indiaJson as LocationPool,
    rounds: 5,
    backups: 3,
    timerSec: 90,
    maxGamePoints: 5 * MAX_POINTS,
    ranks: INDIA_RANKS,
    scale: INDIA_SCALE,
  },
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
    scale: CITY_SCALE,
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
    scale: CITY_SCALE,
  },
};

const DEFAULT_CITY = 'india';

export function activeCity(search: string = window.location.search): City {
  const id = new URLSearchParams(search).get('city')?.toLowerCase() ?? '';
  return CITIES[id] ?? CITIES[DEFAULT_CITY];
}

export function cityTitle(city: City): string {
  return `${APP_NAME} · ${city.name}`;
}
