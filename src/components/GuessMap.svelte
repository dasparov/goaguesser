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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
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
  });

  onDestroy(() => map?.remove());
</script>

<div bind:this={el} class="w-full h-full"></div>
