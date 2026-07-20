<script lang="ts">
  import type { BasketSpot } from './types';

  let {
    basket,
    onremove,
  }: {
    basket: BasketSpot[];
    onremove: (imageId: string) => void;
  } = $props();

  let justExported = $state(false);
  let copied = $state(false);

  function exportJson() {
    const payload = basket.map((b) => ({ imageId: b.imageId, name: b.name || undefined }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backyard-spots.json';
    a.click();
    URL.revokeObjectURL(url);
    justExported = true;
  }

  async function copyForSpotsTxt() {
    const lines = basket.map((b) => (b.name ? `${b.imageId} # ${b.name}` : b.imageId)).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // clipboard permission denied — the export button remains the reliable path
    }
  }
</script>

<aside
  class="absolute top-4 right-4 bottom-4 w-64 max-w-[80vw] card-flat p-3 flex flex-col gap-3 z-[900] overflow-y-auto"
  style="background: var(--panel)"
>
  <div class="flex items-center justify-between">
    <h2 class="font-display text-base" style="color: var(--ink)">Basket</h2>
    <span class="font-mono text-sm" style="color: var(--ink-faint)">{basket.length}</span>
  </div>

  {#if basket.length === 0}
    <p class="text-xs" style="color: var(--ink-faint)">Click a dot on the map and Keep it.</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each basket as spot (spot.imageId)}
        <li class="flex items-center justify-between gap-2 text-sm">
          <span class="truncate" style="color: var(--ink-soft)">{spot.name || 'Somewhere in Goa'}</span>
          <button
            class="font-mono text-xs shrink-0"
            style="color: var(--laterite)"
            onclick={() => onremove(spot.imageId)}
          >
            remove
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex flex-col gap-2 mt-auto pt-2 border-t" style="border-color: var(--rule)">
    <button class="btn-primary px-3 py-2 text-sm font-bold" disabled={basket.length === 0} onclick={exportJson}>
      Export {basket.length} spots
    </button>
    <button class="btn-secondary px-3 py-2 text-sm" disabled={basket.length === 0} onclick={copyForSpotsTxt}>
      {copied ? 'Copied' : 'Copy for spots.txt'}
    </button>
    {#if justExported}
      <p class="font-mono text-[10px] leading-tight break-all" style="color: var(--ink-faint)">
        npm run curate -- --import ~/Downloads/backyard-spots.json
      </p>
    {/if}
  </div>
</aside>
