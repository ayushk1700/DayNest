# Timers, reminders and alarms

Schema v2 adds explicit Pomodoro status, session ID, deadline, paused remainder, delivery status and timestamped work completions. Reminders are local entries with ID, generation/event ID, message, due epoch timestamp, timezone and delivery status. Legacy v1 dormant timers become idle; undated legacy completion IDs are retained with epoch timestamps so they are not fabricated into today's count. v0 migrates through v1. Existing content, geometry and preferences are retained.

A running timer's display is deadline minus current time; ticks are never persisted. Pause stores the remaining milliseconds, resume constructs a new deadline. Reconciliation records an expired work session at its original deadline exactly once by session ID. Breaks do not add work records. Today's count uses the device's current local calendar date. Reset preserves completion history. Work/break durations apply to new sessions; running/paused sessions must be reset before changing settings.

The module worker registers listeners synchronously and reconciles on startup/install, document changes and one nearest-deadline alarm. Web Locks serialize its repository writes with dashboard tabs. It schedules a single alarm regardless of the number of reminders, avoiding one-alarm-per-reminder limits. First install with no saved dashboard does not seed or report an error from the worker; the dashboard seeds its sample once.

Pending notification events are claimed under the same storage lock before calling the OS API. Stable IDs and a persisted claimed state prevent repeated callbacks/restarts from displaying the same event twice. This is at-most-once delivery, not a transactional guarantee with the OS: a crash after claim can lose the popup. There is no automatic retry of an ambiguous claim. Notification failure or denied/missing permission never removes a completion record. Enabling notifications does not replay old unavailable alerts.

Reminders capture the device timezone at save time and store a real timestamp. Display uses that saved timezone. The datetime-local editor uses the current device timezone; editing an entry after travel updates its timezone accordingly. Invalid daylight-saving gap times are rejected by a round-trip check; ambiguous repeated-hour times use the browser's first interpretation. Passed reminders can intentionally be created and are immediately reconciled.

Only storage and alarms are required. The notifications permission is optional and requested only from the explicit Settings button. No host permission, remote service or API key is used. Alarms can be delayed after sleep and do not guarantee alerts while Edge or the computer is closed. Missed state is reconciled at startup. Ordinary preview has no background alarms or OS notifications and reconciles when a dashboard is open/returns.

References: [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms), [Notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications), [Optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).

## Optional Wellbeing recording (schema 6)

After explicit opt-in, a separate shared ledger seals actual running segments on pause/reset/deletion and at a due timer deadline. Active markers use the same document lock as timer actions and background reconciliation; stable completion IDs prevent replay. Recording pause/resume omits gaps, and imports pause recording. Live display intervals are read-only. See insight-stage-3.md and wellbeing-privacy-support.md.
