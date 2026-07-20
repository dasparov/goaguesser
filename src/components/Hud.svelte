<script lang="ts">
  import type { Player } from '../lib/share';
  import { formatPoints, standings } from '../lib/share';
  import { isSoundOn, setSoundOn } from '../lib/sound';

  let { round, totalScore, field }: {
    round: number;
    totalScore: number;
    field: Player[];
  } = $props();

  // `field` is fixed at load time (whatever the shared link carried) — it
  // does not include the current run until the player finishes and shares.
  // "Leader" is simply the top scorer already on the board, if anyone is.
  const leader = $derived(field.length > 0 ? standings(field)[0].player : null);
  const leaderRunning = $derived(
    leader ? leader.scores.slice(0, round).reduce((a, b) => a + b, 0) : 0
  );

  let soundOn = $state(isSoundOn());
  function toggleSound() {
    setSoundOn(!soundOn);
    soundOn = !soundOn;
  }
</script>

<div class="absolute top-4 left-4 z-[1000] max-w-[calc(100vw-2rem)] bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
  <h1 class="text-sm font-bold uppercase tracking-wide text-[var(--azulejo)]" style="font-family: var(--font-display)">GoaGuesser</h1>
  <div class="h-4 w-px bg-[var(--rule)]"></div>
  <span class="text-xs font-mono tabular-nums text-[var(--ink-faint)]">Round {round + 1}/5</span>
  <div class="h-4 w-px bg-[var(--rule)]"></div>
  <span class="text-xs font-mono tabular-nums text-[var(--ink)]">You {formatPoints(totalScore)}</span>
  {#if leader}
    <span class="text-xs font-mono tabular-nums text-[var(--azulejo)] flex items-center gap-1 min-w-0">
      <span class="truncate max-w-[6rem]">{leader.name ?? 'Leader'}</span>
      <span class="shrink-0">{formatPoints(leaderRunning)}</span>
    </span>
  {/if}
  <button
    onclick={toggleSound}
    aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
    class="shrink-0 w-6 h-6 flex items-center justify-center border border-[var(--rule)] rounded-[4px]">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" />
      {#if !soundOn}<line x1="3" y1="3" x2="21" y2="21" />{/if}
    </svg>
  </button>
</div>

{#if leader}
  <div class="absolute top-16 left-4 z-[1000] bg-[var(--azulejo-pale)] border border-[var(--rule)] rounded-[4px] px-3 py-1 text-xs font-mono tabular-nums text-[var(--ink)]">
    {leader.name ?? 'Someone'} leads with {formatPoints(leader.total)} — {field.length} on the board
  </div>
{/if}

<div class="absolute bottom-1 left-1 z-[1000] text-[7.5px] text-[var(--ink-faint)] bg-[var(--panel)] px-1 rounded-[4px]">
  Imagery © <a class="underline" href="https://www.mapillary.com" target="_blank" rel="noreferrer">Mapillary</a>
  · Map © <a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
  © <a class="underline" href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>
</div>
