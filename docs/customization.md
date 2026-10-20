# Widget customization

Open Settings → Card customization → **Advanced Customization** to enable the advanced editor and workspace tools for the current session. Reloading returns to basic controls. Closing advanced tools hides selection, copy/paste, presets, presentation controls, grid and guides; it does not remove saved styles or layouts. Basic color, border, corner and shadow controls remain available.

## Inheritance and editing

The shared resolver applies Theme/skin → Global defaults → Widget-type defaults → Individual widget. Missing or null properties inherit; resolved values are never copied back to storage merely by rendering. The original five null inheritance markers remain compatible with older documents. New properties are optional. `typeAppearance` is optional and empty type entries are removed.

The advanced editor groups Text, Surface, Spacing and Header, shows the source of each value, and renders an inert live widget preview. Use inherited value, a section reset, and clear-all modify only the draft. Save commits one appearance action; Cancel and dismiss leave saved appearance unchanged. Skin and functional settings remain in the existing widget controls, outside appearance editing. Titles can be hidden without removing the focusable movement handle or card menu.

Font choices are local system stacks with offline fallbacks. Glass and opacity use local CSS, and choose sufficient opacity for readable text. Reduced-transparency preferences and browsers without backdrop filtering get an opaque surface. Paper/photo/clock skins keep their existing styling unless an inherited or individual property explicitly overrides it.

## Reusable appearance

The preset library offers three curated, theme-compatible presets plus up to 100 named user presets. Preview a preset at the selected global, type or individual scope, or in the selected-widget editor; Save appearance applies an independent copy. Library create/rename/update/delete buttons are separate explicit undoable actions. Presets accept appearance only and never contain content, layout, media or functional settings. Updating/deleting a preset leaves previously applied styles unchanged.

Card-menu Copy appearance captures the effective supported appearance, including computed theme/skin defaults, into an in-memory clipboard for this tab. Paste applies a snapshot as individual overrides. This clipboard is not the operating system clipboard and is not saved in backups.

Selection mode provides checkboxes, outlines and a selected count. Use Space on a focused checkbox to select an overlapped card by keyboard. The shared appearance editor displays Mixed values, and saves only properties edited/reset by the user. Conditional batch writes compare only touched properties and preserve unrelated concurrent changes. One batch is one undoable action.

## Layout and presentation

Layout assistance in Settings has an optional 4–128 canvas-pixel grid and movement guides. Dragging and keyboard nudges use canvas coordinates, so snapping is independent of zoom. Guides compare edge and center anchors within six screen pixels. Layout numeric fields remain exact; grid snapping applies to direct movement/resize gestures and keyboard nudges.

Selection tools align left/center/right/top/middle/bottom, or distribute three or more widgets with equal gaps while keeping endpoints fixed. Operations are unavailable when the selection is too small, contains pins, or the window uses the narrow flowing layout. A distribution without enough space reports that more room is needed. Pinned cards never move. Geometry changes are conditional, atomic and undoable.

Full, compact and content-only modes are in the advanced card menu. Every mode retains a focusable movement handle and reachable menu. Collapse changes the displayed height to 54px while retaining the original stored expanded width/height; expanding restores those dimensions. Hidden content remains mounted so drafts and timers are retained. Narrow layout continues to use the existing flow without storing a separate layout.

## Data compatibility and checks

Optional v4 fields (`typeAppearance`, `presets`, `layoutAssistance`, per-widget `presentation` and extended appearance properties) are strictly validated before writes/import. Old schema migrations and old portable backups remain accepted without changing their content, skins, media references, layouts or existing overrides. New fields flow through the existing repository, backup serializer and history patches; no second storage path exists.

Focused tests cover each appearance property's inheritance and reset, scope isolation, single-action history, old imports, persistence, contrast, preset snapshots and CRUD, touched-property batches, copy/paste data preservation, alignment/distribution, pins, zoom-aware snapping/guides, and collapse restoration. Run `typecheck`, `test` and `build` from package.json. System font availability varies by operating system; the named fallback is used offline.

Workspace profiles, scheduled themes and separate responsive-layout storage are outside these stages.
