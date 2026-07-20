import type { BasketSpot } from './types';

const STORAGE_KEY = 'backyard-basket';

/** Reads the curator's kept-spots basket from localStorage. Never throws — a missing,
 *  corrupt, or inaccessible (private-mode) store just yields an empty basket. */
export function loadBasket(): BasketSpot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BasketSpot[]) : [];
  } catch {
    return [];
  }
}

/** Persists the basket. Best-effort — a full or blocked store silently no-ops rather
 *  than crashing the curator page; the export/copy buttons remain the reliable path. */
export function saveBasket(basket: BasketSpot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  } catch {
    // ignore
  }
}
