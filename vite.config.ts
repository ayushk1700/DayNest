import { cpSync, createReadStream, mkdirSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pdfPackage = resolve('node_modules/pdfjs-dist');
const pdfAssetFolders = ['cmaps', 'standard_fonts'];

const pdfRuntimeAssets: Plugin = {
  name: 'daynest-pdf-runtime-assets',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.method !== 'GET' || !request.url?.startsWith('/pdfjs/')) return next();
      try {
        const parts = decodeURIComponent(request.url.slice('/pdfjs/'.length).split('?')[0] ?? '')
          .split('/')
          .filter(Boolean);
        if (
          !pdfAssetFolders.includes(parts[0] ?? '') ||
          parts.some((part) => part === '.' || part === '..')
        )
          return next();
        const path = resolve(pdfPackage, ...parts);
        const inside = relative(pdfPackage, path);
        if (
          inside === '..' ||
          inside.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
          isAbsolute(inside)
        )
          return next();
        const stream = createReadStream(path);
        stream.on('error', next);
        response.setHeader('Content-Type', 'application/octet-stream');
        stream.pipe(response);
      } catch (error) {
        next(error);
      }
    });
  },
  closeBundle() {
    const target = resolve('dist/pdfjs');
    mkdirSync(target, { recursive: true });
    for (const folder of pdfAssetFolders)
      cpSync(resolve(pdfPackage, folder), resolve(target, folder), { recursive: true });
  },
};

export default defineConfig({
  base: './',
  plugins: [pdfRuntimeAssets],
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        dashboard: 'index.html',
        pdfStudio: 'pdf.html',
        immersive: 'immersive.html',
        equalizer: 'equalizer.html',
        offscreen: 'equalizer-offscreen.html',
        background: 'src/extension/background.ts',
        musicContent: 'src/extension/music-content.ts',
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background'
            ? 'background.js'
            : chunk.name === 'musicContent'
              ? 'music-content.js'
              : 'assets/[name]-[hash].js',
      },
    },
  },
});
