<script lang="ts">
  import type { Phase, RoundResult } from '../lib/game.svelte';
  import type { Player } from '../lib/share';
  import { formatDistance } from '../lib/score';
  import { formatPoints, standings } from '../lib/share';

  const VISIBLE_FIELD = 3;

  let { phase, result, canSubmit, isLastRound, cityName, timerSeconds, field, roundIndex, onsubmit, onnext }: {
    phase: Phase;
    result: RoundResult | null;
    canSubmit: boolean;
    isLastRound: boolean;
    cityName: string;
    timerSeconds: number | null;
    field: Player[];
    roundIndex: number;
    onsubmit: () => void;
    onnext: () => void;
  } = $props();

  // mm:ss for the per-round countdown (Delhi only; null elsewhere).
  const timerLabel = $derived(
    timerSeconds == null ? null : `${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, '0')}`
  );

  const topField = $derived(standings(field).slice(0, VISIBLE_FIELD));
  const fieldRemaining = $derived(Math.max(0, field.length - topField.length));
  const fieldRoundScores = $derived(
    topField.map(({ player }) => ({ name: player.name, points: player.scores[roundIndex] ?? 0 }))
  );
</script>

<footer class="w-full bg-[var(--panel)] border-t border-[var(--rule)] p-4 min-h-[90px] flex flex-col sm:flex-row items-center justify-between gap-4">
  {#if phase === 'playing'}
    <div class="text-center sm:text-left">
      <p class="text-sm font-semibold text-[var(--ink)]">Where in {cityName} is this?</p>
      <p class="text-xs text-[var(--ink-faint)] mt-0.5">Look around, then drop a pin on the map.</p>
    </div>
    <div class="flex items-center gap-3 w-full sm:w-auto">
      {#if timerLabel}
        <span
          class="font-mono tabular-nums text-lg font-bold shrink-0 {timerSeconds !== null && timerSeconds <= 10 ? 'text-[var(--laterite,#B84A2B)]' : 'text-[var(--ink)]'}"
          aria-label="Time left this round">
          {timerLabel}
        </span>
      {/if}
      <button
        disabled={!canSubmit}
        onclick={onsubmit}
        class="btn-primary w-full sm:w-auto px-6 py-2.5 font-bold uppercase text-xs tracking-wider">
        Submit guess
      </button>
    </div>
  {:else if phase === 'scored' && result}
    <div class="flex items-center gap-3 flex-wrap justify-center">
      <div class="card-flat stat-chip-in px-3 py-1.5" style="animation-delay: 0ms">
        <span class="text-[10px] text-[var(--ink-faint)] block uppercase font-bold">Distance</span>
        <span class="text-sm font-mono tabular-nums font-bold text-[var(--laterite)]">{formatDistance(result.distanceM)}</span>
      </div>
      <div class="card-flat stat-chip-in px-3 py-1.5" style="animation-delay: 40ms">
        <span class="text-[10px] text-[var(--ink-faint)] block uppercase font-bold">You</span>
        <span class="text-sm font-mono tabular-nums font-bold text-[var(--azulejo)]">+{formatPoints(result.points)}</span>
      </div>
      {#each fieldRoundScores as p, i}
        <div class="card-flat stat-chip-in px-3 py-1.5" style="animation-delay: {(i + 2) * 40}ms">
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
      class="btn-primary w-full sm:w-auto px-6 py-2.5 font-bold uppercase text-xs tracking-wider">
      {isLastRound ? 'See summary' : 'Next round'}
    </button>
  {/if}
</footer>
