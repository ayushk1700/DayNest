# Stages 3 and 4 verification

Completed 2026-10-18.

## Stage 3: what works
Typed versioned schema, strict validation, explicit actions, migration infrastructure, extension and development adapters, absent-only sample seeding, increasing revisions, Web Locks serialization, validated cross-tab updates, field-level conflict handling, raw-data recovery and backup-before-replacement. Widget metadata includes position/size/stacking order; image content holds asset IDs only.

## Stage 4: what works
Todo add via Enter or plus, completion and counts, discoverable edit/delete controls, multiline edits and empty state, and precisely labeled confirmed **Clear all tasks**. Notes support rename, plain-text editing, autosave and scrollable long content. Yellow Sticky Notes support rename, text autosave and scrolling with readable text. Shared widget rename/delete controls appear for hover, keyboard focus and touch. Widget deletion is confirmed. Text conflicts keep local drafts; orphaned drafts remain available to download on the page.

## Automated verification
- Strict TypeScript passed.
- Vite production build passed: 44 modules, local JavaScript/CSS and avatar/icons.
- Manifest/package verification passed: New Tab entry, bundled files/icons, storage-only permission and no host permissions.
- 14 tests passed: validation, supported migration, absent-only seeding, empty dashboard persistence, corrupt data preservation, recovery backup ordering, recovery races, failed writes, concurrent independent edits, stale same-field and destructive operations, task actions, image asset references and extension adapter event routing.
- Headless Microsoft Edge content checks passed: two pages sharing one origin; keyboard task add and Space toggle; task edit/delete; counts and confirmed clear/cancel; title rename; Notes and Sticky autosave/reload; empty lists/content; long multiline content; literal markup remaining text; simultaneous same-field conflict, preserved draft, explicit replacement and convergence; narrow overflow check; simulated quota failure with preserved saved document and local draft; invalid-data backup/recovery; and preservation of a dirty draft when another tab deletes its widget.
- Forward/backward confirmation-dialog focus containment passed. The original overlay check also passed initial focus, Tab containment, Escape and focus return for Settings/picker, outside dismissal and narrow Settings bounds. No page errors were observed in these browser checks.

Browser tests ran the production build in isolated headless Edge profiles, outside the sandbox. Content tests used a temporary localhost server; the UI screenshot check used a local file URL. Extension storage API behavior was unit-tested with a mock, not with an installed extension. No personal profile or personal dashboard data was modified.

## Visual inspection
Inspected stage-4-dashboard.png, stage-4-long-content.png and stage-4-narrow.png at 1920 × 925 desktop and 390 × 844 narrow viewports. Core card layout and colors remain consistent with the reference. Sticky size increased from the static 120px sample to 150px so 12px text remains readable. Task reset now clearly says **Clear all tasks**. Notes retain the notebook margin and native scrollable text editor. Error panels and focus outlines use the shared visual treatment.

Also captured and inspected stage-4-conflict.png (desktop) and stage-3-recovery.png (390 × 844). Conflict actions remain visible below the draft; the invalid-data recovery message and buttons fit the narrow viewport. Earlier Stage 1 and Stage 2 reports describe the project at those stages; this report and README describe current behavior.

## Limits and next stage
Installed-extension storage/reload, native Edge New Tab takeover and full browser restart remain unverified. The extension adapter is covered with mock API tests; browser two-tab tests cover the development adapter. Unsaved drafts are memory-only and are not a crash-safe journal. Full restore from a backup file, undo/redo, adding widgets, optional sticky color controls, timer behavior, drag/resize/zoom and themes remain for later stages. The only permission added is storage. Full screen-reader/contrast audit remains Stage 9.

## Run
Build with pnpm build, then pnpm test. If pnpm is unavailable but dependencies are installed:

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node scripts/verify-build.mjs
node scripts/run-tests.mjs
```

Load/reload dist in edge://extensions. Open fresh dashboard tabs after updating the manifest so the storage permission is active. For development use pnpm dev. Optional browser checks: node scripts/check-content.mjs and node scripts/check-ui.mjs, with Playwright installed or PLAYWRIGHT_PACKAGE set, and optional EDGE_EXECUTABLE override.
