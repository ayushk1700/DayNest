# YouTube Music widget

Add **Music** from the dashboard’s **Add Widget** picker to create a movable and resizable card. Its round arrow opens `immersive.html` in a separate extension tab. Both views request the same live state from the extension service worker.

The extension currently uses no documented YouTube Music playback API. A locally bundled, isolated content script reads visible player-bar text and artwork and clicks the visible play/pause, previous, and next buttons. If a YouTube Music tab was already open when the extension was installed or updated, the service worker loads that same bundled connector into the matching tab on demand. It does not inject code into the page's own JavaScript world. Those page selectors are not a stable API; a YouTube Music redesign can break metadata or controls until the selectors are updated.

Only play/pause, previous, and next are implemented. Shuffle, repeat, seeking, volume, and a progress timeline are omitted because this integration does not verify their controls and timing reliably. Track state is read when either extension page refreshes its view; it is not stored.

The manifest grants the exact `https://music.youtube.com/*` host so the static content script can run there and the service worker can query matching tabs. The `scripting` permission is used only to load the packaged connector into a matching tab that was already open. Recent-track history (up to 12 entries) and equalizer preferences are stored locally in the extension profile. The equalizer requests a tab audio stream only after the user starts it from the extension popup; an offscreen document processes the audio locally, without recording or sending it. There is no broad `tabs` permission, backend, or remote executable code. When multiple matching tabs exist, the service worker keeps its selected tab while it remains available; after a worker restart it prefers the active YouTube Music tab, then the most recently accessed matching tab.

## Manual browser check

1. Build the extension and reload it from Edge's extensions page. Approve the added `scripting` permission if Edge asks.
2. Open a new tab and use **Add Widget → Music** to place the card.
3. Start a track in YouTube Music, including in a tab that was already open before the extension reload. Check for title/artwork and exercise play/pause and next/previous.
4. Open Immersive and confirm the same state appears, then return to the dashboard with the header arrow.
5. Close the YouTube Music tab and confirm the card returns to its disconnected state.
6. With multiple YouTube Music tabs open, confirm the selected tab follows the policy above.
