# Stabilization audit — 20 October 2026

## Executive summary

Stage: **PARTIAL**. Fresh compilation, production packaging, 91 automated tests and ten browser-check scripts passed. Two browser scripts still fail and require triage. This report does not certify public release readiness. No publication, submission, push or destructive migration occurred.

Scope: establish a current-source baseline, inspect extension/storage/network boundaries, fix demonstrated defects, and preserve independent evidence. Earlier reports remain historical evidence and were not treated as fresh results.

## Inspection and pre-edit scope

- Workspace: `D:\BOOKS\PURRDUCTIVITY`. No `.git` metadata is present. `git status --short` and `git log -5 --oneline` both returned `fatal: not a git repository`. Change ownership and commit provenance cannot be established from this copy.
- No AGENTS.md was found in the workspace (excluding dependencies) or the checked ancestors `D:\` and `D:\BOOKS`.
- Reviewed package/lockfile, Vite/test/build scripts, manifest/icons/licenses, repository and subsystem READMEs, historical release report, and source around validation, persistence/recovery, backup/assets, background reconciliation, weather, widget rendering, gestures, overlays and customization. This was a targeted inspection, not a line-by-line audit of every file.
- Actual stack: React/React DOM 19.3.1, TypeScript 5.9.3, Vite 7.3.7, MV3. Installed core versions match the lockfile. Execution runtime: Node 24.19.0; available pnpm 11.25.0.
- Product branding currently says DayNest. Purrductivity remains the internal storage/backup namespace. Neither was renamed.
- Existing features include twelve widget types, independent ambient notes, freeform layout/zoom/pinning, themes, appearance inheritance/presets, batch/layout tools, history, local media/backgrounds, backups/recovery, weather, reminders and Pomodoro alarms.
- Baseline: strict TypeScript, build/package checks and all 90 existing tests passed using the documented direct commands.
- Initial edit plan was verification code/tests plus this report; runtime code was added to scope only after a browser failure demonstrated a missing Customize skin control. Changes are additive and focused. No schema, storage key, asset database, permission, public action or backup format changed.
- Planned checks: fresh compilation/build, full automated suite, isolated browser regressions and actual unpacked Edge restart/alarm/offline checks. Browser fixtures never use the personal Edge profile or user dashboard.

## Findings by severity

### P0

No confirmed P0 defect in the inspected scope. This is not a guarantee that none exists.

### P1

No confirmed P1 product defect. Release remains on hold pending failed browser-check triage, provenance and the unexecuted release checks below.

### P2

1. **FIXED — package gate accepted unresolved worker-only imports.** In a temporary copy of `dist`, appending `import "./assets/missing-worker-module.js"` to `background.js` still passed the old verifier. The existing shared worker dependency is also HTML-preloaded, so deleting that particular shared file was already detected; the reproduced gap concerns imports absent from HTML asset links. The new verifier inspects static imports, re-exports and dynamic imports in emitted JavaScript using the existing TypeScript parser. It rejects missing targets, remote/bare specifiers, paths escaping the package and nonliteral dynamic targets. This is a module-packaging gate, not a general JavaScript security scanner.
2. **FIXED — live skin controls missing from Customize.** The skin browser check failed with `Skin setting did not save` at the Customize step. `WidgetHeader` rendered only AppearanceControls; the only Notes paper selector within that dialog belonged to its inert preview. Restored the existing WidgetSkinControls component outside the preview for eligible widgets. Normal card skin controls, text and saved settings are retained. The browser test now explicitly selects `.skin-customization` and verifies it is outside an inert ancestor. The complete skin check subsequently passed.
3. **OPEN — card-menu browser check fails.** Both pre-fix and final runs time out clicking popup padding at `{x:2,y:2}`: a Notes header intercepts pointer events. Reproduce with `node scripts/check-card-menu.mjs` after build. No forced click or assertion bypass was introduced. This may concern hit testing, menu timing or the test coordinate; root cause is not established. Other scripts successfully interact with menus, but this does not close the failure.
4. **OPEN — customization browser harness has obsolete expectations.** `check-customization.mjs` times out waiting for `Card border color`; current source uses `Border color` plus explicit inheritance controls. Other old expectations include `Use defaults` and `Customize card selection`. Update the harness against the current user flow and rerun its full inheritance/pinning/migration scope. Do not merely rename selectors without verifying the intended assertions.

### P3

- README reports 70 tests and the historical release checklist reports other older counts; current baseline was 90 and final suite is 91. Subsystem READMEs also contain old widget/weather descriptions. This dated report supersedes their counts only for this run; historical records were preserved.
- pnpm's build command attempted automatic installation/project registration and failed with EPERM creating a project symlink in the sandbox's pnpm store. The documented direct commands succeeded without dependency changes. Clean frozen-lockfile installation remains unverified.
- Public-facing brand decision, placeholder icons and store/privacy handoff remain unfinished release work. Existing documentation explicitly identifies placeholder icons.

## Implementation changes

- `scripts/verify-build.mjs`: validate emitted JavaScript module targets in addition to existing MV3/CSP/permissions/HTML/CSS/icon/license checks. Uses the already-installed TypeScript dependency; adds nothing to extension runtime output.
- `tests/build.test.mjs`: regression cases for missing static, re-export and dynamic imports, remote imports, escaping paths and computed targets. Tests create and remove only their own temporary package copies.
- `src/widgets/WidgetHeader.tsx`: restore the existing live clock/paper skin component in Customize.
- `scripts/check-widget-skins.mjs`: distinguish the live customization selector from its inert preview and assert that boundary.
- This new report. Generated `dist`/`.test-build` were refreshed; isolated evidence/copies are under `artifacts/stabilization-2026-10-20`. Existing source documents/screenshots were not overwritten by browser checks.

Compatibility: no data migration. Skin changes use existing actions and stored values. No user storage was cleared, reset or replaced; reset/recovery scenarios ran only against isolated fixtures. No dependencies or browser permissions were added.

## Verification evidence

Logs and screenshots: `artifacts/stabilization-2026-10-20/`. Browser scripts ran from copies of scripts/dist/public and required compiled fixtures in that directory so their fixed screenshot paths did not overwrite earlier evidence. A bundled Playwright package was supplied through PLAYWRIGHT_PACKAGE, without editing dependencies. Edge required approved execution outside the sandbox; sandbox launches terminated before checks could run.

Final build verification commands and results:

| Check | Result | Evidence |
| --- | --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 | `typecheck.log` (empty successful output) |
| `node node_modules/vite/bin/vite.js build` | PASS, exit 0; 92 modules transformed | `build.log` |
| `node scripts/verify-build.mjs` | PASS, exit 0 | `package.log` |
| `node scripts/run-tests.mjs` | PASS, 91 tests, 0 failed/skipped/cancelled | `tests.log` |
| Focused `node --test tests/build.test.mjs` | PASS, 2 tests | Captured tool output; also included in full suite |

Browser results (all exit 0 unless stated):

| Script | Result and scope | Evidence |
| --- | --- | --- |
| check-ui | PASS after runtime fix: focus, Escape, narrow overlays, no page errors | `check-ui.final.log` |
| check-widget-skins | PASS after runtime/test fix: live clocks, formats/reload, all paper skins and text preservation, Customize, calendar/week starts, narrow sizing, reduced motion | `check-widget-skins.final.log` |
| check-content | PASS: keyboard tasks, notes/sticky autosave, two-tab conflicts, recovery | `check-content.escalated.log` |
| check-workspace | PASS: drag/resize 50/100/150%, layout retention, timer/reminder operations | `check-workspace.escalated.log` |
| check-local-widgets | PASS: clock/habits/calendar, image persistence/invalid upload/cleanup | `check-local-widgets.escalated.log` |
| check-fullscreen | PASS: actual fullscreen and denied-request retry | `check-fullscreen.escalated.log` |
| check-settings-history | PASS: grouped/native undo, twelve theme contrast checks, image backup round trip, invalid/stale/cancel preservation, reset/recovery, no external requests | `check-settings-history.escalated.log` |
| check-media-weather-background | PASS: real local video decode/play, portable media/background backup and recovery; weather uses fixtures | `check-media-weather-background.escalated.log` |
| check-date-weather | PASS: local midnight rollover, saved units/city, fixture forecasts, pin/layout and media controls | `check-date-weather.escalated.log` |
| check-extension | PASS: actual unpacked New Tab override, background alarm while closed, restart, once-only completion, offline IndexedDB/media/preferences | `check-extension.escalated.log` |
| check-card-menu | FAIL, exit 1: padding click intercepted by Notes header | `check-card-menu.final.log` |
| check-customization | FAIL, exit 1: obsolete field expectation | `check-customization.escalated.log` |

The two `final` successes specifically cover the changed runtime control and its dependent overlay. Other scripts ran against the initial production build or during the rebuild window and are broader baseline evidence, not represented as a complete final-build rerun. The module-check change affects verification tooling only. The failed initial/strict-selector skin logs are superseded by `check-widget-skins.final.log` after explicitly targeting the live control.

Visually inspected the newly captured clock/paper/calendar desktop screenshot: pale-blue canvas, warm paper, clock faces and stationery layout retained. Screenshot dates/content are isolated fixtures. This is not a complete visual/accessibility certification.

Security observations from inspected source and execution: required permissions remain storage/alarms; notifications optional; exact two Open-Meteo hosts and restricted connect-src; no unsafe HTML injection/eval found in the searched source; weather fetch uses omitted credentials/no referrer with runtime response validation; repository uses Web Locks and validated conflict-aware writes; imported media is staged with fresh IDs; recovery/undo references protect assets. These are scoped observations, not penetration-test certification.

Production output measured 882,814 bytes across 14 files at this run. Largest outputs are the local icon font (~385.64 kB), dashboard JavaScript (~342 kB), CSS (~100.60 kB) and shared JavaScript (~43.97 kB). These are artifact sizes, not startup, memory or interaction benchmarks. No speculative performance refactor was made.

## Not executed / remaining limits

- Git status/history: **BLOCKED**, no Git metadata in supplied directory.
- Standard pnpm build: **BLOCKED**, EPERM symlink registration; equivalent direct build passed.
- Initial local Playwright resolution: **BLOCKED**, MODULE_NOT_FOUND; resolved with bundled package. Initial sandbox browser launches: **BLOCKED**, Edge terminated with profile/crashpad errors; approved isolated reruns executed.
- New genuine live-provider/installed-live-weather checks: **NOT EXECUTED** in this scope. Forecast assertions here used fixtures; no fresh live-service claim is made.
- Fresh clean install and online dependency advisory audit: **NOT EXECUTED**. Lockfile review/version match does not establish vulnerability status or reproducible clean installation.
- Human NVDA/forced-colors/physical touch audit, Windows notification popup behavior, physical sleep/resume and managed Edge/competing extensions: **NOT EXECUTED**, no corresponding human/hardware/enterprise environment exercised.
- Startup CPU/memory/long-session and maximum-data performance benchmarks: **NOT EXECUTED**, no benchmark harness established in this stage.
- Final store package/privacy/listing review: **NOT EXECUTED**, this stage is stabilization only. No release ZIP is approved for submission.

## Acceptance and next action

PASS: preserved data contracts/design; reproduced and fixed two scoped defects; fresh typecheck/build/package/full automated suite; successful dependent skin/overlay browser checks; retained independent evidence.

PARTIAL: complete browser regression gate (two failures), provenance, clean-install/advisory checks, performance/human/OS/store release gates.

Next action: triage the menu hit-test failure and refresh the customization harness against current inheritance controls, then rerun the complete final-build browser suite. Follow with clean frozen-lockfile installation/advisory review and explicit performance/accessibility/OS release gates. Keep the public release on hold until those acceptance criteria are evidenced. No critical data-loss/security defect was confirmed; no claim of production readiness is made.
