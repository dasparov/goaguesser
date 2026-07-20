<script lang="ts">
  import { onMount } from 'svelte';
  import type { BasketSpot } from './types';
  import {
    DEFAULT_REPO,
    loadGhToken,
    saveGhToken,
    forgetGhToken,
    verifyGhToken,
    publishSpots,
    makeInboxFilename,
    type PublishResult,
  } from './github';

  // `open` only governs the phone bottom-sheet presentation — on `md+` the
  // basket stays the always-visible side panel it always was, independent
  // of this flag (see `isDesktop` below).
  let {
    basket,
    open,
    onclose,
    onremove,
    onclearbasket,
  }: {
    basket: BasketSpot[];
    open: boolean;
    onclose: () => void;
    onremove: (imageId: string) => void;
    onclearbasket: () => void;
  } = $props();

  // Tracks the `md` breakpoint in JS (not just CSS) so the sheet can be made
  // properly `inert` — unfocusable and hidden from assistive tech — while
  // translated off-screen on phones, without ever making the always-visible
  // desktop panel inert.
  let isDesktop = $state(false);
  onMount(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => (isDesktop = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
  const sheetVisible = $derived(isDesktop || open);

  let justExported = $state(false);
  let copied = $state(false);

  function exportJson() {
    const payload = basket.map((b) => ({ imageId: b.imageId, name: b.name || undefined }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goaguesser-spots.json';
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

  // --- Publish to game ---------------------------------------------------

  let hasToken = $state(loadGhToken() !== null);
  let showSetup = $state(false);
  let tokenInput = $state('');
  let verifying = $state(false);
  let setupError = $state<string | null>(null);

  let publishing = $state(false);
  let publishError = $state<Extract<PublishResult, { ok: false }> | null>(null);
  let successCount = $state<number | null>(null);

  const actionsUrl = `https://github.com/${DEFAULT_REPO}/actions`;

  function openSetup() {
    tokenInput = '';
    setupError = null;
    showSetup = true;
  }

  function closeSetup() {
    showSetup = false;
    tokenInput = '';
    setupError = null;
  }

  async function saveToken() {
    const token = tokenInput.trim();
    if (!token) return;
    verifying = true;
    setupError = null;
    const result = await verifyGhToken(DEFAULT_REPO, token);
    verifying = false;
    if (!result.ok) {
      setupError =
        result.reason === 'bad-token'
          ? "That token didn't work — check it was pasted in full."
          : result.reason === 'forbidden'
            ? `This token can't access ${DEFAULT_REPO}. Check the repository access setting.`
            : result.reason === 'network'
              ? "Couldn't reach GitHub. Check your connection and try again."
              : (result.detail ?? 'Something went wrong verifying the token.');
      return;
    }
    saveGhToken(token);
    hasToken = true;
    showSetup = false;
    tokenInput = '';
    // The tap that got us here was a publish attempt — carry it through now
    // that we have a working token, so this still reads as one tap.
    await doPublish(token);
  }

  function forgetToken() {
    forgetGhToken();
    hasToken = false;
    publishError = null;
  }

  function retryWithNewToken() {
    forgetToken();
    openSetup();
  }

  async function doPublish(token: string) {
    publishing = true;
    publishError = null;
    const count = basket.length;
    const filename = makeInboxFilename();
    const result = await publishSpots(
      basket.map((b) => ({ imageId: b.imageId, name: b.name })),
      { repo: DEFAULT_REPO, token, filename }
    );
    publishing = false;
    if (result.ok) {
      onclearbasket();
      successCount = count;
    } else {
      publishError = result;
    }
  }

  function publishClick() {
    if (publishing || basket.length === 0) return;
    successCount = null;
    const token = loadGhToken();
    if (!token) {
      openSetup();
      return;
    }
    void doPublish(token);
  }

  function dismissSuccess() {
    successCount = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (showSetup) {
      closeSetup();
      return;
    }
    // Only the phone sheet is closeable — on desktop `open` never gates
    // visibility, so this is a no-op there.
    if (open) onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !isDesktop && open}
  <button
    class="md:hidden fixed inset-0 z-[950] motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none"
    style="background: color-mix(in srgb, var(--porcelain) 65%, transparent)"
    onclick={onclose}
    aria-label="Close basket"
  ></button>
{/if}

<aside
  inert={!sheetVisible}
  aria-label="Basket"
  class="fixed inset-x-0 bottom-0 z-[1000] max-h-[65vh] rounded-t-[10px] border-t flex flex-col gap-3 p-3
         motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none
         {open ? 'translate-y-0' : 'translate-y-full pointer-events-none'}
         md:pointer-events-auto md:translate-y-0 md:absolute md:inset-x-auto md:top-4 md:right-4 md:bottom-4
         md:w-64 md:max-w-[80vw] md:max-h-none md:rounded-[10px] md:border md:border-t-0"
  style="background: var(--panel); border-color: var(--rule); padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))"
>
  <div class="flex items-center justify-between shrink-0">
    <h2 class="font-display text-base" style="color: var(--ink)">Basket</h2>
    <div class="flex items-center gap-2">
      <span class="font-mono text-sm" style="color: var(--ink-faint)">{basket.length}</span>
      <button
        class="md:hidden w-9 h-9 flex items-center justify-center border rounded-[4px]"
        style="border-color: var(--rule)"
        onclick={onclose}
        aria-label="Close basket"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
          <line x1="4" y1="4" x2="20" y2="20" />
          <line x1="20" y1="4" x2="4" y2="20" />
        </svg>
      </button>
    </div>
  </div>

  <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">

  {#if basket.length === 0}
    <p class="text-xs" style="color: var(--ink-faint)">Tap a dot on the map and Keep it.</p>
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
    <button
      class="btn-primary px-3 py-2 text-sm font-bold"
      disabled={basket.length === 0 || publishing}
      onclick={publishClick}
    >
      {publishing ? 'Publishing…' : 'Publish to game'}
    </button>

    {#if publishError}
      <div class="card-flat p-2 flex flex-col gap-2" style="background: var(--porcelain)">
        <p class="text-xs" style="color: var(--laterite)">
          {#if publishError.reason === 'bad-token'}
            That token didn't work. It may have expired — add a new one.
          {:else if publishError.reason === 'forbidden'}
            This token can't write to {DEFAULT_REPO}. Check it has Contents: Read and write.
          {:else if publishError.reason === 'conflict'}
            GitHub rejected the request{publishError.detail ? `: ${publishError.detail}` : '.'}
          {:else if publishError.reason === 'network'}
            Couldn't reach GitHub. Check your connection and try again.
          {:else}
            {publishError.detail ?? 'Something went wrong publishing.'}
          {/if}
        </p>
        {#if publishError.reason === 'bad-token'}
          <button class="btn-secondary px-3 py-1.5 text-xs" onclick={retryWithNewToken}>Add a new token</button>
        {/if}
      </div>
    {/if}

    {#if successCount !== null}
      <div class="card-flat p-2 flex flex-col gap-1.5" style="background: var(--porcelain)">
        <p class="text-xs" style="color: var(--emerald-solid)">
          {successCount} spot{successCount === 1 ? '' : 's'} sent. They'll be validated and live in about 3 minutes.
        </p>
        <a
          class="text-xs underline"
          style="color: var(--azulejo)"
          href={actionsUrl}
          target="_blank"
          rel="noopener"
        >
          Watch progress on GitHub Actions
        </a>
        <button class="btn-secondary px-3 py-1.5 text-xs self-start" onclick={dismissSuccess}>Dismiss</button>
      </div>
    {/if}

    {#if hasToken && !showSetup}
      <button class="text-[11px] underline self-start" style="color: var(--ink-faint)" onclick={forgetToken}>
        Forget GitHub token
      </button>
    {/if}

    <button class="btn-primary px-3 py-2 text-sm font-bold" disabled={basket.length === 0} onclick={exportJson}>
      Export {basket.length} spots
    </button>
    <button class="btn-secondary px-3 py-2 text-sm" disabled={basket.length === 0} onclick={copyForSpotsTxt}>
      {copied ? 'Copied' : 'Copy for spots.txt'}
    </button>
    {#if justExported}
      <p class="font-mono text-[10px] leading-tight break-all" style="color: var(--ink-faint)">
        npm run curate -- --import ~/Downloads/goaguesser-spots.json
      </p>
    {/if}
  </div>
  </div>
</aside>

{#if showSetup}
  <div
    class="fixed inset-0 z-[1100] flex items-center justify-center p-4"
    style="background: color-mix(in srgb, var(--porcelain) 70%, transparent)"
  >
    <div
      class="card-flat p-4 flex flex-col gap-3 w-full max-w-sm"
      style="background: var(--panel)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gh-setup-title"
    >
      <h2 id="gh-setup-title" class="font-display text-base" style="color: var(--ink)">Publish to game</h2>
      <p class="text-xs" style="color: var(--ink-soft)">
        Publishing sends your kept spots straight to the game. It needs a GitHub token with permission to add
        files to this one repo — stored only on this device.
      </p>
      <a
        class="text-xs underline"
        style="color: var(--azulejo)"
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noopener"
      >
        Create a fine-grained token
      </a>
      <ol class="text-xs list-decimal list-inside flex flex-col gap-1" style="color: var(--ink-soft)">
        <li>Repository access → Only select repositories → {DEFAULT_REPO}</li>
        <li>Permissions → Repository permissions → Contents → Read and write</li>
      </ol>
      <input
        class="px-3 py-2 text-sm rounded-[4px] border"
        style="background: var(--porcelain); border-color: var(--rule); color: var(--ink)"
        type="password"
        placeholder="Paste your token"
        autocomplete="off"
        bind:value={tokenInput}
      />
      {#if setupError}
        <p class="text-xs" style="color: var(--laterite)">{setupError}</p>
      {/if}
      <div class="flex gap-2">
        <button
          class="btn-primary px-3 py-2 text-sm font-bold flex-1"
          disabled={!tokenInput.trim() || verifying}
          onclick={saveToken}
        >
          {verifying ? 'Checking…' : 'Save'}
        </button>
        <button class="btn-secondary px-3 py-2 text-sm flex-1" onclick={closeSetup}>Cancel</button>
      </div>
      {#if hasToken}
        <button class="text-[11px] underline self-start" style="color: var(--ink-faint)" onclick={forgetToken}>
          Forget GitHub token
        </button>
      {/if}
    </div>
  </div>
{/if}
