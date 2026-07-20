<script lang="ts">
  import type { Phase, RoundResult } from '../lib/game.svelte';
  import type { Player } from '../lib/share';
  import { formatDistance } from '../lib/score';
  import { formatPoints, standings } from '../lib/share';

  const VISIBLE_FIELD = 3;

  let { phase, result, canSubmit, isLastRound, field, roundIndex, onsubmit, onnext }: {
    phase: Phase;
    result: RoundResult | null;
    canSubmit: boolean;
    isLastRound: boolean;
    field: Player[];
    roundIndex: number;
    onsubmit: () => void;
    onnext: () => void;
  } = $props();

  const topField = $derived(standings(field).slice(0, VISIBLE_FIELD));
  const fieldRemaining = $derived(Math.max(0, field.length - topField.length));
  const fieldRoundScores = $derived(
    topField.map(({ player }) => ({ name: player.name, points: player.scores[roundIndex] ?? 0 }))
  );
</script>

<footer class="w-full bg-[var(--panel)]/95 backdrop-blur border-t border-[var(--rule)] p-4 min-h-[90px] flex flex-col sm:flex-row items-center justify-between gap-4">
  {#if phase === 'playing'}
    <div class="text-center sm:text-left">
      <p class="text-sm font-semibold text-[var(--ink)]">Where in Goa is this?</p>
      <p class="text-xs text-[var(--ink-faint)] mt-0.5">Look around, then drop a pin on the map.</p>
    </div>
    <button
      disabled={!canSubmit}
      onclick={onsubmit}
      class="w-full sm:w-auto px-6 py-2.5 bg-[var(--azulejo)] disabled:bg-[var(--rule)] disabled:text-[var(--ink-faint)] hover:opacity-90 text-white disabled:cursor-not-allowed font-bold uppercase text-xs tracking-wider rounded-[5px] transition-opacity">
      Submit guess
    </button>
  {:else if phase === 'scored' && result}
    <div class="flex items-center gap-3 flex-wrap justify-center">
      <div class="bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-3 py-1.5">
        <span class="text-[10px] text-[var(--ink-faint)] block uppercase font-bold">Distance</span>
        <span class="text-sm font-mono tabular-nums font-bold text-[var(--laterite)]">{formatDistance(result.distanceM)}</span>
      </div>
      <div class="bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-3 py-1.5">
        <span class="text-[10px] text-[var(--ink-faint)] block uppercase font-bold">You</span>
        <span class="text-sm font-mono tabular-nums font-bold text-[var(--azulejo)]">+{formatPoints(result.points)}</span>
      </div>
      {#each fieldRoundScores as p}
        <div class="bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-3 py-1.5">
          <span class="text-[10px] text-[var(--ink-faint)] block uppercase font-bold truncate max-w-[6rem]">{p.name ?? 'Player'}</span>
          <span class="text-sm font-mono tabular-nums font-bold text-[var(--ink-soft)]">+{formatPoints(p.points)}</span>
        </div>
      {/each}
      {#if fieldRemaining > 0}
        <span class="text-[10px] font-mono tabular-nums text-[var(--ink-faint)]">+{fieldRemaining} more on the board</span>
      {/if}
      <span class="text-xs italic text-[var(--ink-soft)]" style="font-family: var(--font-display)">{result.location.name}</span>
    </div>
    <button
      onclick={onnext}
      class="w-full sm:w-auto px-6 py-2.5 bg-[var(--azulejo)] hover:opacity-90 text-white font-bold uppercase text-xs tracking-wider rounded-[5px] transition-opacity">
      {isLastRound ? 'See summary' : 'Next round'}
    </button>
  {/if}
</footer>
