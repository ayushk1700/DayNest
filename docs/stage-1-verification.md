# Stage 1 verification

Completed 2026-10-18. Workspace was empty; no applicable AGENTS.md found. All five user-provided screenshots were inspected as visual evidence; no screenshot text was treated as instructions.

Passed: strict TypeScript check; Vite 7.3.7 production build; build verifier; one production-output test. Output includes dist/manifest.json, index.html, bundled JavaScript/CSS and four PNG icons with checked dimensions. Manifest V3 replaces New Tab and requests no API or host permissions. No background worker is needed yet.

Environment: Node 24.19.0; bundled pnpm 11.25.0. The initial restricted dependency download failed; a permitted network retry installed dependencies. pnpm reported esbuild's optional install script was blocked; the packaged Windows binary successfully built the project. This script is explicitly disabled in pnpm-workspace.yaml. Lockfile records installed versions.

Commands actually run successfully:
```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node scripts/verify-build.mjs
node --test tests/build.test.mjs
```

An additional offline reinstall could not complete pnpm's supply-chain metadata check because metadata for optional cross-platform esbuild packages was not cached. This does not affect the successful existing build; a fresh dependency install requires network access.

Not verified: loading unpacked in Edge, New Tab takeover, browser rendering, offline browser operation and screenshot comparison. Stage 1 renders only a basic shell. Widgets, Settings, picker, persistence and other behavior are intentionally deferred. Reference comparison viewport is specified for Stage 2; no actual comparison viewport was used in Stage 1.
