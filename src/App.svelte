<script lang="ts">
  import PanoViewer from './components/PanoViewer.svelte';
  import GuessMap from './components/GuessMap.svelte';
  import Hud from './components/Hud.svelte';
  import GameFooter from './components/GameFooter.svelte';
  import Summary from './components/Summary.svelte';
  import ViewToggle from './components/ViewToggle.svelte';
  import PixelPin from './components/PixelPin.svelte';
  import { dealGame, encodeChallenge, randomSeed, type ChallengeCode } from './lib/seed';
  import { parseGameParams, type Player } from './lib/share';
  import { createGame } from './lib/game.svelte';
  import { playPin, playReveal } from './lib/sound';
  import { loadViewMode, saveViewMode, paneFlex, type ViewMode } from './lib/viewMode';
  import { activeCity, cityTitle } from './lib/city';

  const TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN as string;
  const city = activeCity();
  const title = cityTitle(city);
  const pool = city.pool;

  // Resolve challenge code (falling back to a fresh seed) and the field of
  // everyone who has already played this link. `code` is resolved once,
  // synchronously, before first render — a plain `const` (rather than
  // `$state`) so it never needs to trigger a reactive update; the reactive
  // pieces of this setup (`field`) are declared with `$state` explicitly.
  const parsed = parseGameParams(window.location.search, city.rounds);
  let field: Player[] = $state(parsed.field);
  let deal = parsed.code ? dealGame(pool, parsed.code, city.rounds, city.backups) : null;
  const code: ChallengeCode = deal ? parsed.code! : { seed: randomSeed(), poolVersion: pool.version };
  if (!deal) {
    field = []; // stale/malformed link: play a plain new game instead
    deal = dealGame(pool, code, city.rounds, city.backups);
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

  // View-mode toggle (full panorama / full map / today's split), persisted
  // across rounds and reloads. `loadViewMode` already falls back to 'split'
  // for anything invalid or absent.
  let viewMode: ViewMode = $state(loadViewMode());
  $effect(() => {
    saveViewMode(viewMode);
  });

  const paneFlexValues = $derived(paneFlex(viewMode, game?.phase === 'scored'));

  // GuessMap and PanoViewer stay mounted in every mode (unmounting would
  // reset Leaflet's state and tear down/rebuild the WebGL context on every
  // toggle) — only their flex size changes. Leaflet caches its container
  // size and the pano canvas can render one stale-sized frame right after a
  // pane goes from 0 to visible, so both expose an imperative `resize()`
  // called here right away and again once the `.pane-flex` transition (see
  // app.css) settles.
  let panoViewerRef: ReturnType<typeof PanoViewer> | undefined = $state();
  let guessMapRef: ReturnType<typeof GuessMap> | undefined = $state();
  $effect(() => {
    void viewMode;
    void game?.phase;
    panoViewerRef?.resize();
    guessMapRef?.resize();
    const settle = setTimeout(() => {
      panoViewerRef?.resize();
      guessMapRef?.resize();
    }, 400);
    return () => clearTimeout(settle);
  });

  // Per-round timer (Delhi only — city.timerSec is null for Goa). Each playing
  // round gets a fresh countdown; when it hits zero the round is force-scored
  // (a 0-point miss if no pin was dropped) and reveal plays, exactly as if the
  // player had submitted. Re-runs whenever the round or phase changes, so a
  // manual submit tears the interval down and the next round restarts it.
  let secondsLeft = $state(city.timerSec ?? 0);
  $effect(() => {
    if (!game || city.timerSec == null) return;
    void game.roundIndex;
    if (game.phase !== 'playing') return;
    secondsLeft = city.timerSec;
    const iv = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        clearInterval(iv);
        game.forceSubmit();
        const r = game.results[game.results.length - 1];
        if (r) playReveal(r.distanceM);
      }
    }, 1000);
    return () => clearInterval(iv);
  });
</script>

{#if !game}
  <main class="w-full h-dvh flex items-center justify-center text-[var(--ink)] p-8 text-center">
    <div class="flex flex-col items-center">
      <PixelPin size={88} />
      <h1 class="text-2xl font-bold text-[var(--azulejo)] mb-2 mt-3" style="font-family: var(--font-display)">{title}</h1>
      <p>Not enough locations curated yet. Run <code class="bg-[var(--azulejo-pale)] text-[var(--azulejo)] px-1 rounded-[4px]">npm run curate</code> with at least {city.rounds + city.backups} spots.</p>
    </div>
  </main>
{:else if game.phase === 'error'}
  <main class="w-full h-dvh flex items-center justify-center text-[var(--ink)] p-8 text-center">
    <div class="flex flex-col items-center">
      <PixelPin size={88} />
      <h1 class="text-2xl font-bold text-[var(--azulejo)] mb-2 mt-3" style="font-family: var(--font-display)">Can't reach street view</h1>
      <p class="mb-4">Check your connection and try again.</p>
      <button onclick={() => location.reload()} class="btn-primary px-6 py-2 font-bold">Retry</button>
    </div>
  </main>
{:else if game.phase === 'summary'}
  <Summary results={game.results} totalScore={game.totalScore} {code} {field} />
{:else}
  <main class="w-full h-dvh flex flex-col bg-[var(--porcelain)] text-[var(--ink)] overflow-hidden">
    <div class="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
      <section
        class="w-full min-w-0 min-h-0 relative overflow-hidden pane-flex {viewMode === 'split' ? 'border-b md:border-b-0 md:border-r border-[var(--rule)]' : ''}"
        style="flex: {paneFlexValues.pano}">
        <PanoViewer
          bind:this={panoViewerRef}
          imageId={game.currentLocation.imageId}
          token={TOKEN}
          onloaderror={() => game.substituteCurrent()}
        />
        <Hud {title} rounds={city.rounds} round={game.roundIndex} totalScore={game.totalScore} {field} />
      </section>
      <section
        class="w-full min-w-0 min-h-0 relative overflow-hidden pane-flex"
        style="flex: {paneFlexValues.map}">
        <GuessMap
          bind:this={guessMapRef}
          interactive={game.phase === 'playing'}
          roundIndex={game.roundIndex}
          result={game.phase === 'scored' ? lastResult : null}
          onpin={(lat, lng) => { game.pin(lat, lng); playPin(); }}
        />
      </section>
      <div class="absolute bottom-3 right-3 z-[1000]">
        <ViewToggle mode={viewMode} onchange={(m) => (viewMode = m)} />
      </div>
    </div>
    <GameFooter
      phase={game.phase}
      result={lastResult}
      canSubmit={game.guess !== null}
      isLastRound={game.roundIndex === city.rounds - 1}
      cityName={city.name}
      timerSeconds={city.timerSec != null ? secondsLeft : null}
      {field}
      roundIndex={game.roundIndex}
      onsubmit={() => {
        game.submit();
        const r = game.results[game.results.length - 1];
        if (r) playReveal(r.distanceM);
      }}
      onnext={() => {
        game.next();
        // Coming out of full-screen map into a new round: surface the fresh
        // panorama, otherwise the player is left staring at the map with no
        // sign a new location has loaded.
        if (viewMode === 'map') viewMode = 'pano';
      }}
    />
  </main>
{/if}
