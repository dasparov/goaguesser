<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createPano360, type Pano360 } from '../lib/pano360';

  let { imageId, token, onloaderror }: {
    imageId: string;
    token: string;
    onloaderror: (imageId: string) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let pano: Pano360 | undefined;
  let loading = $state(true);

  onMount(() => {
    pano = createPano360(canvas);
  });

  onDestroy(() => pano?.destroy());

  // Imperative resize hook for the view-mode toggle (App.svelte) — called via
  // bind:this right after a pane's flex value changes, and again once the
  // CSS transition settles, so the canvas doesn't render a frame at its
  // pre-toggle size (a ResizeObserver already covers the general case, but
  // this forces an immediate read instead of waiting for its next callback).
  export function resize() {
    pano?.resize();
  }

  function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('aborted'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const onAbort = () => reject(new Error('aborted'));
      signal.addEventListener('abort', onAbort);
      img.onload = () => {
        signal.removeEventListener('abort', onAbort);
        resolve(img);
      };
      img.onerror = () => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error('image load failed'));
      };
      img.src = src;
    });
  }

  $effect(() => {
    const id = imageId;
    const tok = token;
    loading = true;
    const controller = new AbortController();

    (async () => {
      try {
        const url = `https://graph.mapillary.com/images?image_ids=${id}&fields=id,is_pano,thumb_2048_url,thumb_original_url&access_token=${tok}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Mapillary ${res.status}`);
        const body = await res.json();
        const record = body?.data?.[0];
        if (!record || record.is_pano !== true || !record.thumb_2048_url) {
          throw new Error('not a panorama or missing thumbnail');
        }

        const img2048 = await loadImage(record.thumb_2048_url, controller.signal);
        if (controller.signal.aborted) return;
        pano?.setTexture(img2048);
        loading = false;

        if (record.thumb_original_url) {
          // Sharper full-res swap-in — best effort, quietly abandoned if the
          // round changed or the fetch/decode fails.
          loadImage(record.thumb_original_url, controller.signal)
            .then((imgOrig) => {
              if (controller.signal.aborted) return;
              pano?.setTexture(imgOrig);
            })
            .catch(() => {});
        }
      } catch {
        if (controller.signal.aborted) return;
        onloaderror(id);
      }
    })();

    return () => controller.abort();
  });
</script>

<div class="relative w-full h-full">
  <canvas bind:this={canvas} class="block w-full h-full"></canvas>
  {#if loading}
    <div
      class="absolute inset-0 flex items-center justify-center"
      style="background: var(--porcelain)"
    >
      <p class="text-sm" style="color: var(--ink-faint)">loading panorama…</p>
    </div>
  {/if}
</div>
