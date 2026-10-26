# DayNest PDF Studio

## Design direction

**A quiet reading desk:** a dedicated, full-screen workspace reached from a small **PDF Studio** action in the DayNest toolbar. Keep the familiar DayNest surfaces, spacing, rounded controls and theme colors, with a warm paper canvas for the document itself.

- **Left rail:** page thumbnails and page organization.
- **Center:** readable PDF page, reading/selection/markup tools, page navigation and zoom.
- **Right inspector:** contextual markup, comments, page actions and document details.
- **Top actions:** open a local PDF, find text, and export a changed copy.
- **Privacy cue:** explain that the PDF is processed locally; never upload document contents.

PDF Studio is implemented as a local PDF workspace. Its compact header uses a slim file-name and action row above a separate document-control row, following the supplied design. The page rail and contextual tools remain available around the reader.

## Recommended implementation

Build PDF Studio as its own packaged extension page (`pdf.html`) rather than adding a large document editor inside the new-tab dashboard. This keeps the existing dashboard focused and gives a large document a stable, full-screen workspace. The current scaffold adds the page entry and a toolbar shortcut.

Use **PDF.js** for local PDF parsing, page rendering, text selection, text extraction, and thumbnails. Its display API renders pages to a canvas and provides page/text access; ship the worker and required font/CMap assets inside the extension package. Use **pdf-lib** for basic document writing such as inserting/reordering/removing pages, metadata, and drawing new text, images or annotation marks into exported copies. PDF.js documents the page rendering and worker model in its [examples](https://mozilla.github.io/pdf.js/examples/) and [getting started guide](https://mozilla.github.io/pdf.js/getting_started/); pdf-lib documents page operations and saving bytes in its [PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument).

The existing Manifest V3 policy allows packaged scripts and sets `object-src 'none'`. Keep all PDF code and worker files local, render pages with canvas, and avoid remote scripts, embedded `<object>` viewers, or relaxing the extension policy. Chrome's [extension CSP documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) describes the local-resource rules.

## Implemented features

- Open a PDF from the file picker or drop it into the window. Selecting multiple PDFs creates a merged working copy; an open PDF can also be merged with more files.
- Render pages and lazy page thumbnails on-device with PDF.js. Use text selection, search, page navigation, zoom, fit-page and fit-width controls, and page rotation.
- Reorder pages by dragging thumbnails or using page actions, remove pages from the export, and download the current page separately.
- Add highlights, notes and freehand ink in PDF coordinates. Review and remove marks, then undo or redo markup changes.
- Export an edited copy without overwriting the source. Page changes that may affect forms or signatures ask for confirmation.
- Open password-protected PDFs for viewing, show loading progress and errors, support narrow layouts, and provide keyboard shortcuts for search, undo/redo and page navigation.
- Collapse the page rail and workspace inspector independently to give the reader more room. Scroll inside the reader to see the full page.
- Keep PDF bytes and edits in memory in the current tab. Bundle PDF.js workers, fonts and CMaps with the extension; no PDF is uploaded.

## Local data and limits

- The selected `File` and edit state stay in memory for the active session. Closing the PDF or tab clears them.
- Export creates a new PDF so the original remains intact. Highlights, notes and ink are flattened into the copy.
- This is an annotation and page-organization editor; it does not replace arbitrary existing text, fill every form type, preserve digital signatures after edits, or perform OCR.
- Password-protected PDFs can be viewed, but pdf-lib cannot export the encrypted source. Save an unlocked copy first to edit or merge it.
- Structural edits can affect interactive forms, links, signatures or other embedded features; the app warns before exporting a reordered or shortened document.

## Design acceptance criteria

- The page feels like DayNest and uses its existing theme tokens outside the printed page.
- Page reading remains the visual focus; editing options stay in a contextual panel.
- The file-name row stays slim, document controls remain grouped below it, and both side panels collapse independently.
- Long pages scroll inside the reader without moving or clipping the rest of the workspace.
- The document page keeps its paper-like contrast in both light and dark DayNest themes.
- Controls act on the loaded PDF and make clear that the original file remains unchanged.
