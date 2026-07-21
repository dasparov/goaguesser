<script lang="ts">
  import { onMount } from 'svelte';
  import CuratorMap from './CuratorMap.svelte';
  import SpotPanel from './SpotPanel.svelte';
  import BasketPanel from './BasketPanel.svelte';
  import { loadBasket, saveBasket } from './basket';
  import { activeCity } from '../lib/city';
  import type { CuratorDot, BasketSpot, FetchStatus } from './types';

  // Public client-side token, same as the game (see .env.example) — read-only Graph
  // API access, safe to bake into the bundle. Falls back to '' so the map/UI still
  // render when unset; the panorama and dot fetches then fail gracefully instead.
  const token = (import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined) ?? '';

  const poolIds = new Set(activeCity().pool.locations.map((l) => l.imageId));

  let basket = $state<BasketSpot[]>([]);
  let dots = $state<CuratorDot[]>([]);
  let status = $state<FetchStatus>('zoom-in');
  let selected = $state<CuratorDot | null>(null);
  // Phone-only bottom sheet toggle for the basket — desktop ignores this and
  // always shows the side panel (BasketPanel.svelte handles that itself).
  let basketOpen = $state(false);

  const keptIds = $derived(new Set(basket.map((b) => b.imageId)));

  onMount(() => {
    basket = loadBasket();
  });

  $effect(() => {
    saveBasket(basket);
  });

  // Never let the basket sheet and the spot sheet fight over the bottom of
  // the screen — opening one closes the other.
  function selectDot(dot: CuratorDot) {
    basketOpen = false;
    selected = dot;
  }

  function closePanel() {
    selected = null;
  }

  function openBasket() {
    selected = null;
    basketOpen = true;
  }

  function closeBasket() {
    basketOpen = false;
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selected) closePanel();
  }

  function keep(name: string) {
    if (!selected || poolIds.has(selected.id) || keptIds.has(selected.id)) return;
    basket = [...basket, { imageId: selected.id, name: name.trim(), lat: selected.lat, lng: selected.lng }];
  }

  function remove(imageId: string) {
    basket = basket.filter((b) => b.imageId !== imageId);
  }

  function clearBasket() {
    basket = [];
  }

  function surpriseMe() {
    const candidates = dots.filter((d) => !poolIds.has(d.id) && !keptIds.has(d.id));
    if (candidates.length === 0) return;
    selectDot(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  let mapComp: { flyTo: (lat: number, lng: number, zoom?: number) => void; resize: () => void } | undefined =
    $state();

  // Whenever an overlay opens or closes the visible map area can change —
  // force Leaflet to re-measure (same pattern as App.svelte's pane-flex
  // resize) so tiles never render grey or misaligned. Fired immediately and
  // again once any sheet transition has settled.
  $effect(() => {
    void selected;
    void basketOpen;
    mapComp?.resize();
    const settle = setTimeout(() => mapComp?.resize(), 400);
    return () => clearTimeout(settle);
  });

  // Where Goa's 360° imagery actually lives (API coverage audit, 2026-07-20).
  // Everywhere else in the state is nearly empty — lead the curator to the material.
  const HOTSPOTS = [
    { label: 'Arambol', lat: 15.697, lng: 73.694 },
    { label: 'Mandrem–Morjim', lat: 15.628, lng: 73.723 },
    { label: 'Candolim', lat: 15.503, lng: 73.781 },
  ];

  const statusText = $derived(
    status === 'zoom-in'
      ? 'zoom in'
      : status === 'loading'
        ? 'loading…'
        : status === 'error'
          ? "couldn't reach Mapillary"
          : `${dots.length} panoramas`
  );
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="h-screen w-screen relative overflow-hidden flex flex-col" style="background: var(--porcelain); color: var(--ink)">
  <!-- Top bar: one compact row. Hotspot chips scroll horizontally instead of
       wrapping/clipping, so this never grows past a single row at 360px. -->
  <div class="shrink-0 h-12 flex items-center gap-3 px-3 border-b" style="background: var(--panel); border-color: var(--rule)">
    <span class="font-display text-base shrink-0" style="color: var(--ink)">Curator</span>
    <span
      class="font-mono text-xs shrink-0"
      style="color: {status === 'error' ? 'var(--laterite)' : 'var(--ink-faint)'}"
    >
      {statusText}
    </span>
    <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
      {#each HOTSPOTS as h (h.label)}
        <button
          class="btn-secondary h-10 px-3 text-xs shrink-0 whitespace-nowrap inline-flex items-center"
          onclick={() => mapComp?.flyTo(h.lat, h.lng)}
        >
          {h.label}
        </button>
      {/each}
      <button
        class="btn-secondary h-10 px-3 text-xs shrink-0 whitespace-nowrap inline-flex items-center"
        disabled={dots.length === 0}
        onclick={surpriseMe}
      >
        Surprise me
      </button>
    </div>
  </div>

  <!-- The map is the page: it fills every pixel not claimed by the top bar. -->
  <div class="relative flex-1 min-w-0 min-h-0">
    <CuratorMap bind:this={mapComp} {token} {poolIds} {keptIds} bind:dots bind:status ondotclick={selectDot} />
  </div>

  <!-- Basket pill (phones only — md+ keeps the always-open side panel). -->
  <button
    class="md:hidden fixed z-[900] inline-flex items-center gap-1.5 px-4 h-11 rounded-full btn-primary"
    style="right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom))"
    aria-haspopup="dialog"
    aria-expanded={basketOpen}
    aria-label={`Open basket, ${basket.length} spot${basket.length === 1 ? '' : 's'} kept`}
    onclick={openBasket}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 8h16l-1.4 10.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </svg>
    <span class="font-mono text-sm">{basket.length}</span>
  </button>

  <BasketPanel {basket} open={basketOpen} onclose={closeBasket} onremove={remove} onclearbasket={clearBasket} />

  {#if selected}
    <SpotPanel
      dot={selected}
      {token}
      alreadyInPool={poolIds.has(selected.id)}
      kept={keptIds.has(selected.id)}
      onkeep={keep}
      onclose={closePanel}
    />
  {/if}
</div>
