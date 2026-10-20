# Card appearance and pinning

Open **Settings → Card customization**. In **Customize scope**, choose **Global defaults · all widget types**, or select a specific widget. Uncheck **Use inherited value** to enable an individual color, set border/background colors, border width, corners and shadow, inspect the preview, then choose **Save appearance**. Advanced Customization adds text, surface, header and widget-type controls. Native color inputs are local; no external service is involved.

Each property inherits independently. A card with a custom border can still inherit the global background and shadow. **Clear all overrides** removes the draft's visible basic overrides; in Advanced Customization it clears all supported appearance overrides. Saving at individual scope then inherits the type/global style; clearing global overrides returns to theme defaults without deleting individual overrides. A null color means inherited, not a transparent/invisible card. Appearance drafts apply only when saved; Save or Cancel before switching scope.

The three-dot card menu also offers **Customize**. It opens the same editor for that card. The floating menu is rendered outside the zoomed/scrolling card, stays readable at different canvas zooms, clamps to the viewport and supports hover, click, touch, Enter, Arrow Down, Tab and Escape. Only one menu opens at a time. Menu actions use the global theme so arbitrary card colors cannot make the action list unreadable.

Custom backgrounds select readable text, muted text and accents automatically. The foreground choice is checked against the background at 4.5:1, including the primary button label. Native control color scheme follows the chosen background. This preserves text readability; a user-selected border can still be deliberately low contrast.

## Pin in place

Use **Pin in place** in the card menu, or **Pin position and size** in Customize/Settings after selecting an individual widget. Pin changes save immediately and are separate from unsaved appearance drafts; Cancel appearance does not undo a saved pin. Translucent washi tape with torn edges appears across the upper-left corner. It is decorative and never intercepts input. A brief press animation and subtle highlight respect reduced-motion preferences. Pinning locks the card's saved canvas position and dimensions: pointer moves, keyboard moves, numeric layout edits, resizing, Arrange Widgets and Recover widgets all respect the lock. Editing content and appearance still works.

Unpin from the menu or Settings. Settings can select any card, including one outside the visible canvas, so an off-screen pin remains recoverable: unpin there, then use Recover widgets. Pinning is relative to the desktop workspace, not the browser window. Narrow screens still use the readable flowing layout and retain the locked desktop coordinates.

Pinning and appearance saves participate in Undo/Redo. A new pin in another tab prevents an older geometry undo from moving that card. Deleting a pinned card is still allowed after confirmation, and undo restores its pin and appearance.

## Storage and backup

Schema **3** introduced global `appearance`, and each widget adds `appearance` and `pinned`. Existing v0/v1/v2 data migrates through the earlier validators, then receives independent empty appearance defaults and `pinned: false`; content, settings, geometry, theme and zoom are retained. These fields retain exact validation in schema 4, including, six-digit hex colors, bounded style enums and true booleans. CSS strings/URLs and unknown fields are rejected.

The portable backup envelope remains version 1 and now includes the schema-4 dashboard. Schema 4 additionally stores the global dashboard background and validates Video cards; schema-3 appearance/pin fields migrate unchanged. Appearance and pins round-trip alongside content, photo/video/background references and bytes. Known older backups migrate. Reset clears background, global/per-card styles and pins and saves the previous dashboard first. The core dashboard limit remains 2 MB; up to 2.1 MB total allows the added metadata, preserving previously valid dashboards near the old boundary.

Dashboard background imagery has its own global Settings section: choose an image, fit and softness, then Save background. It does not replace individual card colors. Content scrollbars use small rounded thumbs on hover/focus; canvas scrollbars are hidden while wheel, keyboard and touch scrolling remain available.

`tests/appearance.test.mjs` covers migration, validation/injection rejection, inheritance/conflicts, pin/arrange/recover/history behavior, backup preservation and foreground contrast over 216 RGB samples. `scripts/check-customization.mjs` exercises browser styling, tape marker, locked pointer/keyboard geometry, unpin/undo/redo, style backup/reload and narrow menus/Settings access.
