/// <reference types="vitest/config" />
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
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
