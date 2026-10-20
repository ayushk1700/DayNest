import { defineConfig } from 'vite';
export default defineConfig({
 base:'./',
 build:{outDir:'dist',target:'es2022',sourcemap:false,rollupOptions:{input:{dashboard:'index.html',background:'src/extension/background.ts'},output:{entryFileNames:chunk=>chunk.name==='background'?'background.js':'assets/[name]-[hash].js'}}},
});
