# Themes, history, backup and reset

Twelve themes are saved in the dashboard document. Shared tokens style the canvas, cards, text, controls, borders, focus and error states. Ocean Breeze remains the default. The yellow sticky keeps dark text in every theme.

## History

Undo/redo retains up to 50 user actions in the current tab, with an additional approximate 8 MB metadata bound. Reloading or replacing the dashboard clears that tab's history. Consecutive typing saves in the same field within 1.2 seconds are grouped; one drag/resize gesture creates one entry. A new edit clears redo. Selection/bringing a card forward, timer commands, live ticks, completion records and notification deliveries are excluded. Timer duration settings are undoable.

Use the bottom-left arrows, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y. Text inputs, textareas, selects and contenteditable elements retain their native shortcuts. Save or resolve unsaved drafts before using dashboard history or replacement.

History uses conditional field patches against the latest saved document under the same Web Lock used by other tabs and the worker. Unrelated fields are retained; a changed target field blocks undo instead of replacing newer work. Whole-widget deletion/restoration is conditional on the widget's content, settings and layout. Reminder delivery stays owned by the worker. Reinserted running timers pause; past reminders do not replay old notifications.

Any tab retaining history holds a shared `purrductivity-history-assets` Web Lock. Image cleanup conservatively skips deletion while that lock exists. Closing/reloading the tab or replacing its dashboard releases the lock. This protects old image bytes needed by undo/redo across tabs, without embedding binary data in history.

## Portable JSON format

The version-1 envelope has exactly `format`, `version`, `exportedAt`, `dashboard` and `images` fields. `format` is `purrductivity-backup`. The dashboard keeps its schema version (currently 6), content, preferences, layout and asset IDs. Each referenced photo, video or dashboard image appears once as `{ id, type, width, height, data }`, with `data` containing plain base64 bytes. PNG/JPEG/WebP images and MP4/WebM videos are allowed. The legacy envelope field remains named images, and up to 101 unique references cover 100 widgets plus one global background. Maximum backup size is 50 MiB; images retain the 5 MiB limit, and videos are limited to 25 MiB and five minutes with supported codecs. Export reports an error rather than omitting oversized or missing media.

Import validates the file extension/MIME, size, JSON shape, known versions/migrations, document limits, unique/matching image IDs, base64, signatures, actual image/video metadata decoding and dimensions, video duration, and role/type consistency (background/photo references cannot point to video bytes) before showing the preview. Bare known dashboard schemas are also accepted if they have no image references. A document-only file cannot recreate missing image bytes.

The preview lists widget titles/types, theme, zoom and media count. Cancel has no document or image writes. Confirmation stages media with fresh asset IDs, so the current/recovery dashboard's image records are never overwritten. Replacement rechecks the exact saved document from the preview, saves a recovery copy, then writes the validated replacement with an increased revision. Changed/stale previews, invalid data, storage failures and failed image staging retain the current dashboard. Failed staging/replacement can leave unreferenced images protected for 24 hours, then eligible for cleanup.

Imported/restored running timers pause at their remaining time (at least 1 ms); past reminders remain visible with delivery unavailable. Resume or create a new future reminder explicitly when desired. This avoids replaying stale alerts from an older backup.

## Reset and recovery

Reset explains that the dashboard background, every widget and its content, positions, timers, reminders, habits, events, theme and zoom will be replaced by the sample dashboard. It requires **Back up and reset**. Browser notification permission is retained. A failed recovery-copy write prevents replacement. A failed dashboard write retains the previous document.

Settings → **Restore previous dashboard** previews the single most recent recovery copy. Current and recovery image references are protected by cleanup. Restoring saves the current dashboard as the new recovery copy before replacement. This is one recovery slot; export important dashboards to independent files. Invalid storage recovery still offers raw-data download and does not silently replace corrupt data.

## Icon assets

Flaticon Uicons 3.3.1 Regular Rounded is bundled as a local WOFF2 font with mappings for 53 used glyphs. No CDN request occurs at runtime. The license is included in `public/licenses/flaticon.txt` and built output, with the required Flaticon attribution link in Settings. `scripts/vendor-uicons.mjs` is an optional build-time acquisition script; normal builds use the committed local assets. Card actions are disclosed by a three-dot hover/click/keyboard button; action icons also have names and tooltips.


Card customization update: appearance defaults/overrides and pins are included in schema 3 and history. Old dashboards and backups migrate without losing content/layout. Pinning blocks geometry changes, including older geometry history while the card is pinned. See card-customization.md.


Schema 4 update: the global background is a conditional history field, with asset ID, cover/contain fit and softness. Video references and the background participate in current/recovery/history asset protection. Import remaps their IDs as well as image-card IDs. Existing schema-3 documents migrate with an empty background and keep all prior widgets, styles and pins. Binary bytes remain outside the document/history; live weather responses are not included in backups.

## Optional Wellbeing history

Recording settings, clear and automatic timer records stay outside undo. Wellbeing card deletion keeps shared history. Export snapshots running progress into a copy; import/restore pauses timers and recording, removes active markers and never replays historical events. See wellbeing-privacy-support.md for retention, local deletion and backup copies.
