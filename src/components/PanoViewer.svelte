<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Viewer } from 'mapillary-js';

  let { imageId, token, onloaderror }: {
    imageId: string;
    token: string;
    onloaderror: (imageId: string) => void;
  } = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | undefined;

  onMount(() => {
    viewer = new Viewer({
      container,
      accessToken: token,
      component: {
        cover: false,
        direction: false,
        sequence: false,
        keyboard: false,
        tag: false,
        popup: false,
        zoom: true,
        bearing: false,
      },
    });
  });

  $effect(() => {
    const id = imageId;
    viewer?.moveTo(id).catch(() => onloaderror(id));
  });

  onDestroy(() => viewer?.remove());
</script>

<div bind:this={container} class="w-full h-full bg-[var(--porcelain)]"></div>
