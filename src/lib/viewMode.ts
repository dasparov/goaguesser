// Play-area view mode: full panorama, full map, or today's split. Persisted
// so the player's choice survives rounds and reloads — same localStorage
// pattern as sound.ts (guarded, since this module is also imported from
// Node-environment tests where `localStorage` doesn't exist).

export type ViewMode = 'split' | 'pano' | 'map';

const STORAGE_KEY = 'goaguesser-view';
const VALID: readonly ViewMode[] = ['split', 'pano', 'map'];

function isViewMode(value: string | null): value is ViewMode {
  return value !== null && (VALID as readonly string[]).includes(value);
}

// Invalid or absent storage (first visit, cleared storage, corrupted value)
// falls back to 'split' — today's default behavior.
export function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return 'split';
  const raw = localStorage.getItem(STORAGE_KEY);
  return isViewMode(raw) ? raw : 'split';
}

export function saveViewMode(mode: ViewMode): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
}

// Flex values for the panorama/map panes. 'pano'/'map' fill the play area
// and collapse the other pane to zero; 'split' preserves today's exact
// proportions, including the existing reveal-time shift (the map grows and
// the panorama shrinks once the round is scored, so the distance line gets
// more room).
export function paneFlex(mode: ViewMode, scored: boolean): { pano: number; map: number } {
  if (mode === 'pano') return { pano: 1, map: 0 };
  if (mode === 'map') return { pano: 0, map: 1 };
  return scored ? { pano: 0.85, map: 1.4 } : { pano: 1.25, map: 1 };
}
