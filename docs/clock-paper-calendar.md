# Clock faces, paper skins, calendar and fullscreen

Use the selectors at the bottom of Clock and Notes, or the card menu's Customize action. Clock offers Simple, Digital alarm clock and Rounded analog. Notes offers Plain, Lined, Grid, Dotted and Kraft. Changes save immediately; existing content and geometry are preserved. The digital case resembles an alarm clock but does not add alarm behavior. Use Reminder for alerts.

Calendar follows the reference with a cream/cyan surface, numbered month heading, weekday capsule, outlined event dates, monthly agenda and year badge. Add your own events with +; edit and delete icons sit inside event rows. Today and arrow keys retain date navigation, and the week-start selector persists Sunday/Monday independently for each calendar.

The four-corner button beside Arrange Widgets now opens real browser fullscreen. Click it again or press the browser's Escape shortcut to leave. The icon and accessible label follow browser fullscreen changes, including exits outside the button. Fullscreen is not stored and does not change layout data. The root document enters fullscreen, so Settings, picker and floating card menus remain available. Denied requests show a dismissible error and leave retry enabled. Unsupported browsers disable the control with an explanatory tooltip. No extra extension permission is requested.

Recover widgets moved to Settings → Workspace. It still brings off-screen cards into view while preserving pinned cards. Reset/Restore remain separate controls for dashboard content.

Verification on 19 October 2026:

- Strict TypeScript, production build, local assets/manifest/CSP verification and 69 integrity tests passed.
- Six new integrity tests cover live clock parts and intermediate hand angles, old settings, every skin's history/backup round-trip, conditional conflicts, strict invalid settings and calendar week preference preservation.
- `scripts/check-widget-skins.mjs` checks actual picker creation, live digital/analog ticks, 12/24-hour/reload, all Notes skins and text preservation, Customize, calendar event creation/week start/keyboard rollover/reload, custom paper color, desktop/narrow and minimum card sizing, and reduced motion.
- `scripts/check-local-widgets.mjs` passed the existing clock/habit/calendar/image/weather regression, including calendar edit/delete, month/year keyboard navigation, reload, offline history and media preservation.
- `scripts/check-fullscreen.mjs` checks real Edge fullscreen enter/exit, keyboard activation, browser-controlled exit synchronization, Settings visibility, unchanged saved data, relocated recovery, a rejected-request error/retry, and narrow layout. Physical Escape and screen-reader announcements were not manually exercised; browser-controlled exit was tested through the native API.

The preview fixtures use a simulated 20 December 2026 clock and two test events only in an isolated browser profile. They are never default dashboard content. Inspected captures include the 1920×1120 desktop layout, 390×844 narrow calendar and 240×180 compact digital clock:

- [Desktop preview](screenshots/clock-paper-calendar-desktop.png)
- [Digital clock](screenshots/clock-digital.png)
- [Analog clock](screenshots/clock-analog.png)
- [Compact digital clock](screenshots/clock-digital-compact.png)
- [Calendar](screenshots/calendar-studio.png)
- [Narrow calendar](screenshots/calendar-studio-narrow.png)

Build commands and loading instructions remain in README.md. Reload the existing unpacked extension after rebuilding, then open a fresh dashboard tab.
