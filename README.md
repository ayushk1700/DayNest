# DayNest

A local Microsoft Edge New Tab dashboard using React, strict TypeScript, Vite and Manifest V3. Stages 1 through 9 are implemented. Verification evidence and remaining manual checks are recorded in docs/release-checklist.md.

## Run and build
Requires Node 22.12+ (or Node 24) and pnpm 10+.

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm preview
```

Build before running tests. Production output is `dist/`. If pnpm is unavailable but dependencies are installed:

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node scripts/verify-build.mjs
node scripts/run-tests.mjs
```

## Install or update in Edge
1. Build, open `edge://extensions`, and enable **Developer mode**.
2. Choose **Load unpacked**, selecting this project's **dist** directory.
3. Open a new tab and accept Edge's New Tab change confirmation if prompted. Another extension or managed policy may take precedence.
4. After rebuilding, click **Reload** on the extension card and open fresh dashboard tabs. Keep the same installation directory for updates.

Required permissions are **storage**, **alarms**, and access to the two Open-Meteo API hosts for live weather. System **notifications** are optional, enabled explicitly in Settings. Weather sends your entered city to geocoding-api.open-meteo.com and the resolved coordinates to api.open-meteo.com. No GPS/geolocation permission, secret key, account or cloud synchronization is used. Photos, videos and background images remain local. Code, fonts and icons are bundled.

## Use the workspace
- Drag widget headers or resize from the lower-right corner. Focus a header and use arrows to move, Alt + arrows to resize and Shift for fine steps. The three-dot card menu offers **Layout**, **Rename**, and **Delete**. Hover over the dots, click them, or focus them and press Enter/Arrow Down. **Layout** offers numeric controls. Geometry and stacking order persist.
- **Arrange Widgets** wraps cards into rows; **Recover widgets** in Settings restores reachable headers. The four-corner toolbar button enters fullscreen; click it again or press Escape to exit. Narrow windows use a readable flow layout while retaining desktop geometry. Settings zoom scales the canvas; toolbar, dialogs and picker stay unscaled.
- The compact 44px plus button opens a two-column picker for all twelve widget types, with small outline icons, soft hover states and independent multiple instances. Short windows scroll only the choices; the heading and close button stay visible.
- Todo: Enter/plus adds, Space toggles a focused checkbox, row controls edit/delete. **Clear all tasks** confirms removal of both completed and unfinished tasks.
- Notes and Sticky Notes: edit directly; a small three-dot menu appears on card hover or keyboard focus. Text autosaves after 350ms; conflicting drafts stay visible with explicit choices and download. Wait for **Saved on this device** before leaving.
- Sticky Notes use warm textured paper, handwritten text, rounded corners, a turned lower-right corner and a soft shadow. Existing text, dimensions, colors and pins are retained; custom background colors keep their readable foregrounds.
- Pomodoro: Start/Pause/Resume/Reset, work/break transitions and Timer settings. Reset keeps completed work history. Deadlines survive closed tabs and browser restart; daily totals use local dates.
- Reminder: create/edit/delete messages and due times. Upcoming/passed states use real timestamps with saved timezone. Enable optional alerts in Settings. Alerts can be delayed after sleep or closure; state reconciles on startup.
- Clock: choose Simple, Digital alarm clock or Rounded analog from the card's **Clock style** selector, or in Customize. The cream LCD and sage analog faces show live local device time; each card keeps its own style and 12/24-hour choice. The alarm-clock design is a clock face; use Reminder for alerts.
- Notes paper: choose Plain, Lined, Grid, Dotted or Kraft from the card's **Notes paper** selector, or in Customize. Paper changes preserve text, autosave, card colors and geometry.
- Date: a separate warm typographic banner with the current local day, ordinal ending and month. It updates at midnight and after waking, with no saved or hardcoded date.
- Habit Tracker: add/delete habits, toggle daily completion and inspect the last seven local days; older history stays stored.
- Calendar: a soft cream/cyan month view with outlined event days, a monthly agenda and stacked year badge. Previous/next month, Today, arrow-key date movement, Sunday/Monday week starts and event edit/delete controls work locally. No remote calendar connection.
- Image: Polaroid paper frame, handwritten caption and compact photo controls on hover/focus (always visible on touch). Upload local PNG/JPEG/WebP up to 5 MiB with contain/crop-to-fill display. Bytes live separately in IndexedDB. Invalid uploads retain the previous image; cleanup protects recent uploads, recovery references and live undo history.
- Video: a Polaroid player for local MP4/WebM clips up to **25 MiB and five minutes**, with supported browser codecs, captions, fit, play/pause/seek and fullscreen controls. Video bytes stay in IndexedDB and are included in backups/recovery. Nothing autoplays.
- Weather: current conditions and a real seven-day high/low forecast from Open-Meteo. Enter a city and country for an unambiguous match. Celsius/Fahrenheit conversion is local; responses are cached for 15 minutes, with refresh and online/focus reconciliation. Failed refreshes retain the last displayed reading and label the failure. Forecast dates follow the selected city's timezone.

## Storage and recovery
DayNest retains the original internal storage keys, asset database, alarms and backup format so existing dashboards, media, recovery copies and JSON backups continue to work after the rename. Keep the same unpacked extension directory when updating.

The installed extension uses chrome.storage.local; ordinary preview uses localStorage at its exact origin. Each has a separate IndexedDB image database. Keep the same preview address/port to see the same preview data. Schema migration preserves existing content and layout. Previously saved zoom now applies to the canvas; new dashboards start at 100 percent.

Only missing data seeds samples. Empty saved content remains empty. Invalid data opens recovery instead of being overwritten. **Download saved data** retains the raw saved value; confirmed **Back up and restore samples** writes a recovery copy before replacement. The most recent copy is under purrductivity.recovery. Unknown recovery data conservatively prevents image cleanup.

Unsaved drafts are memory-only. Dirty editors warn before supported page exits; closing/removing a dirty editor keeps a downloadable draft on that page. Download it before leaving. Notification delivery uses at-most-once claims: interruption between claim and OS popup may miss a notification but does not duplicate a work completion. Browser/computer closure does not guarantee an immediate alert.

**Settings > Recommended full themes** offers Warm Earth, Midnight, Ocean Breeze, Forest Green, Soft Sunset, Lavender, Paper & Ink, Sakura, Matcha, Nordic Snow, Vintage Sepia and Peach Cream. Wide gradient previews follow the reference order. Existing Dark Mode and Sunset data remains compatible and highlights Midnight and Soft Sunset.

Twelve recommended themes, per-tab undo/redo, portable JSON backups with photos/videos/background images, import previews, confirmed reset and recovery are implemented. History keeps up to 50 user actions until reload or replacement; timer commands and notification delivery stay outside history. Settings offers Restore previous dashboard. Backups remain limited to 50 MiB, so several large videos may exceed that limit. Stage 10 packaging and store handoff remain separate.

Settings also offers global and per-card border/background colors, border width, corners and shadow. **Dashboard background** accepts a local PNG/JPEG/WebP image up to 5 MiB, with fit and softness controls; choose **Save background** to apply it. The image participates in Undo/Redo, portable backups and recovery. Each card menu offers Customize and Pin in place; translucent, torn washi tape appears at the upper-left of pinned cards. Pinned cards keep their position and size during dragging, resizing, Arrange and Recover. See docs/card-customization.md.

The top-right toolbar has only Settings. Reset Dashboard and Restore previous dashboard are inside Settings. Compact three-dot card menus open on hover, click or keyboard. Canvas scrollbars are hidden; content uses small rounded thumbs revealed on hover/focus, with wheel/touch/keyboard scrolling retained. Tape press, photo glow, weather icon motion and the small Add-button paw respect reduced-motion preferences.

## Verification
Strict TypeScript, build/package checks and 70 tests pass. Browser checks include real drag/resize at multiple zooms, two-tab conflict handling, local widgets, date rollover, invalid-data recovery, media and offline operation. An isolated unpacked Edge profile verified actual New Tab override, service worker/alarm delivery with the dashboard closed, browser restart reconciliation and offline image/widget persistence. The latest installed-extension check fetched genuine Open-Meteo current conditions/forecast and verified video playback/background persistence after a profile restart offline. Real Windows popup rendering and physical sleep/resume are unverified.

The latest Date/Weather layouts and Polaroid/sticky presentations passed an isolated Edge check, including actual Add Widget creation, local midnight rollover, saved weather units/city, pinning, desktop/narrow layouts and menus, image upload/caption controls and sticky editing. Captures are in docs/screenshots. See docs/release-checklist.md for the full verification scope.

Optional Playwright checks after building:

```sh
node scripts/check-ui.mjs
node scripts/check-content.mjs
node scripts/check-workspace.mjs
node scripts/check-local-widgets.mjs
node scripts/check-widget-skins.mjs
node scripts/check-fullscreen.mjs
node scripts/check-extension.mjs
node scripts/check-settings-history.mjs
node scripts/check-card-menu.mjs
node scripts/check-customization.mjs
node scripts/check-date-weather.mjs
node scripts/fetch-video-fixture.mjs
node scripts/check-media-weather-background.mjs
node scripts/check-installed-media-weather.mjs
node scripts/check-weather-live.mjs
```

Playwright must be installed or PLAYWRIGHT_PACKAGE must point to its package.json. EDGE_EXECUTABLE overrides the default Windows Edge path. These checks use isolated profiles, not your personal dashboard.

See [Stage 9 verification](docs/release-checklist.md), [backup/history format and limits](docs/backup-history.md), [Stage 5–6 report](docs/stages-5-6-verification.md), [Stage 7 report](docs/stage-7-verification.md), [storage](docs/storage.md), [timing](docs/timing.md), [local widgets and image lifecycle](docs/local-widgets.md), and [reference specification](docs/ui-spec.md). Captures are in docs/screenshots.

## Assets
Placeholder cat-face extension icons are local PNGs at 16/32/48/128 pixels in public/icons; replace at the same sizes/names and rebuild. scripts/generate-icons.ps1 regenerates them. The legacy public/avatar.svg asset is no longer displayed. Flaticon Uicons is bundled locally, with attribution in Settings and license at public/licenses/flaticon.txt. See docs/backup-history.md for history/backup limits and the portable JSON format.
