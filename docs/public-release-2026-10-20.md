# DayNest release readiness · 20 October 2026

**Status: release candidate prepared; public release is not complete.** Current extension version: 0.1.0. All work below is scoped to this build and the recorded environment. No external beta, real OS accessibility review or store certification is claimed.

## The six requested steps

| Step | Result | Evidence / remaining work |
| --- | --- | --- |
| 1. Installed Edge fixes | PASS in isolated Edge | Sunflower appears in browser tab favicon metadata and decodes to 32×32; title and notes survive restart; invalid-data alarm pause/recovery runs without console errors. Original user profile's visible tab bar not directly inspected. |
| 2. Everyday reliability | PASS automated scope | Restart, background alarms with no dashboard, offline local data/media, multiple-tab conflicts, backup/import/reset recovery and media validation passed. Real Windows popups and physical sleep/resume remain manual. |
| 3. Accessibility/performance | PASS automated scope; PARTIAL overall | Keyboard focus, theme contrast, narrow layouts, forced colors, reduced motion, 100 widgets and near-limit image passed. NVDA, physical touch and OS checks remain open. |
| 4. Privacy/support/website | PASS; public deployment verified | Product website, privacy and support pages use aayush31500@outlook.com. The owner explicitly approved this specific website becoming public, and native access verification confirms public mode. README redesigned; original details retained in developer-guide.md. |
| 5. Store package | PASS candidate packaging | ZIP has manifest.json at root; all 17 entries match the verified build by SHA-256. Three 1280×800 actual-product screenshots, 300×300 logo, listing copy, permission explanations and third-party notices prepared. Not submitted. |
| 6. External beta/certification | PENDING external inputs | User has no tester addresses yet. No messages sent; the public website accepts beta interest by email. Partner Center account not yet enrolled. Weather distribution/commercial eligibility unresolved. Beta plan, invitation, manual checklist and account handoff prepared. |

## Environment and isolation

- Edge 155.0.4283.62, Windows; Node 24.19.0; installed dependencies and existing frozen lockfile.
- Browser scripts ran against copied build/scripts/assets in `artifacts/release-2026-10-20/` with temporary profiles, never the user's installed profile. A separate test-only observer extension read tab metadata; DayNest's production permissions remain storage, alarms, optional notifications and the two weather hosts.
- Edge crashed under sandbox execution. The approved outside-sandbox rerun succeeded. The initial favicon metadata probe used DayNest itself, whose lack of tabs permission correctly redacted metadata; the corrected observer-based probe passed. A test expected a manual retry button after restored valid data, but the dashboard recovered automatically; the test was corrected to wait for that actual behavior. These initial harness failures are retained in session history and superseded by the final passing log.
- The latest user's stored snapshot was previously checked read-only, but no installed user-profile data was changed during this release pass.

## Checks and results

| Check | Result | Evidence under artifacts/release-2026-10-20 |
| --- | --- | --- |
| Strict TypeScript / Vite / build validation | PASS | Final packaging command exit 0; package metadata and final-package-files.json |
| Full automated suite | 93 passed; no failures/skips | tests-final.log |
| Isolated installed extension, alarms/restart/offline media | PASS | step-1-extension.log |
| Favicon/title/restart/invalid storage recovery | PASS | step-1-release.log; results/installed-release.json |
| Multi-tab and content integrity | PASS | step-2-check-content.log |
| Themes/contrast, history and backup recovery | PASS | step-2-check-settings-history.log |
| Video/media/background/weather failure handling | PASS with controlled weather responses | step-2-check-media-weather-background.log |
| Overlays, focus return and narrow layout | PASS | step-3-check-ui.log |
| Performance and accessibility emulation | PASS within stated scope | step-3-check-release-performance.log; results/performance-accessibility.json |
| Dependency advisories | 0 info/low/moderate/high/critical reported | dependency-audit.json; network-enabled registry check |
| Product website | PASS at 390, 640, 768, 1440 widths | site-check.log; site/checks.json; desktop/mobile/privacy/support screenshots |
| Store screenshot capture | PASS; actual product with illustrative sample data | step-3-capture-store-assets.log; store-assets/ |

The final extension runtime HTML/JS/CSS hashes match the browser-tested snapshot. The subsequent package addition is third-party notices; no behavioral source change followed browser verification. Package contents are independently compared by hash by `release/package-extension.ps1`.

## Performance measurements

These figures are local diagnostic samples in headless Edge, not a startup/memory service-level guarantee or a broad hardware benchmark.

| Scenario | Measurement |
| --- | --- |
| 100 notes widgets, 1,471,877-byte document | Reload-to-render: 1,215 ms; 1,647 ms; 1,167 ms |
| Edit and persist one note in that dashboard | 911 ms, including input and save debounce |
| JavaScript heap at sampled stress state | 108,178,310 bytes; not total process/system memory |
| Real PNG upload, 4,859,822 bytes | Upload-to-render: 1,328 ms; survived reload |
| Settings keyboard focus | 90 Tab transitions remained in dialog; Escape returned focus |

100 widgets is a deliberately heavy notes workload. Simultaneous maximum-size videos/images and every widget mix were not benchmarked. Existing unit/browser tests cover media bounds, real video decoding/playback and backup behavior; they do not establish maximum-device performance.

## Website and README

Website: https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site

Privacy: https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site/privacy.html

Support: https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site/support.html

Site ID: appgprj_6ad70956e7fc8191a0fb978de89ed9e7

Saved version: appgprj_6ad70956e7fc8191a0fb978de89ed9e7~appgver_2c52510a436081918866e7f89666476c (version 1)

Deployment: appgdep_6ad70c948b948191bd37dab632973983; succeeded. Source commit: 1208287c53cc648d3e38a16c53fa645963e46ed7.

Audience: PUBLIC, confirmed by native Sites access update and get_site on 20 October 2026 after the owner explicitly approved the exact URL, privacy/support pages and support email. Initial automatic review rejected the audience change; the agent retained a private preview until that approval arrived, then repeated the authorized access change successfully. The product website is public; the extension itself remains an unpublished candidate.

The website has no DayNest analytics, external fonts, forms or remote embeds. Its mail links open the visitor's email application; it makes no fake store-install promise. It clearly states beta status, local-storage limits and undecided pricing. The published static site and new README are visually themed around the pixel sunflower and cream/olive palette.

## Candidate package

File: `release/daynest-0.1.0-candidate.zip`

Size: 1,461,237 bytes; 17 files; manifest at root.

SHA-256: `4775457E4E7F286D27A7E9658970502B9CB178CDF83E2A3FE86C58C7D8BEF0FF`

No source tree, node_modules, credentials, test observer or source maps are included. The separate website source credential was kept in session memory and delivered to the Sites helper over hidden stdin; it is not in the website, archive or extension ZIP.

## Gates still open

**IP review added 20 October:** existing Daynest/DayNest productivity/planning uses were found, and the owner confirmed the UI reference screenshots came from another product. Name clearance and review/redesign of distinctive referenced UI are now explicit release gates. See [IP review](ip-review-2026-10-20.md). The candidate package is not legally cleared by its passing technical checks.

1. Public website approval and native public-access verification are complete. Anonymous HTTP checks are recorded in the evidence directory.
2. Determine weather-service eligibility for the intended distribution. Owner selected “Undecided.” Open-Meteo's current free endpoint excludes commercial products/promotional activities; a commercial plan uses a customer endpoint/key and would require an appropriate secret-preserving architecture or another approved approach. Do not embed secret keys in the distributed extension.
3. Complete the real OS notification/suppression, physical sleep/resume, NVDA, touch and original-profile visual checks listed in `release/manual-testing-checklist.md`.
4. Receive actual tester addresses, obtain willing participation, run the beta and fix findings. No beta feedback can be claimed yet.
5. Owner enrolls in Partner Center with genuine identity/contact details and personally handles authentication/agreements. Prepare and submit only after the preceding gates are resolved.

## Primary references checked

- Microsoft Edge publishing: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Developer registration: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
- Open-Meteo service terms: https://open-meteo.com/en/terms
- Open-Meteo commercial endpoint/pricing: https://open-meteo.com/en/pricing

