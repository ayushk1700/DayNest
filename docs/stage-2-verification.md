# Stage 2 verification

Completed 2026-10-18. Implemented the static dashboard, toolbar, local SVG cat avatar, corner controls, Settings dialog and widget picker. Shared outline icons and overlay focus handling live in src/ui; sample widgets live in src/widgets. Existing visual tokens remain shared. Widget actions, theme changes, zoom and backup controls are disabled with visible preview explanations, pending their planned stages. No new permissions or network services were introduced.

## Automated checks
- Strict TypeScript check passed.
- Vite production build passed (33 modules).
- Production manifest, local asset and icon verification passed.
- Production-output test passed (1 test).
- Headless Microsoft Edge: opening Settings and picker, initial Settings focus, forward Tab containment, Escape dismissal and focus return passed.
- Narrow layout horizontal overflow, Settings bounds and outside picker dismissal passed.
- No page errors observed during this run.

Actual viewports: 1920 × 925 CSS pixels (desktop), 390 × 844 (narrow). Screenshots were captured from the production build via a local file URL, not from an installed extension. Headless Edge required execution outside the sandbox; the bundled Playwright browser was unavailable. No personal browser profile was used.

## Visual inspection
Inspected dashboard.png, settings.png and widget-picker.png against the supplied references. Card dimensions, primary positions, pale-blue canvas, white surfaces, teal timer/add button, yellow overlapping sticky, theme swatches and overlay placement follow the references. Fixed clipped narrow Settings after inspecting the first capture, then recaptured and inspected narrow-settings.png and narrow-picker.png. Settings now fits the narrow viewport; picker scrolls when needed. Full desktop captures were regenerated after the correction.

Intentional differences: original local cat illustration replaces the photo avatar; visible preview notes and close controls clarify unfinished actions; theme sparkles are decorative only. Font identity is unconfirmed; local Arial/Helvetica/system sans-serif is used. Native draggable/resizable behavior is deferred, so no active drag grips or resize affordances are shown. Alternate image/reminder layout is documented, not implemented in Stage 2.

## Limits
No installed-extension/New Tab takeover test, screen-reader audit or full accessibility/contrast audit was performed. Backward Tab is implemented but not separately automated. Zoom slider displays the reference 75% as a disabled sample; no zoom transformation is applied yet. Widgets and content remain static and do not persist. Full behavior belongs to later stages.

## Run
Use pnpm build and pnpm test; load dist through edge://extensions as described in README.md. Browser check: node scripts/check-ui.mjs with Playwright installed or PLAYWRIGHT_PACKAGE set. EDGE_EXECUTABLE optionally overrides the Edge path.
