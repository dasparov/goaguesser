<script lang="ts">
  import PanoViewer from '../components/PanoViewer.svelte';
  import type { CuratorDot } from './types';

  let {
    dot,
    token,
    alreadyInPool,
    kept,
    onkeep,
    onclose,
  }: {
    dot: CuratorDot;
    token: string;
    alreadyInPool: boolean;
    kept: boolean;
    onkeep: (name: string) => void;
    onclose: () => void;
  } = $props();

  let name = $state('');
  let loadError = $state(false);

  // A fresh dot selection resets the panel's local state.
  $effect(() => {
    void dot.id;
    name = '';
    loadError = false;
  });
</script>

<div
  class="fixed inset-x-0 bottom-0 h-[46vh] md:h-[38vh] flex flex-col md:flex-row z-[1000] border-t"
  style="background: var(--panel); border-color: var(--rule)"
>
  <div class="flex-1 min-h-0 relative">
    <PanoViewer imageId={dot.id} {token} onloaderror={() => (loadError = true)} />
    {#if loadError}
      <div class="absolute inset-0 flex items-center justify-center p-6" style="background: var(--panel)">
        <p class="text-sm text-center" style="color: var(--ink-faint)">couldn't reach Mapillary</p>
      </div>
    {/if}
  </div>
  <div
    class="w-full md:w-72 shrink-0 p-4 flex flex-col gap-3 border-t md:border-t-0 md:border-l"
    style="border-color: var(--rule)"
  >
    <p class="font-mono text-xs" style="color: var(--ink-faint)">{dot.id}</p>
    {#if alreadyInPool}
      <p class="text-sm" style="color: var(--ink-faint)">Already in the game.</p>
    {:else}
      <input
        class="px-3 py-2 text-sm rounded-[4px] border"
        style="background: var(--porcelain); border-color: var(--rule); color: var(--ink)"
        placeholder="Name (optional)"
        bind:value={name}
      />
      <button class="btn-primary px-4 py-2 font-bold" disabled={kept} onclick={() => onkeep(name)}>
        {kept ? 'Kept' : 'Keep'}
      </button>
    {/if}
    <button class="btn-secondary px-4 py-2 mt-auto" onclick={onclose}>Close</button>
  </div>
</div>
