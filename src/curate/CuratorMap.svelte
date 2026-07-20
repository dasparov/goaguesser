<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import type { CuratorDot, FetchStatus } from './types';

  let {
    token,
    poolIds,
    keptIds,
    dots = $bindable([]),
    status = $bindable<FetchStatus>('zoom-in'),
    ondotclick,
  }: {
    token: string;
    poolIds: Set<string>;
    keptIds: Set<string>;
    dots?: CuratorDot[];
    status?: FetchStatus;
    ondotclick: (dot: CuratorDot) => void;
  } = $props();

  // Curator gets labelled tiles (unlike the game's GuessMap) — a curator needs place
  // names to know what they're looking at. docs/superpowers/specs/visual-identity.md
  // Part A spec.
  const GOA_CENTER: L.LatLngTuple = [15.35, 74.0];
  const GOA_ZOOM = 10;
  const MIN_FETCH_ZOOM = 12;
  const DEBOUNCE_MS = 400;

  function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  let el: HTMLDivElement;
  let map: L.Map | undefined;
  const markers = new Map<string, L.CircleMarker>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | undefined;

  function colorFor(id: string): string {
    if (poolIds.has(id)) return cssVar('--ink-faint');
    if (keptIds.has(id)) return cssVar('--emerald-solid');
    return cssVar('--azulejo');
  }

  function renderDots() {
    if (!map) return;
    for (const marker of markers.values()) map.removeLayer(marker);
    markers.clear();
    for (const dot of dots) {
      const marker = L.circleMarker([dot.lat, dot.lng], {
        radius: 6,
        color: '#fff',
        weight: 1,
        fillColor: colorFor(dot.id),
        fillOpacity: 1,
      }).addTo(map);
      marker.on('click', () => ondotclick(dot));
      markers.set(dot.id, marker);
    }
  }

  async function fetchViewport() {
    if (!map) return;
    if (map.getZoom() < MIN_FETCH_ZOOM) {
      abortController?.abort();
      status = 'zoom-in';
      dots = [];
      return;
    }

    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    status = 'loading';

    // Mapillary rejects bbox queries over 0.010 square degrees, so a whole
    // viewport at MIN_FETCH_ZOOM is too big for one request. Tile it into a
    // grid of sub-cells under the cap and fetch them in parallel.
    const MAX_CELL_AREA = 0.009;
    const MAX_CELLS = 12;
    const b = map.getBounds();
    const w = b.getWest();
    const s = b.getSouth();
    const e = b.getEast();
    const n = b.getNorth();
    const side = Math.sqrt(MAX_CELL_AREA);
    const cols = Math.max(1, Math.ceil((e - w) / side));
    const rows = Math.max(1, Math.ceil((n - s) / side));
    if (cols * rows > MAX_CELLS) {
      status = 'zoom-in';
      dots = [];
      return;
    }
    const cells: string[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        cells.push(
          [
            w + ((e - w) * i) / cols,
            s + ((n - s) * j) / rows,
            w + ((e - w) * (i + 1)) / cols,
            s + ((n - s) * (j + 1)) / rows,
          ].join(',')
        );
      }
    }

    try {
      const results = await Promise.all(
        cells.map(async (bbox) => {
          const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,computed_geometry&is_pano=true&bbox=${bbox}&limit=100`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Mapillary ${res.status}`);
          const json = (await res.json()) as { data?: Array<{ id: string; computed_geometry?: { coordinates: [number, number] } }> };
          return json.data ?? [];
        })
      );
      const seen = new Set<string>();
      const next: CuratorDot[] = [];
      for (const d of results.flat()) {
        if (seen.has(d.id) || !Array.isArray(d.computed_geometry?.coordinates)) continue;
        seen.add(d.id);
        next.push({
          id: d.id,
          lng: d.computed_geometry!.coordinates[0],
          lat: d.computed_geometry!.coordinates[1],
        });
      }
      dots = next;
      status = 'ready';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      status = 'error';
      dots = [];
    }
  }

  function scheduleFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchViewport, DEBOUNCE_MS);
  }

  onMount(() => {
    // zoomControl: false — the default top-left position collides with the toolbar
    // badge; re-added bottom-left instead, clear of every other overlay.
    map = L.map(el, { center: GOA_CENTER, zoom: GOA_ZOOM, zoomControl: false });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    map.on('moveend', scheduleFetch);
    map.on('zoomend', scheduleFetch);
    scheduleFetch();
  });

  $effect(() => {
    renderDots();
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    abortController?.abort();
    map?.remove();
  });
</script>

<div bind:this={el} class="w-full h-full"></div>
