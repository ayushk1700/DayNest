# Stage 9 verification

Current evidence is recorded in [20 October stabilization](stabilization-2026-10-20.md), [package/skin verification](fix-verification-2026-10-20.md) and [P2/P3 follow-up](p2-p3-verification-2026-10-20.md). The chronological sections below retain their original test counts and historical results; use the dated follow-up for current menu, customization and installation status. These reports do not certify public release readiness.

Initial audit: 18 October 2026. Latest follow-up: 19 October 2026. This is a local-development verification report, not an Edge Add-ons submission. Stage 10 packaging/handoff remains separate. The latest media/live-weather/background section below supersedes the earlier weather setup-only behavior.

## Automated checks

- [x] Strict TypeScript, production Vite build, manifest and bundled-file verification.
- [x] 63 integrity/behavior tests: validation/migration, cross-tab conflicts, layout, local dates/ordinals and rollover, date persistence/history/backups, weather units/provider parsing/cache/cancellation/errors, video upload boundaries and media references, background history/validation, timers, duplicate delivery/denial, six themes, history conflicts, portable backup format, stale replacement and storage-write failure preservation.
- [x] Required permissions are storage/alarms and the two exact Open-Meteo API hosts; notifications remain optional. No geolocation permission or runtime remote executable code. Connect-src is restricted to those two weather origins.
- [x] Build checks resolve local CSS/font assets and include the Flaticon license.

## Browser automation

Headless Microsoft Edge, isolated profiles/data, primary viewport **1920 × 925**, narrow viewport **390 × 844**. These are actual browser interactions driven by Playwright, not a human screen-reader audit.

- [x] `check-ui.mjs`: Settings/picker, focus containment/return, Escape, outside dismissal, narrow overflow and console errors.
- [x] `check-content.mjs`: keyboard Todo CRUD, long/empty/plain text, rename, autosave/reload, concurrent drafts/conflicts, explicit resolution, orphaned drafts and corrupt-data recovery.
- [x] `check-workspace.mjs`: real pointer drag/resize at 50/100/150%, no initial jump, one commit per gesture, numeric/header keys, content unaffected, narrow layout retention, arrangement/recovery, reminder CRUD and timer pause/resume/reopen/finish/reset/settings.
- [x] `check-local-widgets.mjs`: picker instances, clock format, local date rollover offline, calendar CRUD/month/year/keyboard, image bytes/caption/fit/removal/reload, invalid upload preservation and safe cleanup.
- [x] `check-extension.mjs`: actual unpacked MV3 extension, native New Tab override, service worker/alarm with dashboard closed, browser restart reconciliation, one completion per work session, no break increment, offline IndexedDB image/local-widget restart. Optional notification permission remained ungranted.
- [x] `check-settings-history.mjs`: grouped typing, repeated undo/redo/shortcuts, native text undo retained, deleted-widget restoration, all six themes, theme/zoom reload, portable image backup round-trip with fresh IDs, invalid JSON/invalid image/cancel/stale preview preservation, reset recovery including image bytes, narrow overlays/focus and no external web requests.
- [x] `check-card-menu.mjs`: three-dot hover/click/Enter/Arrow Down/Escape, outside dismissal, rename autofocus, delete Cancel focus return, menu padding cannot drag the card, timer/sticky menu bounds, touch use and reduced-motion suppression.

Theme token checks verify normal and muted text and primary labels at least 4.5:1, and accent focus against card surfaces at least 3:1. Sticky notes keep dark text. This is a targeted computed-color check, not a claim of complete WCAG certification.

## Visual inspection

Dashboard, Settings, picker, card menu, and dark/narrow captures are stored in `docs/screenshots`. The calm canvas, card sizes (Todo 356 × 486, Notes 469 × 375, Pomodoro 319 × 263), spacing, teal controls and yellow sticky were compared with the supplied references. The card menu uses small rounded outline glyphs in usable targets. Intentional changes requested by the user: only Settings remains in the top-right toolbar; profile/feedback are removed, reset/restore live inside Settings, and Layout/Rename/Delete sit behind three dots. Hover feedback is subtle, with a brief decorative paw above Add Widget; reduced-motion settings suppress animation.

Settings is taller than the original reference because it includes implemented recovery, notification and icon-credit sections. It scrolls within the viewport. The system text font and locally bundled Flaticon Uicons remain available offline. Sparkles/premium gating were removed from themes/picker.

## Remaining manual checks and limits

- [ ] Human screen-reader pass with NVDA/Windows high contrast and physical touch hardware.
- [ ] Real Windows notification popup rendering/OS suppression and physical sleep/resume. Permission absence/denial and delayed reconciliation have automated coverage; physical OS behavior has not been claimed as verified.
- [ ] Managed/enterprise Edge policy and competing New Tab extensions.
- [ ] Stage 10 ZIP/store listing/privacy handoff; nothing has been published.

Live weather requires internet access to Open-Meteo; current/forecast data is not persisted across a fresh offline reload. History is local to each tab (50 actions, cleared on reload/replacement); timer commands/delivery are excluded. Portable backups are limited to 50 MiB, images to 5 MiB each, and supported MP4/WebM clips to 25 MiB/five minutes. Imported/restored running timers pause and past reminders do not replay old alerts. The recovery slot holds one previous dashboard. See `backup-history.md` for detailed contracts.

No known critical content-loss defect remains after the recorded checks. Export important dashboards before updating or changing installation directories.


## Card customization follow-up
Global and individual card styling, per-field inheritance, pin/tape markers and schema-3 migration were added after the initial Stage 9 pass. The menu now renders outside the zoomed card and includes Customize and Pin/Unpin. New integrity checks cover strict style validation, cross-tab conflicts, pin protection, appearance history/backup and 216 background color contrast samples.

Follow-up Edge checks passed: `check-customization.mjs` (migration, global/per-card inheritance, pin protection and history, backup/reload, narrow menu and off-canvas unpin), `check-card-menu.mjs`, `check-ui.mjs`, `check-content.mjs`, and the installed-extension restart/alarm/offline-image checks in `check-extension.mjs`. Captures include `customized-pinned-dashboard.png` and `card-customization.png`. Automatic approval review previously reached a usage limit. After that limit reset, current-source reruns of `check-workspace.mjs` and `check-local-widgets.mjs` passed, covering schema-3 customization together with the newer Image/Sticky/Weather/Date code. The backup/history follow-up is recorded separately below.

## Image presentation follow-up
The Image widget was subsequently redesigned to match the supplied Polaroid reference: warm paper, local grain, large photo opening, handwritten caption/underline, soft shadow and compact hover/focus controls. Existing storage and customization contracts are preserved. Strict TypeScript/build/asset verification and the integrity suite passed. The later Edge checks passed upload/caption/reload, fit, invalid-upload preservation, removal, safe cleanup and compact hover controls. `polaroid-widget.png` was captured and inspected; its cat icon is an isolated test fixture, not a new default photo.

## Sticky paper presentation follow-up
Sticky Notes now follow the supplied curled yellow note reference: warm yellow paper, locally bundled grain, handwritten editable text, rounded edges, a shaded lower-right curl and a broad soft shadow. The paper layer is decorative, hidden from assistive technology and ignores pointer input. Text, autosave/conflict behavior, stored size/position, pinning, menu actions and per-card/global appearance data are preserved. Pink and green notes retain their saved color choice. Custom paper colors disable the grain and surface gradient to preserve readable foreground contrast; custom borders, corners and shadows still apply. Forced-colors mode removes paper decoration and adds a visible boundary.

Strict TypeScript, production build, bundled-file/manifest verification and all 52 automated tests passed after the sticky redesign; subsequent suites expanded coverage to 56 and then 63 tests. A later Edge check verified sticky text editing and saving and captured `curled-sticky-widget.png`, which was inspected. The earlier approval review usage limit no longer blocked that check.

## Weather redesign and Date widget follow-up
Added a separate Date picker entry and warm typographic banner, with bold day/ordinal, light month, automatic local midnight rollover, accessible full-date label and machine-readable local date. Weather now has warm glow, large condition/temperature type, editable city pill, saved Celsius/Fahrenheit controls and an explicit unavailable-forecast week strip. No live provider or forecast data has been added, and no readings are fabricated. Global/per-card appearance, pinning and existing saved widgets are preserved.

`check-date-weather.mjs` passed in isolated headless Edge: actual picker creation, local midnight 20th-to-21st update, date/city/units reload, unavailable temperature/forecast state, current-day week marker, header keyboard movement, pin lock, desktop/narrow layout/menu bounds, local image upload/caption controls, sticky editing, no console errors and no external web requests. Desktop Date/Weather content bounds were checked. Captured and inspected `date-weather-dashboard.png`, `date-widget-narrow.png` and `weather-widget-narrow.png`; the October 20th capture uses an isolated test clock. It does not hardcode the live widget's date. Build, manifest/bundled-file checks and all 56 tests passed.

## Completed backup/history regression
The latest `check-settings-history.mjs` rerun passed after updating two outdated harness assumptions: card action buttons now live in the floating portal, and photo cleanup must be revealed by hover or keyboard focus before interaction. No product behavior was bypassed with forced clicks. The check passed grouped typing and repeated Undo/Redo, native field undo, deleted-widget and old-image restoration, all six theme contrast checks, theme/zoom reload, portable image export/import with fresh IDs, invalid JSON/image rejection, cancel and stale-preview preservation, reset/recovery with image bytes, narrow overlay focus, bundled icon loading and no external requests. Together with the successful workspace/local-widget reruns, this closes the three earlier checks that automatic approval review had blocked. The manual OS/screen-reader/physical-hardware limits above remain unchanged.

## Media, live weather, dashboard image and tape update

Current schema is **4**. Existing schema-3 content, dates, layout, appearance and pins migrate with an empty background. Video cards and the global background use local asset IDs and share current/recovery/history reference protection. The version-1 portable envelope includes their bytes and stages fresh IDs on import. Upload limits are 5 MiB for PNG/JPEG/WebP images and 25 MiB/five minutes for supported MP4/WebM videos. Overall backups remain limited to 50 MiB. Nothing autoplays, and no media/background file is sent to the weather service.

Pin markers now use translucent torn washi tape at the upper-left, with a short press/highlight animation. Canvas scrollbars are hidden; content thumbs are small, rounded and revealed on hover/focus. Wheel, touch and keyboard scrolling remain enabled. Reduced motion suppresses decorative animation.

Open-Meteo now supplies genuine current conditions and seven daily icon/high-low forecasts. The manifest grants only the two exact weather API hosts and restricts connect-src accordingly. City/coordinate disclosure, attribution, selected-city timezone, 15-minute cache, refresh, abort/timeout, error states and last-reading preservation are implemented. Weather responses are not persisted in portable backups. See weather-provider.md.

Passed checks for this update:

- Strict TypeScript, production build, local asset/manifest/CSP verification and **63 integrity tests**.
- `check-media-weather-background.mjs`: real local video decode/play/pause/reload, invalid replacement preservation, caption saving, upper-left tape and reduced motion, background preview/save/Undo/Redo/reload, portable video/background export/import with fresh IDs, reset/recovery with playable bytes, forecast/conversion/error recovery, narrow media layout and menu. Weather responses in this test are controlled fixtures.
- `check-installed-media-weather.mjs`: an isolated unpacked Edge extension verified exact host grants and actual CSP-enabled requests for genuine current conditions and seven forecast days; its video and dashboard image then survived a real profile restart and played/loaded offline.
- `check-weather-live.mjs`: a separate real provider request returned Pune, India, current conditions and seven daily forecasts. This was a public test-city request, not user location access.
- `check-customization.mjs`: schema-2-to-4 migration, inherited/global/per-card styling, pin protection, styles/pins backup, reload and narrow menu/Settings behavior.
- `check-date-weather.mjs`: current-source Date rollover, saved weather units/city and forecast fixtures, header movement/pin lock, desktop/narrow layout and menus, image caption/upload controls and sticky editing. The harness now installs its simulated clock before page timers start, following Playwright's documented requirement. The earlier late-installation failures were test setup errors, not a change to widget date logic.
- `check-settings-history.mjs`: current-source grouped/native undo, widget/image restoration, six theme contrast checks, portable image round-trip, invalid/cancel/stale replacement preservation, reset/recovery, reload, narrow focus and local fonts.

Captured and inspected `media-weather-background-dashboard.png`, `dashboard-background-settings.png`, `video-widget-narrow.png` and `live-weather-installed.png`. The main capture uses controlled forecast values, a generated background fixture and public Chromium test footage. None becomes a default user asset. The test-only clip is downloaded into the ignored `.test-build` folder and is not bundled in the extension. A generated browser recording with no frames was correctly rejected before the known valid clip was used for playback verification.

The earlier automatic approval usage limit reset; the final Date and backup/history reruns completed on 19 October 2026. No requested implementation work remains blocked by it. Manual OS/screen-reader/physical-hardware checks and Stage 10 publication remain outside this local verification.


## Clock, paper, calendar and fullscreen follow-up

Implemented and checked on 19 October 2026. Clock has Simple/digital/analog faces; Notes has five paper skins; Calendar has the cream/cyan reference layout, monthly agenda and persisted week start. The four-corner toolbar button now toggles actual browser fullscreen; Recover widgets is in Settings. See [clock-paper-calendar.md](clock-paper-calendar.md) for behavior, strict optional schema-4 settings, exact check scope, inspected captures and remaining manual limits. Strict TypeScript, production package checks and all **69 tests** pass. `check-widget-skins.mjs`, `check-fullscreen.mjs` and the existing `check-local-widgets.mjs` passed.


## Compact Add Widget panel

The launcher is now 44 by 44 pixels. The picker uses a compact two-column grid, 15px outline icons on soft accent tiles, tighter typography, a subtle entry animation and hover feedback. All twelve choices remain available; short windows scroll the choices while keeping the heading/close control visible. Safe-area offsets and reduced-motion preferences are respected. No storage or widget behavior changed.

Strict TypeScript, production build and manifest/local-asset checks passed. `check-ui.mjs` passed overlay opening, focus containment/return, Escape, outside dismissal and narrow overflow checks. An additional isolated Edge pass verified all twelve entries, 44px sizing, bounds at 1920x925, 390x844, 320x568 and 740x360, no choice scrolling at normal heights, keyboard wrap/return, reduced motion and actual Notes creation. Final-state desktop/narrow/small captures were inspected after the entry animation finished; see `screenshots/compact-picker-narrow.png` and `screenshots/compact-picker-desktop.png`.


## Twelve recommended full themes

Implemented the reference palettes and order in Settings: Warm Earth, Midnight, Ocean Breeze, Forest Green, Soft Sunset, Lavender, Paper & Ink, Sakura, Matcha, Nordic Snow, Vintage Sepia and Peach Cream. Wide swatches, selected badges and applied dashboard tokens work on desktop/narrow layouts. Legacy Dark Mode/Sunset data remains valid and selects Midnight/Soft Sunset in the UI without rewriting existing content. See themes.md.

Strict TypeScript, production build/package checks and **70 tests** passed. The current `check-settings-history.mjs` completed all twelve contrast checks (text, secondary text, primary labels and focus), saved theme/zoom reload, history, portable media backup, invalid/cancel/stale imports, reset/recovery, narrow focus and local fonts with no external requests or page errors. Vintage Sepia secondary text was darkened after its first contrast check reported 4.42:1. A focused Edge pass also checked exact names/order and old-name selected markers, with inspected light, Midnight and narrow theme captures.
