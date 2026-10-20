# Stage 7 verification

Completed 2026-10-18 after Stages 5–6.

Implemented all picker entries; Clock, Habit Tracker, Image and Calendar work with local data. Weather has a persisted manual city and an explicit provider-setup state. No subscription gating, cloud accounts, remote image/font assets or live weather data were introduced. Required permissions remain storage and alarms; notifications stay optional.

Automated checks: strict TypeScript, production build and package verification passed. The suite has 36 tests covering all prior integrity/timer/layout cases and new defaults, local calendar/leap/year boundaries, habit conflicts/dates, calendar CRUD/date validation, image header/size validation, safe cleanup policy and weather-provider validation.

Headless Edge browser checks passed for picker creation, clock preference, habits/history and simulated local-day rollover while offline, calendar create/edit/month/year/keyboard navigation, image upload/caption/fit/reload/removal, rejection of a renamed SVG without replacing the saved image, and weather setup. Real IndexedDB cleanup removed an old orphan while retaining current/recent assets. Valid recovery references protect old assets; an invalid recovery copy skips cleanup. Reload preserved local data. Calendar/habit deletion, independent clock instances and narrow calendar layout also passed.

An isolated unpacked Edge profile passed an actual browser restart followed by offline extension reload: IndexedDB image bytes, clock preference, habits and calendar events remained available. The same script rechecked the real service worker, alarms with no dashboard, native New Tab override and restart reconciliation. No personal Edge profile was used. Notification permission stayed ungranted; OS popup rendering remains unverified.

Visual checks use 1920 × 925 desktop and 390 × 844 narrow viewports. Inspected the arranged local widgets, calendar event view, narrow calendar card and installed offline image/clock/habit view. Image fixtures use the project's own cat icon, not a remote image. Screenshots are in docs/screenshots/stage-7-*.png.

Limits: live weather requires a selected, documented provider and network configuration; it is intentionally unavailable. Image formats are PNG/JPEG/WebP only. Cleanup uses a 24-hour grace period and is conservative around unknown recovery copies. Portable backups including image binaries, undo/redo, themes, full release/accessibility audit and packaging remain later stages. The browser date rollover test advances its isolated clock; it does not change system time.

Run pnpm build and pnpm test, then reload dist in edge://extensions. Optional browser checks: scripts/check-local-widgets.mjs, scripts/check-workspace.mjs, scripts/check-extension.mjs, scripts/check-content.mjs and scripts/check-ui.mjs with Playwright available. See README for environment overrides and direct Node check commands.

