<script lang="ts">
  import type { Player } from '../lib/share';
  import { formatPoints, standings } from '../lib/share';

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
</script>

<div class="absolute top-4 left-4 z-[1000] max-w-[calc(100vw-2rem)] bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
  <h1 class="text-sm font-bold uppercase tracking-wide text-[var(--azulejo)]" style="font-family: var(--font-display)">Backyard: Goa</h1>
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
