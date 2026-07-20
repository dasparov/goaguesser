<script lang="ts">
  import { onMount } from 'svelte';
  import CuratorMap from './CuratorMap.svelte';
  import SpotPanel from './SpotPanel.svelte';
  import BasketPanel from './BasketPanel.svelte';
  import { loadBasket, saveBasket } from './basket';
  import { loadPool } from '../lib/locations';
  import type { CuratorDot, BasketSpot, FetchStatus } from './types';

  // Public client-side token, same as the game (see .env.example) — read-only Graph
  // API access, safe to bake into the bundle. Falls back to '' so the map/UI still
  // render when unset; the panorama and dot fetches then fail gracefully instead.
  const token = (import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined) ?? '';

  const poolIds = new Set(loadPool().locations.map((l) => l.imageId));

  let basket = $state<BasketSpot[]>([]);
  let dots = $state<CuratorDot[]>([]);
  let status = $state<FetchStatus>('zoom-in');
  let selected = $state<CuratorDot | null>(null);

  const keptIds = $derived(new Set(basket.map((b) => b.imageId)));

  onMount(() => {
    basket = loadBasket();
  });

  $effect(() => {
    saveBasket(basket);
  });

  function selectDot(dot: CuratorDot) {
    selected = dot;
  }

  function closePanel() {
    selected = null;
  }

  function keep(name: string) {
    if (!selected || poolIds.has(selected.id) || keptIds.has(selected.id)) return;
    basket = [...basket, { imageId: selected.id, name: name.trim(), lat: selected.lat, lng: selected.lng }];
  }

  function remove(imageId: string) {
    basket = basket.filter((b) => b.imageId !== imageId);
  }

  function surpriseMe() {
    const candidates = dots.filter((d) => !poolIds.has(d.id) && !keptIds.has(d.id));
    if (candidates.length === 0) return;
    selectDot(candidates[Math.floor(Math.random() * candidates.length)]);
  }
</script>

<div class="h-screen w-screen relative overflow-hidden" style="background: var(--porcelain); color: var(--ink)">
  <CuratorMap {token} {poolIds} {keptIds} bind:dots bind:status ondotclick={selectDot} />

  <div class="absolute top-4 left-4 flex items-start gap-3 z-[900]">
    <div class="card-flat px-3 py-2" style="background: var(--panel)">
      <h1 class="font-display text-lg leading-tight" style="color: var(--ink)">GoaGuesser curator</h1>
      {#if status === 'zoom-in'}
        <p class="text-xs mt-0.5" style="color: var(--ink-faint)">zoom in to load panoramas</p>
      {:else if status === 'loading'}
        <p class="text-xs mt-0.5" style="color: var(--ink-faint)">loading panoramas…</p>
      {:else if status === 'error'}
        <p class="text-xs mt-0.5" style="color: var(--laterite)">couldn't reach Mapillary</p>
      {:else}
        <p class="text-xs mt-0.5 font-mono" style="color: var(--ink-faint)">{dots.length} panoramas here</p>
      {/if}
    </div>
    <button class="btn-secondary px-3 py-2 text-sm self-start" disabled={dots.length === 0} onclick={surpriseMe}>
      Surprise me
    </button>
  </div>

  <BasketPanel {basket} onremove={remove} />

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
