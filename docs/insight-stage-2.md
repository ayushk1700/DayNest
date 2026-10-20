# Stage 2 — local idea canvas

Scratchpad now supports titled plain-text ideas, autosaving editors, draggable nodes, curved connections, port dragging, keyboard connection selection, connection removal, confirmed atomic idea deletion, search, panning, zoom and Fit ideas. List view and movement buttons provide alternatives to pointer gestures. Back/Escape use the existing focus-restoring overlay. The compact card previews the actual saved graph.

Changes use repository locking and validated actions, with stable IDs. Independent idea edits merge; stale edits preserve the newer saved version and retain the local draft. Closing an editor before autosave leaves its text in the existing draft-recovery panel, with a download option and a page-exit warning. Download unsaved drafts before leaving the browser page: they are not a durable backup.

History records individual graph entities, so undo preserves unrelated newer edits. Node deletion and its incident connections are one undoable transaction. A conflicting undo is rejected atomically. Existing schema 5 limits remain: 200 ideas, 400 connections, 120-character titles, 4,000-character bodies, bounded coordinates and a whole-document byte limit. Failed graph validation produces an editing error without replacing saved data.

Verification: 105 automated tests passed, including four new graph tests covering merge/conflicts, deletion/undo/redo, invalid edges and coordinates, full-size graphs and backup round trips. TypeScript, production build and extension package verification passed. Isolated Edge checks exercised editing, plain text, keyboard/list navigation, port dragging, zoom-correct node dragging, search, delete/undo, cross-tab merges and competing drafts, draft recovery, reload persistence, focus return, narrow/high-contrast layouts, a dark-theme 200-node/199-connection canvas and shared theme regressions.

Run `scripts/check-idea-canvas.mjs` with the same Playwright setup as other browser checks. Screenshots are under `docs/screenshots/idea-canvas-stage-2*.png`.

Wellbeing remains read-only; recording and duration statistics belong to Stage 3. No cloud service, new extension permission, publication or store submission was added. Physical touch and screen-reader checks remain manual. Reload persistence is automated; a full OS/browser-restart test specifically for graph editing remains manual.
