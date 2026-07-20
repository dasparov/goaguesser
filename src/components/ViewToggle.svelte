<script lang="ts">
  import type { ViewMode } from '../lib/viewMode';

  let { mode, onchange }: {
    mode: ViewMode;
    onchange: (mode: ViewMode) => void;
  } = $props();

  const OPTIONS: { value: ViewMode; label: string }[] = [
    { value: 'pano', label: 'Panorama only' },
    { value: 'split', label: 'Split view' },
    { value: 'map', label: 'Map only' },
  ];
</script>

<div class="view-toggle" role="group" aria-label="View mode">
  {#each OPTIONS as opt (opt.value)}
    <button
      type="button"
      aria-label={opt.label}
      aria-pressed={mode === opt.value}
      onclick={() => onchange(opt.value)}
      class="view-toggle-btn">
      {#if opt.value === 'pano'}
        <!-- panorama / globe: a sphere with a meridian and the equator -->
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      {:else if opt.value === 'split'}
        <!-- split view: two stacked rounded rects -->
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
          <rect x="3.5" y="3" width="17" height="7.5" rx="2" />
          <rect x="3.5" y="13.5" width="17" height="7.5" rx="2" />
        </svg>
      {:else}
        <!-- map: a pin -->
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 21s-7-7.58-7-12a7 7 0 0 1 14 0c0 4.42-7 12-7 12z" />
          <circle cx="12" cy="9" r="2.3" />
        </svg>
      {/if}
    </button>
  {/each}
</div>

<style>
  .view-toggle {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: 999px;
  }

  .view-toggle-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-soft);
    transition: background-color .12s ease, color .12s ease;
  }

  .view-toggle-btn[aria-pressed='true'] {
    background: var(--azulejo);
    color: var(--porcelain);
  }

  .view-toggle-btn:focus-visible {
    outline: 2px solid var(--azulejo);
    outline-offset: 2px;
  }
</style>
