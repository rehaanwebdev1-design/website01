import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

const pages = [
  'index.html',
  'about.html',
  'authentication.html',
  'collections.html',
  'contact.html',
  'layaway.html',
  'sell-to-us.html',
  'shop.html',
  'vip-extended-layaway.html',
  'watch-preview.html',
];

export default defineConfig({
  plugins: [{
    name: 'copy-runtime-model-assets',
    apply: 'build',
    writeBundle(outputOptions) {
      // Three.js requests the GLB by URL at runtime, so Vite cannot discover it
      // as an imported asset. Keep the existing /assets path in dev and prod.
      const outputAssets = resolve(rootDir, outputOptions.dir, 'assets');
      mkdirSync(outputAssets, { recursive: true });
      copyFileSync(resolve(rootDir, 'assets/josta.glb'), resolve(outputAssets, 'josta.glb'));
    },
  }],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page.replace('.html', ''), resolve(rootDir, page)]),
      ),
    },
  },
});
