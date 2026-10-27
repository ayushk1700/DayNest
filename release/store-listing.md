# DayNest · Edge Add-ons submission materials

Prepared 20 October 2026 for version 0.1.0. **Candidate only; not submitted or certified.** Resolve the release report's open gates before public distribution. The website is a product/support site, not a published extension listing.

## Listing fields

**Name:** DayNest

**Short description:** A calm, local productivity dashboard for your new tab.

**Category:** Productivity

**Language:** English (United States)

**Support email:** aayush31500@outlook.com

**Website:** https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site

**Privacy policy:** https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site/privacy.html

**Support page:** https://daynest-calm-new-tab.clever-tang-0272.chatgpt.site/support.html

**Search terms:** new tab; productivity; notes; task list; focus timer; habit tracker; dashboard; YouTube Music; equalizer

## Full description

DayNest gives your new tab a little room to breathe. Gather your notes, tasks, focus timer and daily reminders into a calm dashboard that feels like yours.

Keep the little things together:

- Notes, to-do lists and sticky notes for ideas and next steps.
- A Pomodoro timer, reminders, habit tracker and calendar for gentle structure.
- Clock and date widgets, plus optional city weather with a seven-day forecast from Open-Meteo.
- Personal photos, short videos and dashboard backgrounds, stored locally.
- An optional YouTube Music widget with playback controls, a local recent-track list and an equalizer that processes tab audio on-device when you start it.
- Twelve themes, paper styles, card customization and a canvas where you can move, resize and pin your widgets.
- JSON backup/import, undo/redo and a previous-dashboard recovery copy.

Your dashboard and uploaded media stay in your browser profile. DayNest has no account system, advertisements or built-in analytics. It reads visible track details from YouTube Music only when you use the optional Music widget; it does not inspect other sites. Music history and equalizer preferences stay in your browser profile. The equalizer captures the YouTube Music tab's audio only after you start it from the extension popup and processes it locally without recording or sending the audio. Local widgets work offline. Weather needs internet and sends your city search and resolved coordinates to Open-Meteo; see the privacy policy for details.

There is no automatic cloud sync. Export a backup before uninstalling or changing profiles. Images support up to 5 MiB; supported MP4/WebM videos support up to 25 MiB and five minutes. Backups can include personal media and are limited to 50 MiB. Notifications are optional and can be delayed or suppressed by the browser or operating system.

A little less tab-hopping. A little more headspace.

## Single purpose

Replace Edge's new-tab page with a personal dashboard for planning, notes, focus tools, optional city weather and YouTube Music playback.

## Permission explanations

| Permission | Reason |
| --- | --- |
| storage | Persist dashboard content, preferences, timer/reminder state, recovery copies and layout in the local browser profile. No chrome.storage.sync use. |
| alarms | Reconcile timer and reminder deadlines while dashboard tabs are closed and after browser startup. |
| notifications (optional) | Show timer/reminder system alerts only after the user chooses to allow notifications. Permission absence does not block local widgets. |
| activeTab | Allow a user action in the extension popup to identify the current tab for the optional equalizer. |
| tabCapture | Capture audio from the selected YouTube Music tab only after the user starts the equalizer from the extension popup. The audio is processed locally and is not recorded or transmitted by DayNest. |
| offscreen | Run the local audio processing graph required by the equalizer outside the popup window. |
| scripting | Load the bundled YouTube Music connector into an already-open matching tab when needed, so the Music widget can read visible track details and invoke playback controls. |
| tabs (optional) | Find and switch to an open PDF tab only when the user chooses **Find open PDFs** in PDF Studio. |
| https://geocoding-api.open-meteo.com/* | Resolve a user-entered city to a location for the optional Weather widget. |
| https://api.open-meteo.com/* | Fetch current conditions and a seven-day forecast for that resolved location. |
| https://music.youtube.com/* | Read visible YouTube Music player details and send playback-control commands when the user uses the Music widget. |

**New-tab override:** Required for the core new-tab dashboard behavior. DayNest does not request all-site, history, camera, microphone or geolocation permissions. The optional Tabs permission is requested only when the user chooses **Find open PDFs**.

**Remote code:** No. Scripts, fonts, styles and UI assets are bundled locally. Weather endpoints return data, not executable code.

**Data disclosures:** Local dashboard text and media are not uploaded by DayNest. YouTube Music track details and the recent-track list remain in the browser profile; the equalizer processes captured tab audio locally and does not record or transmit it. YouTube Music itself loads playback and artwork from YouTube, under its service. Disclose the weather location searches and resolved coordinates sent to Open-Meteo; the provider also receives normal request metadata including IP address. Do not blanket-certify “no data transmitted.” Review Partner Center's exact categories against the current policy before submitting. Support emails are voluntary and processed through email services. Website-host request logs are distinct from extension storage.

## Certification testing notes

No login, subscription or payment is needed for this candidate. Install it and accept the new-tab override if Edge prompts. Open a new tab. Use Add Widget for the twelve widget types and Settings for themes, appearance, backup/import, recovery and optional notifications.

Create a task/note, close and reopen the browser, and verify persistence. Export JSON and reimport it; import prompts before replacing current content and preserves a previous dashboard recovery copy. Test destructive or corrupted-data scenarios only in a separate profile.

Weather requests occur only when a Weather widget has a city. Use a recognizable city such as Pune, India. Local widgets and stored media work offline; a fresh offline weather request shows unavailable. Optional notification permission may need Windows settings enabled. No alert is guaranteed during shutdown, browser closure or sleep.

The sunflower is the extension and tab icon. Current package version is 0.1.0. The separately installed test observer used in diagnostics is **not included** in the package and adds no permissions to DayNest.

## Submission steps

1. Finish physical-device checks and external beta. Resolve the weather commercial-use decision. Confirm the contact/publisher identity and data disclosures.
2. Sign in to Microsoft Partner Center with the intended developer account. Owner must handle authentication, identity verification and legal agreements.
3. Create the Edge extension entry; upload the candidate ZIP with manifest.json at its root.
4. For a limited store-distributed beta, consider Hidden visibility, which is still a store distribution and review. Public visibility makes it discoverable. Choose intended markets explicitly.
5. Enter the listing, permission justifications, privacy URL and accurate data disclosures. Upload the sunflower store logo and screenshots separately.
6. Review the exact package and listing before submitting for certification. Resolve certification feedback before claiming a public launch.

Official requirements checked 20 October 2026: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension

Logo: 300×300 PNG prepared; screenshots: three actual-product 1280×800 PNGs with illustrative demo data. Microsoft currently allows up to six screenshots at 640×480 or 1280×800 and recommends a 300×300 logo (minimum 128×128).
