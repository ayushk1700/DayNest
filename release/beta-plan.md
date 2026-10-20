# DayNest private beta

## Current state

Beta materials are prepared. No external testers have been recruited, contacted or observed, and no results have been invented. Public store submission remains pending the release report's gates. Weather-service commercial use remains undecided; resolve provider eligibility before distributing a commercial product or promotional beta.

## Suggested cohort

Recruit 5–10 willing Microsoft Edge users with a mix of screen sizes and familiarity with productivity tools. Include someone who uses a keyboard/screen reader and someone willing to test Windows notifications and sleep/resume. A seven-day first round is a suggested schedule, not an automation or a completed beta.

## Preparation

- Share the privacy policy, beta status, known limits and support email.
- Ask testers to use sample/non-sensitive data initially and export a backup before updates.
- Share the versioned candidate ZIP and checksum through the chosen channel. A local beta requires Developer mode and Load unpacked; a Hidden Edge Add-ons listing is an alternative after certification.
- Keep each tester's unpacked extension folder stable between updates. Switching to a store installation may require exporting/importing because its extension identity can differ.
- Do not collect dashboard backups, personal media, browsing history or telemetry by default.

## Test sequence

1. Install, accept the new-tab override and confirm the sunflower/title.
2. Create a task, note and reminder; change a theme and move/resize/pin a card.
3. Close/reopen Edge; confirm all content and layout return.
4. Open two dashboard tabs; edit different widgets and check propagation. Check explicit conflict handling for competing edits.
5. Upload an image and short supported video, then reload offline. Verify local bytes still render.
6. Export a JSON backup. Restore it in a separate test profile; compare content, layout and media. Verify import cancellation leaves current content intact.
7. Enable optional notifications. Let a short timer expire with the dashboard closed; check one alert and one completion. Test permission denial and Windows suppression separately.
8. Sleep the computer across a deadline, resume, then restart Edge. Record late/missed behavior and duplicate counts; never promise an OS alert while asleep or closed.
9. Complete tasks with keyboard only; inspect NVDA announcements, high contrast and physical touch on available hardware.
10. After several days, record the three most useful things, three confusing things and any data-loss, freeze or installation problem.

## Feedback template

Version / Edge version / Windows version:

What I expected:

What happened:

Steps to reproduce:

Frequency and impact:

Screenshot with private content removed (optional):

Send to aayush31500@outlook.com. Do not attach full backups unless a specific, necessary and privacy-reviewed diagnostic process is agreed.

## Exit criteria

- No unresolved data-loss, unrecoverable startup, security or critical privacy defect.
- Backup/import and installation-update flows pass on every tested device.
- Timer/reminder behavior and its OS limits are accurately described, with no duplicate completion/delivery.
- Keyboard/NVDA/high-contrast findings are addressed or explicitly scoped before launch.
- Any performance regressions are reproduced and resolved or bounded.
- Owner confirms commercial/provider eligibility, public privacy/support URLs, publisher details and final listing accuracy.

External beta status: **NOT STARTED**. Tester results and pass/fail records must be added after real participation.
