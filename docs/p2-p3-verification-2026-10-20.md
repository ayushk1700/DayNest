# P2/P3 stabilization follow-up — 20 October 2026

## Executive summary

**PASS for this stage.** The two previously failing browser checks pass. Settings can again unpin an off-screen card. Current usage/schema documentation is corrected, pnpm is pinned, and a fresh dependency installation builds and passes all 91 automated tests without changing the lockfile.

This closes the menu/customization/installation items in the earlier stabilization report for the tested Windows configuration. It does not establish public release readiness or replace remaining human/OS/performance/store checks.

## Inspection and pre-edit scope

- Initial commit: `07d49cd`, branch `main`. The only initial untracked file was the prior `docs/fix-verification-2026-10-20.md`; it was preserved. No applicable AGENTS.md was found in the project search; ancestor checks from the earlier stage remain applicable.
- Reviewed the actual card-menu component/CSS, browser harness, both failing scripts, appearance editor and existing pin actions, package/lockfile/workspace settings, storage validator and current/historical documentation.
- Pre-edit plan: measure the menu hit point, restore current customization test coverage, refresh current documentation, and verify installation in a separate folder. Source scope expanded to AppearanceControls after confirming the documented Settings unpin control was missing.
- Concurrent favicon edits appeared in `index.html`, icon-generation/verification files and the entry point during the work. They were not authored or reverted in this stage. Final isolated build/test input included the then-current favicon changes; the focused application change here is only the pin control.
- No schema, browser permission, storage key, database, backup format or dependency version changed. No migration or user-data cleanup was needed. No commit, push, deployment or store submission was performed.

## Findings by severity

### P0/P1

None confirmed in this focused scope. No claim of a comprehensive absence of critical defects is made.

### P2 — resolved

**Menu padding hit-test failure was a test-coordinate defect.** In actual Edge, the menu has an 18px corner radius. `elementFromPoint` at relative `{x:2,y:2}` returns the Notes heading beneath it; the point is outside the rounded surface. At `{x:100,y:3}` on the 200px menu, it returns the menu itself. Evidence: `menu-probe.log`.

The test now checks the center of top padding and asserts that the browser hit target is inside the popup and is not an action. It still performs a real click and verifies saved geometry is unchanged. It waits for the finite menu entrance animation and for the existing next-frame keyboard focus callback. Timer menu bounds are checked against the viewport, consistent with the existing unscaled portal implementation; the old test incorrectly required the entire popup to fit inside the timer card. No product CSS, menu geometry or hit regions changed, and no forced clicks were introduced.

**Customization harness expectations were obsolete.** Updated field/scope names, explicit color-inheritance toggles, global-scope reselection and Clear all overrides. Retained assertions for migration, computed colors/borders/corners, independent inheritance, pin protection, history, portable backup/reload and narrow menus. Added off-screen recovery, unsaved appearance draft independence and cross-tab pin UI updates. Pin assertions wait for persisted data and rendered state, rather than assuming an asynchronous repository write finishes synchronously inside a checkbox click.

**Missing Settings pin control was a product recovery regression.** Selecting an individual widget in Settings previously exposed appearance but no way to unpin it. A pinned card at an unreachable canvas position could not be recovered through the documented Settings flow. Restored **Pin position and size** outside the inert preview in the individual editor. It uses the existing conditional `pin` action, disables while saving, reports failures, and saves independently of appearance drafts. Global/type/batch scopes do not show this individual control.

Reproduction before the fix: move a card outside the visible canvas, pin it, open Settings and select the card. Recover intentionally leaves pinned geometry unchanged, but Settings offered no unpin control. After the fix: select the card, uncheck Pin position and size, then Recover widgets. The browser test places only its isolated fixture at `{x:90000,y:90000}` and verifies content preservation and reachable geometry after recovery.

### P3 — resolved within tested limits

**Documentation drift:** corrected schema 4, migrations through v3, twelve widget types, configured live-weather behavior, worker versus extension host permissions, inheritance/color controls, immediate pin saving and actual document-size limits. README now links dated evidence and reports 91 tests. The chronological release checklist preserves original counts with an explicit historical-results notice.

**Installation reproducibility:** `package.json` pins pnpm 11.25.0 and declares Node >=22.12.0. README uses `pnpm install --frozen-lockfile`. A new folder with no node_modules passed install, standard pnpm build and pnpm test under Node 24.19.0 on Windows. Existing cached package bytes were reused; registry metadata access was allowed. The lockfile was not regenerated.

## Files changed in this stage

- `src/dashboard/AppearanceControls.tsx`: restore the individual pin checkbox through the existing repository action.
- `scripts/check-card-menu.mjs`: valid padding hit point, explicit hit-test assertion, next-frame focus wait and viewport bounds.
- `scripts/check-customization.mjs`: current controls plus off-screen/draft/cross-tab pin coverage.
- `package.json`: exact package-manager version and supported Node minimum.
- `README.md`, `src/state/README.md`, `src/widgets/README.md`, `src/extension/README.md`: current setup and implementation descriptions.
- `docs/storage.md`, `docs/card-customization.md`, `docs/release-checklist.md`: current contracts/usage and dated evidence.
- This report. Test copies/logs/screenshots are generated only under the ignored artifacts directory; existing screenshots were preserved.

## Verification evidence

Evidence directory: `artifacts/p2-p3-2026-10-20/`. Browser scripts used isolated Edge profiles and copies of scripts/dist/public/compiled fixtures so fixed screenshot paths did not overwrite historical evidence. Bundled Playwright was supplied via PLAYWRIGHT_PACKAGE. Browser execution outside the sandbox was approved.

| Check | Exact final result | Evidence |
| --- | --- | --- |
| Strict TypeScript | Exit 0 | `typecheck-final.log` (empty successful output); also included in standard build |
| Production build and strengthened package verifier | Exit 0 | `build-final.log`, `package-final.log` |
| Full automated suite | 91 passed, 0 failed/skipped/cancelled, exit 0 | `tests-final.log` |
| Card-menu Edge check | Exit 0 | `check-card-menu.final.log` |
| Expanded customization Edge check | Exit 0 | `check-customization.final.log` |
| Overlay UI Edge check | Exit 0 | `check-ui.final.log` |
| Clock/paper/calendar skin Edge check | Exit 0 | `check-widget-skins.final.log` |
| Settings/history/backup Edge check | Exit 0 | `check-settings-history.final.log` |
| Fresh frozen-lockfile installation | Exit 0; 21 packages installed into a folder initially without node_modules | `fresh-install.log` |
| Standard pnpm build on fresh dependencies | Exit 0 | `fresh-build.log` |
| Standard pnpm test on fresh dependencies | 91 passed, 0 failed/skipped/cancelled, exit 0 | `fresh-tests.log` |
| Latest source snapshot build/package check on those dependencies | Exit 0 | `latest-build.log` |
| Latest source snapshot test suite | 91 passed, 0 failed/skipped/cancelled, exit 0 | `latest-tests.log` |
| Scoped whitespace/diff review | Exit 0 | Executed `git diff --check` for stage files |

Both the project lockfile and the installed snapshot retain SHA-256:

`EB65A6BFC3DDA16C2244475816AA494D0CC90D57BB0C18FD7859B27407C24640`

`final-input-hashes.json` records the focused runtime/test/package input hashes. The final isolated source snapshot is in `fresh-install/`. The initial offline attempt was superseded by the successful network-enabled installation; initial browser timing failures were corrected as described above and superseded by final passing logs.

Browser coverage includes hover/click/keyboard/touch menus and reduced motion; real pin locking for pointer/keyboard/resize/Arrange/Recover; off-screen unpin in Settings; pin undo/redo and portable backup round trip; independent pin/draft behavior and cross-tab updates; overlay focus/return and narrow layouts; all Notes skins and clocks; grouped/native history, twelve-theme contrast checks, invalid/cancel/stale import preservation and reset/recovery. The settings/history script also checks no external web requests in its local scenarios. Visually inspected the fresh Customize screenshot: restored checkbox, paper/preview, pale-blue surfaces and existing dialog layout remain legible and intact.

## Compatibility, remaining limits and next action

The pin action retains runtime validation, expected-value conflict checks, revision/history semantics and existing storage. No stored dashboard or user asset was reset. New runtime behavior is limited to restoring access to an existing action. Pin changes save immediately; Cancel appearance does not undo them. The test verifies that distinction.

- Offline install attempt: **BLOCKED**, `ERR_PNPM_NO_OFFLINE_META` for `@esbuild/aix-ppc64` registry metadata during pnpm's supply-chain check. No policy was disabled. Online metadata access resolved installation; a complete offline-install guarantee remains out of scope.
- A fully empty package cache, other operating systems, Node 22 execution and other package-manager versions were **NOT EXECUTED**. Clean node_modules installation with a reused package cache is the verified condition.
- No fresh dependency advisory audit, startup/memory/maximum-data benchmark, human NVDA/forced-colors/physical-touch audit, physical sleep/resume, real OS popup check or store submission was executed in this stage. Earlier report limits remain open. These are separate release gates.
- Installed-extension/live-provider suites were not rerun in this focused stage; the prior installed-extension evidence remains historical. Five dependent browser scripts above are fresh evidence for these changes, not a claim that every browser script was rerun.
- Concurrent favicon work and the prior untracked verification report were preserved and are outside this stage's implementation scope. Additional changes in `src/extension/runner.ts` and `tests/workspace-timing.test.mjs` appeared after the recorded validation snapshot; they were not edited, reviewed or represented as tested by this stage. The 91-test results apply to the captured snapshot, not to those later changes.

Recommended next action: review the scoped diff, then complete dependency-advisory, performance, accessibility and real OS release gates. This stage's P2/P3 acceptance criteria pass; public release status remains **PARTIAL**.
