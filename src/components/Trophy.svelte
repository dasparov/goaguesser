<script lang="ts">
  // Flat geometric trophy glyph — docs/superpowers/specs/visual-identity.md,
  // "Iconography — no emoji in the UI". Solid `currentColor` fill, no
  // outline/gradient: rectangular bowl, two small side handles, stem, wide
  // base. Drawn once, reused wherever 🏆 used to appear.
  let { size = 20 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <!-- bowl -->
  <rect x="7" y="4" width="10" height="8" rx="1.5" />
  <!-- left handle -->
  <path d="M7 5.5a3 3 0 0 0 0 6h.5v-1.5H7a1.5 1.5 0 0 1 0-3h.5V5.5H7z" />
  <!-- right handle -->
  <path d="M17 5.5h.5a3 3 0 0 1 0 6H17v-1.5h.5a1.5 1.5 0 0 0 0-3H17V5.5z" />
  <!-- stem -->
  <rect x="11" y="12" width="2" height="4" />
  <!-- wide base -->
  <rect x="9" y="16" width="6" height="1.5" rx="0.5" />
  <rect x="7" y="17.5" width="10" height="1.5" rx="0.75" />
</svg>
