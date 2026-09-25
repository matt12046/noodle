import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'src',
  // Relative asset URLs, since the popup is served from chrome-extension://<id>/.
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: fileURLToPath(new URL('./src/popup.html', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
