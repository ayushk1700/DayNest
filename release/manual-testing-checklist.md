# Physical-device release checks

These checks require real observations. Automated browser emulation does not complete them. Use a separate test profile with sample data and export a backup before update/recovery experiments.

| Check | Procedure | Result |
| --- | --- | --- |
| Installed browser tab bar | Reload DayNest in the original profile, open a fresh tab, inspect sunflower/title in light and dark Edge chrome, then restart Edge. | NOT EXECUTED in original user profile; isolated Edge metadata check passed |
| Windows notifications | Allow optional notifications and Windows notifications, finish a short timer while the dashboard is closed, inspect popup title/icon/text and count. | NOT EXECUTED; automated permission-denied/delivery paths passed |
| OS suppression | Repeat with Do Not Disturb/Focus Assist enabled; verify in-app completion even if popup is suppressed. | NOT EXECUTED |
| Physical sleep/resume | Start a timer, sleep past deadline, resume; verify one completion and no duplicate alert. Repeat with a reminder. | NOT EXECUTED; browser-restart reconciliation passed |
| NVDA | Navigate picker/Settings, edit tasks and notes, read timer/reminder state, open/dismiss menus and dialogs; confirm useful names, announcements and focus return. | NOT EXECUTED; keyboard focus and forced-colors emulation passed |
| Physical touch | Add, move/resize where supported, scroll, open menus, edit and dismiss overlays on actual touch hardware. | NOT EXECUTED; narrow layout checks passed |
| Upgrade path | In a stable unpacked directory, export, update, reload and confirm content/media persist. Test export/import migration to a distinct store/test installation separately. | NOT EXECUTED with external testers |
| Competing new-tab extension / policy | In a separate profile, identify which new-tab extension is active and confirm clear installation instructions. Test managed Edge only where available. | NOT EXECUTED |

For each check record tester, date, device, Windows/Edge version, exact reproduction and screenshot with personal content hidden. Send findings to aayush31500@outlook.com. Do not attach personal backups by default.
