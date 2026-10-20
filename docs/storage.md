# Local dashboard data and concurrency

## Schema
`DashboardDocument` is a discriminated, strict TypeScript model with schemaVersion 6, an increasing safe-integer revision, theme, zoom, global appearance, dashboard background and widgets. Each widget has ID, type, title, position, size, stacking order, appearance, pin state, typed settings and discriminated content. The original twelve types cover Todo, Notes, Sticky, Pomodoro, Reminder, Clock, Habit, Image, Calendar, Weather, Date and Video. Schema 6 additionally supports Scratchpad and Wellbeing, with optional shared Wellbeing settings and bounded graph nodes/connections. Optional local Wellbeing recording begins only after explicit opt-in; schema 6 stores bounded actual timer intervals and completion events. Weather uses the configured Open-Meteo provider after a city is entered. Optional schema-4 fields cover type appearance, presets, layout assistance and widget presentation. Position, size, stacking order and canvas zoom are applied and persisted.

The boundary validator checks exact keys, types, finite ranges, unique widget/task IDs, content limits and supported category/settings combinations. It rejects unknown versions and does not coerce booleans or settings enums. Limits include 100 widgets, 500 tasks per Todo, 20,000 characters per task or sticky, 100,000 per Notes and 200 per title. Core content retains its 2,000,000-byte UTF-8 limit; the full schema-6 document, including appearance and other metadata, must also fit within 2,100,000 bytes. Stored input is untrusted; validated data is cloned before returning. User text is rendered through React text nodes or form values.

Migration is explicit: the supported v0 draft lacks revision. It becomes v1 with revision 0; v1 gains explicit timer/reminder state in v2; v2 gains independent appearance defaults and pin state in v3; v3 gains an empty dashboard background in v4. v4 gains support for validated graphs and shared wellbeing preferences in v5 without adding widgets or modifying existing content. v5 gains an optional validated Wellbeing ledger in v6, resetting the previously unavailable recording preference to off until a fresh explicit choice. Migration runs under the write lock and preserves supported existing content/layout/preferences. The v0 format was an internal draft. Future schema changes must add a migration and tests rather than weakening validation.

Image content contains a nullable asset ID and caption, never a binary or data URL. Image storage/upload uses separate IndexedDB records with validated formats/size limits and reference-aware cleanup. See local-widgets.md.

## Adapters
Production adapter: `chrome.storage.local`, using the storage permission. Background alarms additionally require alarms; notifications remain optional. Browser preview: localStorage. Both use `purrductivity.dashboard`, containing a JSON string. Browser preview storage is tied to the exact origin and is independent of extension storage.

Web Locks named `purrductivity-document` serialize this app's read/validate/update/write operations across pages of the same origin. Every writer must use the repository; the implemented background worker and any future import/reset operations follow the same protocol. There is no unlocked fallback: without Web Locks, the app reports a recoverable storage error instead of risking simultaneous writes. A current Edge version or localhost preview is required. Browser events do not provide compare-and-swap on their own.

The extension adapter subscribes to `chrome.storage.onChanged` for the local document key; the development adapter listens for `storage` events. Notifications queue behind writes, trigger a validated reread, and never persist an old in-memory snapshot. Sample seeding occurs inside the lock only when the key is absent. Persisted empty content and an empty dashboard stay empty.

## Conflict policy
Actions describe a field or task change and its expected previous value. The repository always reads the latest saved document under the lock, checks that precondition, applies the action and validates the whole result before incrementing revision and writing. This permits independent field edits to merge even when their source revisions differ. Two concurrent changes to the same field cannot silently replace one another. Task completion and task text can merge; deleting a task compares the entire expected task. Clearing tasks and deleting widgets compare the content/layout snapshot captured when confirmation opens, allowing selection-only stacking changes.

On text conflict, the latest saved document is published while the dirty local editor keeps its text. The user explicitly chooses the saved version, replaces it with their draft subject to a fresh check, or downloads their draft. If a widget/editor is removed while dirty, its text is retained in a memory-only page recovery panel. Leaving before autosave, failing to download an orphaned draft, or terminating the browser process can still lose unsaved text; this is not a crash journal.

## Failures and recovery
Loading, empty, saved, pending, failed-save and recovery states are displayed. A save failure retains the last saved document and local draft. Retry storage before resubmitting the draft. Unknown/malformed persisted data is not overwritten by automatic initialization.

Recovery can download the raw saved value as text. After confirmation, replacement with sample widgets first writes `{ capturedAt, raw }` to `purrductivity.recovery`, then writes the samples. It rechecks that the original raw value has not changed while recovery was open. Failure to write the recovery copy prevents replacement. Failure to write the samples leaves the old document and recovery copy intact. This is one most-recent recovery copy, not backup history; download important raw data first. Local backup retrieval via normal storage inspection is possible, while the full portable JSON backup/restore UI belongs to Stage 8.

No external requests, authentication, synchronization services, image binaries or notifications are involved in these stages. Local data is tied to the browser profile/extension installation; this is not an encrypted vault.

API references: [Extension Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), [Web Locks specification](https://www.w3.org/TR/web-locks/).

## Stages 5–7 updates
Historical schema-2 implementation note: v0 migrates to v1 and v1 migrates to v2 through strict validation. See timing.md for new timer/reminder fields and migration details. Layout actions and new local-widget actions remain conditional repository updates; selection-only stacking changes do not invalidate widget deletion content checks. All ten picker types are functional; see local-widgets.md for separate IndexedDB assets and conservative cleanup.

The original sections above describe the Stage 3–4 contracts; where they refer to Stage 5/6/7 work as future, the later stage reports and README describe the implemented behavior. Portable image backups and undo references still require Stage 8 work before cleanup can account for that history.



## Stage 8 update
Themes and zoom persist in the same document. Portable image-inclusive backup/import, previewed replacement, confirmed reset and Settings recovery are implemented. The current revision/content is rechecked before replacement and a recovery copy is written before the new document. History uses conditional field patches and remains in the current tab until reload/replacement. A shared Web Lock protects image bytes while any tab retains undo/redo history; cleanup skips deletion during that time. See backup-history.md for exact formats, limits and timer restoration behavior. Earlier references to Stage 8 as future work describe the earlier stage only.


## Card customization update
The earlier card-customization schema was 3; schema 4 introduced the additions described below (current schema: 6). Global appearance and per-widget appearance/pinned fields are validated and migrated from schemas 0/1/2. The v2 core remains bounded at 2 MB, with a 2.1 MB total limit allowing new appearance metadata. Pin/layout actions and history share the repository lock and conditional conflict checks. Portable backups keep these fields; schema-2 recovery copies remain readable. See card-customization.md.


## Schema 4: background and video
Historical schema-4 additions: A required background object stores only assetId (or null), fit (cover/contain) and integer dim 0-80. Schema-3 documents migrate under the repository lock with an independent empty background; content, dates, geometry, appearance and pins are preserved. Video cards use the existing asset-ID/caption/fit shape and strict metadata validation. IDs never contain URLs or binary data. The local IndexedDB images store is retained for compatibility and now also contains validated video blobs. Current, recovery, background and video references are included in safe cleanup; history retains the existing shared-lock protection. Portable backups keep their version-1 envelope and stage fresh IDs for all referenced media. See local-widgets.md and backup-history.md for size and import contracts.

