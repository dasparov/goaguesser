/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !env.VITE_MAPILLARY_TOKEN) {
    throw new Error(
      'VITE_MAPILLARY_TOKEN is not set. Copy .env.example to .env and add your Mapillary client token.'
    );
  }
  return {
    base: './',
    plugins: [svelte(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
          // The curator page (docs/superpowers/specs/visual-identity.md Part A): a
          // second entry point, ships alongside the game so family members can help
          // curate spots too — read-only Graph API access, harmless with a public token.
          curate: resolve(process.cwd(), 'curate.html'),
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
