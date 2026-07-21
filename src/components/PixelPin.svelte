<script lang="ts">
  // 1-bit location-pin mascot: a blocky pixel pin with a little face that idly
  // bobs — a nod to the game's core action (dropping a pin). Charcoal on
  // transparent; the eyes are cut with the sage ground colour. Motion respects
  // prefers-reduced-motion (falls back to a still pin).
  let { size = 96 }: { size?: number } = $props();

  // Pin silhouette, one entry per pixel row: [y, x0, x1] on a 24-wide grid.
  const rows: Array<[number, number, number]> = [
    [3, 9, 15], [4, 8, 16], [5, 7, 17], [6, 6, 18], [7, 6, 18],
    [8, 6, 18], [9, 6, 18], [10, 7, 17], [11, 8, 16], [12, 9, 15],
    [13, 10, 14], [14, 11, 13], [15, 11, 13], [16, 12, 12],
  ];
</script>

<div class="pixel-mascot" style="width:{size}px" aria-hidden="true">
  <svg viewBox="0 0 24 30" width={size} height={(size * 30) / 24} shape-rendering="crispEdges">
    <g class="pm-shadow">
      <rect x="9" y="27" width="6" height="1" fill="#2B2820" opacity="0.26" />
      <rect x="10" y="28" width="4" height="1" fill="#2B2820" opacity="0.26" />
    </g>
    <g class="pm-body">
      {#each rows as [y, x0, x1]}
        <rect x={x0} y={y} width={x1 - x0 + 1} height="1" fill="#2B2820" />
      {/each}
      <rect x="9" y="7" width="2" height="2" fill="#A9B0A1" class="pm-eye" />
      <rect x="14" y="7" width="2" height="2" fill="#A9B0A1" class="pm-eye" />
    </g>
  </svg>
</div>

<style>
  .pixel-mascot { display: inline-block; line-height: 0; }

  @media (prefers-reduced-motion: no-preference) {
    .pm-body {
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation: pm-bob 1.8s ease-in-out infinite;
    }
    .pm-shadow {
      transform-box: fill-box;
      transform-origin: 50% 50%;
      animation: pm-shadow 1.8s ease-in-out infinite;
    }
    .pm-eye {
      transform-box: fill-box;
      transform-origin: 50% 50%;
      animation: pm-blink 4.2s steps(1, end) infinite;
    }
    @keyframes pm-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2.4px); }
    }
    @keyframes pm-shadow {
      0%, 100% { transform: scaleX(1); opacity: 1; }
      50% { transform: scaleX(0.68); opacity: 0.72; }
    }
    @keyframes pm-blink {
      0%, 90%, 100% { transform: scaleY(1); }
      94% { transform: scaleY(0.15); }
    }
  }
</style>
