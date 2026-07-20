<script lang="ts">
  import PanoViewer from './components/PanoViewer.svelte';
  import GuessMap from './components/GuessMap.svelte';
  import Hud from './components/Hud.svelte';
  import GameFooter from './components/GameFooter.svelte';
  import Summary from './components/Summary.svelte';
  import { loadPool } from './lib/locations';
  import { dealGame, encodeChallenge, randomSeed, ROUNDS, BACKUPS, type ChallengeCode } from './lib/seed';
  import { parseGameParams, type Player } from './lib/share';
  import { createGame } from './lib/game.svelte';
  import { playPin, playReveal } from './lib/sound';

  const TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN as string;
  const pool = loadPool();

  // Resolve challenge code (falling back to a fresh seed) and the field of
  // everyone who has already played this link. `code` is resolved once,
  // synchronously, before first render — a plain `const` (rather than
  // `$state`) so it never needs to trigger a reactive update; the reactive
  // pieces of this setup (`field`) are declared with `$state` explicitly.
  const parsed = parseGameParams(window.location.search);
  let field: Player[] = $state(parsed.field);
  let deal = parsed.code ? dealGame(pool, parsed.code) : null;
  const code: ChallengeCode = deal ? parsed.code! : { seed: randomSeed(), poolVersion: pool.version };
  if (!deal) {
    field = []; // stale/malformed link: play a plain new game instead
    deal = dealGame(pool, code);
  }
  if (deal) {
    const url = new URL(window.location.href);
    url.searchParams.set('c', encodeChallenge(code));
    url.searchParams.delete('p');
    history.replaceState(null, '', url);
  }

  const game = deal ? createGame(deal) : null;

  const lastResult = $derived(
    game && game.results.length > 0 ? game.results[game.results.length - 1] : null
  );
</script>

{#if !game}
  <main class="w-full h-screen flex items-center justify-center bg-[var(--porcelain)] text-[var(--ink)] p-8 text-center">
    <div>
      <h1 class="text-2xl font-bold text-[var(--azulejo)] mb-2" style="font-family: var(--font-display)">Backyard: Goa</h1>
      <p>Not enough locations curated yet. Run <code class="bg-[var(--azulejo-pale)] text-[var(--azulejo)] px-1 rounded-[4px]">npm run curate</code> with at least {ROUNDS + BACKUPS} spots.</p>
    </div>
  </main>
{:else if game.phase === 'error'}
  <main class="w-full h-screen flex items-center justify-center bg-[var(--porcelain)] text-[var(--ink)] p-8 text-center">
    <div>
      <h1 class="text-2xl font-bold text-[var(--azulejo)] mb-2" style="font-family: var(--font-display)">Can't reach street view</h1>
      <p class="mb-4">Check your connection and try again.</p>
      <button onclick={() => location.reload()} class="btn-primary px-6 py-2 font-bold">Retry</button>
    </div>
  </main>
{:else if game.phase === 'summary'}
  <Summary results={game.results} totalScore={game.totalScore} {code} {field} />
{:else}
  <main class="w-full h-screen flex flex-col md:flex-row bg-[var(--porcelain)] text-[var(--ink)] overflow-hidden">
    <section
      class="w-full relative border-b md:border-b-0 md:border-r border-[var(--rule)] overflow-hidden"
      style="flex: {game.phase === 'scored' ? .85 : 1.25}">
      <PanoViewer
        imageId={game.currentLocation.imageId}
        token={TOKEN}
        onloaderror={() => game.substituteCurrent()}
      />
      <Hud round={game.roundIndex} totalScore={game.totalScore} {field} />
    </section>
    <section
      class="w-full flex flex-col"
      style="flex: {game.phase === 'scored' ? 1.4 : 1}">
      <div class="flex-grow relative">
        <GuessMap
          interactive={game.phase === 'playing'}
          roundIndex={game.roundIndex}
          result={game.phase === 'scored' ? lastResult : null}
          onpin={(lat, lng) => { game.pin(lat, lng); playPin(); }}
        />
      </div>
      <GameFooter
        phase={game.phase}
        result={lastResult}
        canSubmit={game.guess !== null}
        isLastRound={game.roundIndex === ROUNDS - 1}
        {field}
        roundIndex={game.roundIndex}
        onsubmit={() => {
          game.submit();
          const r = game.results[game.results.length - 1];
          if (r) playReveal(r.distanceM);
        }}
        onnext={() => game.next()}
      />
    </section>
  </main>
{/if}
