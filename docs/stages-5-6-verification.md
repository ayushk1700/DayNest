# Stages 5 and 6 verification

Completed 2026-10-18, before proceeding to Stage 7.

Stage 5: widgets move by their headers, resize from corner handles, retain position/size/stacking order, and come forward when selected. Header arrows move, Alt + arrows resize and Shift gives fine steps; Layout offers numeric controls. Settings zoom scales the canvas while fixed controls, dialogs and picker remain unscaled. Arrange Widgets wraps cards into rows. Recover widgets restores reachable headers and resets canvas scrolling. Narrow windows use flow layout without rewriting desktop geometry. Core widgets can be created in the picker with visible default placement.

Stage 6: Pomodoro start/pause/resume/reset, work/break transitions, duration settings and daily work-session count. Reminders support create/edit/delete, local due timestamps, captured timezone and upcoming/passed display. A bundled module service worker uses one nearest-deadline alarm, startup/storage listeners, persisted session IDs/deadlines and conditional notification claims. Only storage and alarms are required; notifications are optional through Settings.

Automated checks: strict TypeScript, production build, packaged entries and 29 tests passed. Tests cover prior data integrity plus zoom math/minima, stale layout changes, placement/arrange/recovery, pause/resume, delayed completion, local-date boundaries, duplicate completions/notifications, permission absence/OS denial/failure, interrupted claims, alarm scheduling and schema migration.

Headless Edge browser checks passed: real pointer drag/resize at 50/100/150 percent, no initial jump, geometry saved only when a gesture ends, header keys, editing without movement, reload persistence, narrow layout preservation, recovery/arrange, reminder CRUD/date states, timer pause/reopen/completion/break/reset/settings. The previous content and overlay regression scripts also passed against this build. Screenshots use 1920 × 925 and 390 × 844 viewports.

An isolated unpacked Microsoft Edge installation passed real extension storage, service-worker registration, alarm delivery while the dashboard was closed, native New Tab override and browser restart reconciliation. Tests shortened saved deadlines to seconds; they did not wait through a full 25-minute session. Optional notification permission remained ungranted, so no real OS popup was sent. Granted/denied/failed notification paths are tested with API mocks. Actual OS sleep and Windows notification rendering are unverified.

Inspected desktop, Settings, narrow-flow and installed-extension screenshots. Additional controls fit the reference palette and card treatment. The timer now includes state/settings; sticky has a visible grip. Schema v2 migration retains previous text/layout/theme/zoom; enabling the previously disabled saved zoom now applies its scale. New dashboards start at 100 percent.

Notification delivery is at most once: a persisted claim precedes the external API call. If the worker terminates between claim and popup, an alert may be missed and is not retried. Completion records remain saved once. Browser/computer closure can delay alerts; startup reconciles expired sessions and reminders. Development preview only reconciles while open or on next opening.

Run: pnpm build, pnpm test; then reload dist through edge://extensions and open fresh tabs. Optional checks: node scripts/check-workspace.mjs, node scripts/check-extension.mjs, node scripts/check-content.mjs and node scripts/check-ui.mjs. Set PLAYWRIGHT_PACKAGE/EDGE_EXECUTABLE if needed. No personal Edge profile was used.

