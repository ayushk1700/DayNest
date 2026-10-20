# Purrductivity reference specification

## Scope and evidence
Stage 1 establishes the build and a basic shell only. The five supplied screenshots were inspected in the conversation. Screenshot text is example content. No existing project or applicable AGENTS.md was found in the workspace or its ancestors.

Primary reference: Screenshot 2026-10-18 104615.png (1920 × 1080 full screen, including browser chrome and Windows taskbar). Target dashboard comparison viewport for Stage 2: 1920 × 925 CSS pixels; do not reproduce browser chrome. Settings and picker references are 104711 and 104737. The first two screenshots show an alternate arrangement, with image and reminder widgets, and notebook ruling. The second includes promotional framing that is not dashboard UI. No running-browser comparison was performed in Stage 1.

## Layout
Full-window pale-blue canvas with generous unused space. At the target viewport, approximately: Todo at (58, 84), 356 × 486; Notes at (490, 122), 469 × 375; Pomodoro at (995, 122), 319 × 263. A yellow sticky approximately 120 × 120 overlaps the lower right of Notes at (844, 415). Coordinates are provisional estimates relative to dashboard content, not exact measured CSS. Cards have thin cool borders, 20px rounded corners and soft downward shadows.

Keep workspace content in a dedicated canvas layer. Fixed toolbar, dialogs, picker and corner controls must be siblings outside future canvas zoom. At narrow widths use a readable flowing layout without persisting changes to desktop coordinates.

## Shared tokens
Initial estimates, to calibrate during Stage 2: canvas #eef8fa; cards #f8fcfd; text #142e37; muted #4d6470; teal #008bb1; soft teal #7abfd2; sticky #fff184; border #d6e0e3. Card radius 20px; controls 14px; 8/16/24/32px spacing. Shadow 0 6px 10px at 13% dark blue. Body 14px, card headings 18px, toolbar 18px, timer 44px bold. Reference font identity is unconfirmed; use a local system sans-serif stack until a bundled licensed font is selected. No font downloads. Consistent 18–20px outline icons; visible keyboard focus.

## Widgets
Todo: heading and completion summary, task field with teal square add button, checkbox rows, bottom-right Reset. Notes: editable-looking heading, notebook margin line, text area; alternate screenshot also has horizontal ruling. Pomodoro: heading, centered teal 25:00, daily work count, Start and reset controls, corner resize cue. Sticky: yellow rounded square, compact text, soft shadow; later implementation must retain readable minimum text size. Reminder: centered message, prominent passed state and date. Image: white photo frame with caption. Picker also lists Clock, Habit Tracker, Weather and Calendar; their detailed layouts are not shown.

## Toolbar and overlays
Top-right: Give Feedback, Reset Dashboard, round local avatar, settings gear. Bottom-left: undo and redo in rounded outlined squares. Bottom-right: teal circular plus, about 70px diameter, 40px from right/bottom.

Settings: centered approximately 640 × 558 panel over a dark translucent backdrop; title and top-right close. Six gradient swatches in order Warm Earth, Dark Mode, Ocean Breeze (selected outline/check), Forest Green, Sunset, Lavender. Zoom label, percentage (75% in reference), slider. Divider, Dashboard Data heading, paired Export JSON/Import JSON buttons and explanatory text. Sparkles are decorative evidence, not authorization for premium gating.

Add Widget: approximately 320px wide white panel anchored above the plus at right, no dark backdrop. Heading, outline icons, roomy vertical entries in order Clock, Habit Tracker, Pomodoro Timer, Reminder, Notes, Todo List, Weather, Calendar, Image, Sticky Note. Dividers around Calendar and Image; final yellow color indicator. Do not introduce premium restrictions.

## Confirmed appearance versus chosen behavior
Confirmed visually: listed controls, overlay placement, selected theme, timer readout, sample task, resize/grip cues, alternate card arrangement. Screenshots do not prove persistence, editing, drag behavior, reset semantics, timer reliability, shortcuts or menu dismissal. Those are product interactions required by later stage instructions. Use text-only content rendering, accessible labels, dialog focus containment/return, Escape dismissal and keyboard arrangement when those stages are implemented. Do not invent authentication, billing, account integration or cloud sync.

## Module boundaries and staged delivery
src/dashboard: canvas/layout. src/ui: tokens/shared accessible primitives. src/widgets: widget components. src/state: typed model, validated actions and migrations (Stage 3). src/persistence: storage adapters and conflicts (Stage 3), separate image assets (Stage 7). src/extension: background alarms (Stage 6). tests: meaningful validation/conflict/time/backup tests as behavior arrives. Stage 1 performs no content writes. Unfinished UI must be labeled or omitted; functional-looking widget controls are deferred to Stage 2.

## Stage 2 implementation status
Static desktop and responsive layouts, Settings and Add Widget overlays now exist. Captured and inspected at 1920 × 925 and 390 × 844; see stage-2-verification.md. Local cat avatar, preview explanations and explicit close controls are intentional additions. Only overlay interactions are enabled; widgets, themes, zoom and backup remain staged. Components and shared CSS tokens are ready for the Stage 3 state model.

## Stages 3 and 4 implementation status
The static core cards now use validated persisted data. Todo, Notes and Sticky content and titles are editable, with keyboard controls, autosave, conditional cross-tab updates, explicit destructive confirmation and local recovery states. Sticky text is at least 12px and its default card is 150 × 150 for readability. Theme, zoom and layout data are modeled and retained; their controls remain staged. Image content has only asset references. See storage.md and stages-3-4-verification.md for current contracts and evidence.

## Stages 5–7 implementation status
Persisted header movement, resizing, stacking order, keyboard/numeric arrangement and zoom are implemented. Fixed controls and all dialogs/picker remain outside the transformed canvas. Narrow views retain the saved desktop geometry. Timer state/settings and reminders are functional through an alarm-backed module worker. All picker entries now create local widgets; Clock/Habit/Image/Calendar are complete and Weather explicitly requires provider setup. New layouts follow the reference palette/card treatment; they are product decisions where screenshots showed only names. See timing.md, local-widgets.md and the Stage 5–7 verification reports.


## Stages 8�9 and icon refinement
All six themes, per-tab undo/redo, portable image backups, import previews, confirmed reset and recovery are implemented. Widget actions now sit in a compact three-dot disclosure: hover, click, Enter or Arrow Down opens the floating Layout/Rename/Delete menu; Escape and outside clicks close it. Hover/focus also reveals the dots, and touch keeps them visible. Flaticon Regular Rounded glyphs are bundled locally with attribution. Additional notification/recovery sections make Settings taller than the reference, with scrolling within the viewport. Audit evidence and remaining manual checks are recorded in release-checklist.md.
