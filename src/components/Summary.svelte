<script lang="ts">
  import type { RoundResult } from '../lib/game.svelte';
  import type { ChallengeCode } from '../lib/seed';
  import {
    buildShareText, buildShareUrl, emojiBar, rankForScore, formatPoints,
    makePlayer, addToField, standings, type Player,
  } from '../lib/share';
  import { formatDistance, MAX_GAME_POINTS, missForPoints } from '../lib/score';
  import { renderShareCard } from '../lib/card';
  import Trophy from './Trophy.svelte';

  let { results, totalScore, code, field }: {
    results: RoundResult[];
    totalScore: number;
    code: ChallengeCode;
    field: Player[];
  } = $props();

  const rank = $derived(rankForScore(totalScore));
  const bar = $derived(emojiBar(results.map((r) => r.distanceM)));
  const alone = $derived(field.length === 0);

  // The pre-existing leader of the incoming field (before this run is added)
  // — the same notion the HUD compared against during play. Kept distinct
  // from the trophy in the standings table below, which marks position 1 of
  // the *final* board and may end up being the player themselves.
  const leader = $derived(field.length > 0 ? standings(field)[0].player : null);

  const outcome = $derived.by(() => {
    if (!leader) return null;
    const diff = totalScore - leader.total;
    const leaderName = leader.name ?? 'the leader';
    if (diff > 0) return `You beat ${leaderName} by ${formatPoints(diff)}`;
    if (diff < 0) return `${leader.name ?? 'The leader'} beat you by ${formatPoints(-diff)}`;
    return "It's a tie";
  });

  let playerName = $state(localStorage.getItem('goaguesser-name') ?? '');
  let copied = $state(false);
  let sharing = $state(false);
  let copyError = $state(false);
  let fallbackUrl = $state<string | null>(null);

  const me = $derived(makePlayer(playerName || null, results.map((r) => r.points)));
  // The board as it will look once this run is added — shown immediately so
  // the player sees themselves in the standings before they even share.
  const board = $derived(standings(addToField(field, me)));

  // Accuracy is derived, never carried in the URL: the current player's real
  // distances give the exact figure; everyone else's misses are recovered
  // from their scores via missForPoints (correct by construction, since those
  // scores were themselves produced by pointsForDistance).
  const myAvgMiss = $derived(
    results.reduce((sum, r) => sum + r.distanceM, 0) / results.length
  );
  function avgMissFor(player: Player): number {
    if (player === me) return myAvgMiss;
    return player.scores.reduce((sum, s) => sum + missForPoints(s), 0) / player.scores.length;
  }
  // "Most accurate" is only interesting once there's someone to compare
  // against — often a different person from the points leader.
  const mostAccurate = $derived(
    board.length >= 2
      ? board.reduce((best, cur) => (avgMissFor(cur.player) < avgMissFor(best.player) ? cur : best)).player
      : null
  );

  async function share() {
    sharing = true;
    copyError = false;
    fallbackUrl = null;
    try {
      localStorage.setItem('goaguesser-name', playerName);
      const finalField = addToField(field, me);
      const finalBoard = standings(finalField);
      const myPosition = finalBoard.find((b) => b.player === me)?.position ?? finalBoard.length;

      const url = buildShareUrl(window.location.origin + window.location.pathname, code, finalField);
      const text = buildShareText({
        rank, bar, total: totalScore, url,
        position: myPosition, fieldSize: finalField.length,
      });

      try {
        const blob = await renderShareCard({
          distances: results.map((r) => r.distanceM),
          rank, total: totalScore,
          position: myPosition, fieldSize: finalField.length,
          standings: finalBoard.map((s) => ({
            position: s.position, name: s.player.name, total: s.player.total, isMe: s.player === me,
          })),
        });
        const file = new File([blob], 'goaguesser.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch (err) {
        // A cancelled share sheet rejects with AbortError — that's the player
        // changing their mind, not a failure. Don't fall through to clipboard.
        if (err instanceof Error && err.name === 'AbortError') return;
        // Any other failure (unsupported API, card render error, ...) falls
        // through to the clipboard fallback below.
      }

      try {
        await navigator.clipboard.writeText(text);
        copied = true;
        setTimeout(() => (copied = false), 2000);
      } catch {
        copyError = true;
        fallbackUrl = url;
      }
    } finally {
      sharing = false;
    }
  }

  function playAgain() {
    window.location.href = window.location.origin + window.location.pathname; // bare URL → fresh seed
  }
</script>

<main class="w-full h-screen overflow-y-auto bg-[var(--porcelain)] text-[var(--ink)] flex flex-col items-center p-6 gap-5">
  <div class="trophy-moment text-[var(--azulejo)] mt-4" aria-hidden="true">
    <Trophy size={40} />
  </div>
  <h1 class="text-3xl font-black text-[var(--azulejo)] -mt-2" style="font-family: var(--font-display)">
    Challenge Complete
  </h1>

  <div class="card-flat px-10 py-5 text-center">
    <div class="text-5xl font-black font-mono tabular-nums text-[var(--azulejo)]">{formatPoints(totalScore)}</div>
    <div class="text-xs text-[var(--ink-faint)] uppercase tracking-widest mt-1 font-mono tabular-nums">/ {formatPoints(MAX_GAME_POINTS)}</div>
    <div class="text-[var(--ink)] font-bold mt-2 italic" style="font-family: var(--font-display)">{rank}</div>
    <div class="text-xs font-mono tabular-nums text-[var(--ink-soft)] mt-2">avg miss {formatDistance(myAvgMiss)}</div>
  </div>

  <div class="card-flat px-8 py-4 w-full max-w-md">
    <h2 class="text-sm font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">
      Standings{#if !alone} — {board.length} on the board{/if}
    </h2>
    <div class="flex flex-col gap-1">
      {#each board as { position, player }, i}
        <div
          class="standings-row relative flex items-center justify-between px-3 py-1.5 rounded-[4px] text-sm font-mono tabular-nums {player === me ? 'bg-[var(--azulejo-pale)] font-bold' : ''}"
          style="animation-delay: {300 + i * 50}ms">
          <span class="flex items-center gap-2">
            <span class="text-[var(--ink-faint)] w-5">{position}</span>
            <span class="truncate max-w-[9rem]">{player.name ?? (player === me ? 'You' : 'Player')}</span>
            {#if position === 1}<span class="text-[var(--azulejo)] shrink-0"><Trophy size={14} /></span>{/if}
            {#if player === mostAccurate}<span class="font-mono text-[10px] normal-case text-[var(--laterite)]">· most accurate</span>{/if}
          </span>
          <span class="text-[var(--ink)]">{formatPoints(player.total)}</span>
          {#if player === me}<span class="own-row-underline" aria-hidden="true"></span>{/if}
        </div>
      {/each}
    </div>
  </div>

  {#if leader}
    <div class="card-flat px-8 py-4 text-center w-full max-w-md">
      <div class="text-sm font-bold text-[var(--ink)] mb-2">
        {outcome}
      </div>
      <div class="flex flex-col gap-1">
        {#each results as r, i}
          <div class="flex items-center gap-2 text-xs font-mono tabular-nums">
            <span class="w-4 text-[var(--ink-faint)]">{i + 1}</span>
            <div class="flex-1 bg-[var(--rule)] rounded-[4px] h-2 overflow-hidden">
              <div class="bg-[var(--azulejo)] h-full" style="width:{(r.points / 5000) * 100}%"></div>
            </div>
            <div class="flex-1 bg-[var(--rule)] rounded-[4px] h-2 overflow-hidden">
              <div class="bg-[var(--laterite)] h-full" style="width:{((leader.scores[i] ?? 0) / 5000) * 100}%"></div>
            </div>
          </div>
        {/each}
        <div class="flex justify-between text-[10px] text-[var(--ink-faint)] uppercase mt-1">
          <span>You</span><span>{leader.name ?? 'Leader'}</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="w-full max-w-md flex flex-col gap-1.5">
    {#each results as r}
      <div class="card-flat flex items-center justify-between px-4 py-2 text-sm">
        <span class="italic" style="font-family: var(--font-display)">{r.location.name}</span>
        <span class="font-mono tabular-nums text-[var(--ink-soft)]">{formatDistance(r.distanceM)} · <span class="text-[var(--azulejo)]">+{formatPoints(r.points)}</span></span>
      </div>
    {/each}
  </div>

  <div class="flex flex-col sm:flex-row items-center gap-3 mb-6">
    <input
      bind:value={playerName}
      maxlength="20"
      placeholder="Your name (for the board)"
      class="bg-[var(--panel)] border border-[var(--rule)] rounded-[5px] px-4 py-2.5 text-sm w-56 placeholder:text-[var(--ink-faint)] text-[var(--ink)]"
    />
    <button onclick={share} disabled={sharing}
      class="btn-primary px-8 py-2.5 font-bold uppercase text-sm">
      {sharing ? 'Sharing…' : copied ? 'Copied!' : alone ? 'Share your score' : 'Add your score to the board'}
    </button>
    <button onclick={playAgain} class="btn-secondary px-6 py-2.5 font-bold uppercase text-sm">
      Play again
    </button>
  </div>

  {#if copyError && fallbackUrl}
    <div class="w-full max-w-md text-center text-xs text-[var(--laterite)] -mt-4 mb-4">
      <p>Couldn't copy — long-press the link instead</p>
      <p class="mt-1 font-mono text-[var(--ink-soft)] break-all select-all">{fallbackUrl}</p>
    </div>
  {/if}
</main>

<style>
  /* Delight (v2.1) — one orchestrated moment, docs/superpowers/specs/
     visual-identity.md. Outside the prefers-reduced-motion query below,
     every element here simply renders at its normal (final) state — the
     static end-state prefers-reduced-motion requires falls out for free,
     no extra rules needed. */
  .own-row-underline {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0;
    height: 1px;
    background: var(--azulejo);
    transform-origin: left;
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: no-preference) {
    .trophy-moment {
      animation: trophy-in 0.7s both;
      transform-origin: 50% 85%;
    }
    @keyframes trophy-in {
      0% {
        opacity: 0;
        transform: scale(0.7) rotate(0deg);
        animation-timing-function: cubic-bezier(0.2, 0.9, 0.3, 1.2);
      }
      64% {
        opacity: 1;
        transform: scale(1) rotate(-6deg);
        animation-timing-function: ease-out;
      }
      100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    .standings-row {
      animation: standings-row-in 0.3s ease both;
    }
    @keyframes standings-row-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .own-row-underline {
      animation: own-row-underline-in 0.3s ease 0.6s both;
    }
    @keyframes own-row-underline-in {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
  }
</style>
