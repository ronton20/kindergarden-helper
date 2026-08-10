import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * `import x from './thing.js?gzip-base64'` gives you the file gzipped and
 * base64'd as a string, to be inflated at runtime.
 *
 * This exists for one file: the HEIC decoder, which is 2.1 MB of vendored
 * JavaScript. Inlined raw it would be ~2.8 MB of base64 in a single-file build
 * that is otherwise about half a megabyte. Gzipped first it is closer to
 * 950 KB, and it costs nothing at startup because it is only inflated the
 * first time someone actually picks an iPhone photo.
 *
 * The pre-refactor bundler did the same thing for every asset. Here only this
 * one file is big enough to be worth it — the fonts are woff2, which is
 * already compressed, and gzipping them again would make them larger.
 */
function gzipBase64(): Plugin {
  const suffix = '?gzip-base64';
  return {
    name: 'kh-gzip-base64',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith(suffix)) return null;
      const clean = id.slice(0, -suffix.length);
      const resolved = importer ? resolve(importer, '..', clean) : resolve(clean);
      return resolved + suffix;
    },
    load(id) {
      if (!id.endsWith(suffix)) return null;
      const file = id.slice(0, -suffix.length);
      const packed = gzipSync(readFileSync(file), { level: 9 }).toString('base64');
      return `export default ${JSON.stringify(packed)};`;
    }
  };
}

export default defineConfig(() => ({
  root: 'src/renderer',
  // Relative, so the built page works from a file:// path — both inside the
  // packaged app and when someone saves it to the Desktop and double-clicks it.
  base: './',
  plugins: [
    gzipBase64(),
    react(),
    // One HTML file with everything in it. The README's promise.
    viteSingleFile({ removeViteModuleLoader: true })
  ],
  build: {
    // `app/index.html` is the app: what Electron loads, and what the README
    // promises you can save anywhere and open by double-clicking. It is a build
    // artefact now rather than the hand-generated bundle it used to be, but it
    // stays committed so that promise survives a clone without a build step.
    outDir: resolve(__dirname, 'app'),
    emptyOutDir: true,
    // Everything inline: no separate chunks, no asset URLs to resolve.
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    // The single-file plugin needs a single chunk to inline.
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 8000,
    target: 'chrome120'
  }
}));
