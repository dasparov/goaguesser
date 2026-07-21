// Player's basemap preference: dark (default, matching the app) or light.
// Persisted like sound.ts / viewMode.ts, guarded so it also imports cleanly in
// Node-environment tests where `localStorage` doesn't exist.

export type MapTheme = 'dark' | 'light';

const STORAGE_KEY = 'imspatial-map';

export const TILE_URL: Record<MapTheme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

export function loadMapTheme(): MapTheme {
  if (typeof localStorage === 'undefined') return 'dark';
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function saveMapTheme(theme: MapTheme): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
}
