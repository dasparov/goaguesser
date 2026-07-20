<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import type { RoundResult } from '../lib/game.svelte';

  let { interactive, roundIndex, result, onpin }: {
    interactive: boolean;
    roundIndex: number;
    result: RoundResult | null;
    onpin: (lat: number, lng: number) => void;
  } = $props();

  const GOA_CENTER: L.LatLngTuple = [15.35, 74.0];
  const GOA_ZOOM = 10;

  // Visual identity (docs/superpowers/specs/visual-identity.md): marker colors are
  // load-bearing — amber for the guess pin, emerald for the actual-answer pin,
  // laterite for the dashed reveal line. Keep these three visually distinct.
  const AMBER = '#C8801A';
  const EMERALD = '#1B7A4E';
  const LATERITE = '#B84A2B';

  // First-ever reveal on this device gets two tiny labels explaining which
  // pin is which; never again after that (once-only onboarding hint).
  const REVEAL_LABEL_FLAG = 'goaguesser-seen-reveal';
  let showFirstRevealLabels = !localStorage.getItem(REVEAL_LABEL_FLAG);

  let el: HTMLDivElement;
  let map: L.Map | undefined;
  let guessMarker: L.Marker | null = null;
  let actualMarker: L.Marker | null = null;
  let line: L.Polyline | null = null;

  const pinIcon = (bg: string) =>
    L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center"><div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:${bg};border:1.5px solid white;transform:rotate(-45deg)"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 23],
    });

  onMount(() => {
    map = L.map(el, { center: GOA_CENTER, zoom: GOA_ZOOM });
    // Labeled tiles by owner decision after the first playtest: recognising a
    // place from the panorama is the skill; finding it on the map shouldn't be.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!interactive) return;
      onpin(e.latlng.lat, e.latlng.lng);
      if (guessMarker) guessMarker.setLatLng(e.latlng);
      else guessMarker = L.marker(e.latlng, { icon: pinIcon(AMBER) }).addTo(map!);
    });
  });

  // New round: clear all layers, reset the view.
  $effect(() => {
    void roundIndex;
    if (!map) return;
    for (const layer of [guessMarker, actualMarker, line]) layer && map.removeLayer(layer);
    guessMarker = actualMarker = line = null;
    map.setView(GOA_CENTER, GOA_ZOOM);
  });

  // Reveal: answer marker + dashed line + fit both pins.
  $effect(() => {
    if (!map || !result) return;
    const actual: L.LatLngTuple = [result.location.lat, result.location.lng];
    const guessed: L.LatLngTuple = [result.guessLat, result.guessLng];
    actualMarker = L.marker(actual, { icon: pinIcon(EMERALD) }).addTo(map);
    line = L.polyline([guessed, actual], { color: LATERITE, weight: 3, dashArray: '6 6' }).addTo(map);
    map.fitBounds(L.latLngBounds([guessed, actual]).pad(0.25));

    if (showFirstRevealLabels && guessMarker) {
      // Push each label outward, away from the other pin, so both stay clear
      // of the dashed line running between them.
      const guessedIsWest = guessed[1] < actual[1];
      const labelOpts = (direction: 'left' | 'right'): L.TooltipOptions => ({
        permanent: true,
        direction,
        className: 'goaguesser-reveal-label',
        offset: [0, -12],
      });
      guessMarker.bindTooltip('your guess', labelOpts(guessedIsWest ? 'left' : 'right')).openTooltip();
      actualMarker.bindTooltip('the spot', labelOpts(guessedIsWest ? 'right' : 'left')).openTooltip();
      localStorage.setItem(REVEAL_LABEL_FLAG, '1');
      showFirstRevealLabels = false;
    }
  });

  onDestroy(() => map?.remove());

  // Imperative resize hook for the view-mode toggle (App.svelte) — called via
  // bind:this right after a pane's flex value changes, and again once the
  // CSS transition settles. Leaflet caches its container size and does not
  // watch it itself, so a hidden-then-shown map renders stale/grey tiles
  // until invalidateSize() forces it to re-measure and redraw.
  export function resize() {
    map?.invalidateSize();
  }
</script>

<div bind:this={el} class="w-full h-full"></div>

<style>
  /* Flat, hairline-bordered tooltip matching card/panel tokens (docs/superpowers/
     specs/visual-identity.md) — overrides Leaflet's default white-box-shadow
     tooltip chrome and hides its pointer arrow. Global because Leaflet appends
     these elements outside Svelte's scoped template. */
  :global(.goaguesser-reveal-label) {
    background: var(--panel);
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    box-shadow: none;
    white-space: nowrap;
  }
  :global(.goaguesser-reveal-label::before) {
    display: none;
  }
</style>
