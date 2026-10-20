# DayNest recommended themes

Settings → Recommended full themes now follows the supplied reference: Warm Earth, Midnight, Ocean Breeze, Forest Green, Soft Sunset, Lavender, Paper & Ink, Sakura, Matcha, Nordic Snow, Vintage Sepia and Peach Cream. Twelve wide gradient swatches appear in that order, with a selected outline and check badge, in a three-column grid that fits desktop and narrow Settings panels.

Selecting a swatch saves and applies canvas, surface, text, secondary text, accent and border tokens. Midnight also supplies dark control styling and readable warning colors. Explicit card overrides and dashboard background images remain user-controlled. The selection supports Undo/Redo, reload and portable backup/recovery.

The existing schema remains 4. Dark Mode and Sunset are retained as valid legacy names in saved data, history and backups; the UI highlights Midnight and Soft Sunset respectively. Choosing the recommended name writes it normally. No existing widget content or layout is rewritten by displaying the new theme options. Unknown theme names still fail validation.

Reference palette previews live in src/ui/themePreviews.ts, applied colors in src/ui/tokens.css, and canonical names/legacy aliases in src/state/model.ts. Theme selection uses the existing conditional action, so a stale tab cannot overwrite a newer selection silently.

The integrity suite covers every recommended theme's saved/portable round-trip, invalid and stale selections, legacy alias backups and restoration through Undo. Edge checks cover all twelve themes' text, secondary text, primary label and focus contrast; selected names/order; reload; light/dark/narrow presentation; and old-name selection markers. The Vintage Sepia secondary color was darkened after the contrast check caught a ratio below 4.5:1.

Inspected previews are in docs/screenshots/daynest-themes-light.png, daynest-themes-midnight.png and daynest-themes-narrow.png. The sample dashboard capture is daynest-matcha-dashboard.png. They use an isolated browser profile and do not replace user settings.
