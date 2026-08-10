import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `import x from './thing?base64'` gives you the file's bytes as a base64
 * string, inlined into the bundle.
 *
 * This exists for one file: the HEIC decoder, 2.1 MB of vendored JavaScript,
 * which is committed already gzipped (`libheif.js.gz`) and inflated at runtime
 * the first time someone actually picks an iPhone photo. Inlining it raw would
 * add ~2.8 MB of base64 to a single-file build that is otherwise about half a
 * megabyte; compressed it is closer to 700 KB.
 *
 * It is compressed *once, in the repository*, rather than at build time, and
 * that is deliberate. zlib's output differs between versions and platforms, so
 * gzipping during the build made `app/index.html` come out 916 bytes larger on
 * a Windows runner than on a Mac — for byte-identical input. Since the file is
 * committed and CI checks it has not drifted from the sources, the build has to
 * be reproducible anywhere, which means no compression in it.
 *
 * The fonts are not compressed at all: woff2 already is, and gzipping it again
 * makes it larger.
 */
function base64Asset(): Plugin {
  const suffix = '?base64';
  return {
    name: 'kh-base64-asset',
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
      return `export default ${JSON.stringify(readFileSync(file).toString('base64'))};`;
    }
  };
}

export default defineConfig(() => ({
  root: 'src/renderer',
  // Relative, so the built page works from a file:// path — both inside the
  // packaged app and when someone saves it to the Desktop and double-clicks it.
  base: './',
  plugins: [
    base64Asset(),
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
