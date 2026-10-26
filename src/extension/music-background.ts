import type { MusicAction, MusicState } from '../music/types';
interface ChromeMusicApi {
  runtime: { id?: string; getURL(path: string): string; getContexts(query: { contextTypes: string[]; documentUrls: string[] }): Promise<unknown[]>; sendMessage(message: unknown): Promise<unknown>; onMessage: { addListener(listener: (message: unknown, sender: { id?: string; url?: string; tab?: { id?: number; url?: string } }, sendResponse: (response: unknown) => void) => boolean | void): void } };
  tabs: { query(query: { url?: string[]; active?: boolean; lastFocusedWindow?: boolean }): Promise<{ id?: number; url?: string; active?: boolean; lastAccessed?: number }[]>; sendMessage(tabId: number, message: unknown): Promise<unknown>; }
  scripting: { executeScript(target: { target: { tabId: number }; files: string[] }): Promise<unknown> };
  offscreen: { createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void> };
}
const api = (globalThis as typeof globalThis & { chrome?: ChromeMusicApi }).chrome;
if (api?.runtime?.id) {
  let selectedTabId: number | undefined;
  const findTab = async () => {
    const tabs = await api.tabs.query({ url: ['https://music.youtube.com/*'] });
    const valid = tabs.filter(tab => Number.isInteger(tab.id));
    const selected = valid.find(tab => tab.id === selectedTabId) ?? valid.sort((a, b) => Number(b.active) - Number(a.active) || Number(b.lastAccessed ?? 0) - Number(a.lastAccessed ?? 0))[0];
    selectedTabId = selected?.id;
    return selected;
  };
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id) return;
    if (!message || typeof message !== 'object') return;
    const request = message as { type?: string; action?: MusicAction; videoId?: string; streamId?: string; preset?: string; spatial?: boolean; enabled?: boolean };
    if ((message as { target?: string }).target === 'equalizer-offscreen') return;
    if (request.type?.startsWith('music:eq:')) {
      if ((request.type === 'music:eq:start' || request.type === 'music:eq:stop') && sender.tab?.id === undefined && !sender.url?.endsWith('/equalizer.html')) {
        respond({ ok: false, error: 'Open the equalizer from the toolbar to control tab audio.' });
        return;
      }
      void (async () => {
        if (request.type === 'music:eq:start') {
          const [activeTab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
          if (!activeTab?.id || !activeTab.url?.startsWith('https://music.youtube.com/') || !request.streamId) return { ok: false, error: 'Select the YouTube Music tab and try again.' };
          const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL('equalizer-offscreen.html')] });
          if (!contexts.length) await api.offscreen.createDocument({ url: 'equalizer-offscreen.html', reasons: ['USER_MEDIA'], justification: 'Apply the selected equalizer preset to YouTube Music tab audio.' });
          return await api.runtime.sendMessage({ target: 'equalizer-offscreen', type: request.type, streamId: request.streamId, preset: request.preset, spatial: request.spatial });
        }
        const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL('equalizer-offscreen.html')] });
        if (!contexts.length) return { ok: true, active: false };
        return await api.runtime.sendMessage({ target: 'equalizer-offscreen', type: request.type, preset: request.preset, enabled: request.enabled });
      })().then(respond, error => respond({ ok: false, error: error instanceof Error ? error.message : 'Equalizer unavailable.' }));
      return true;
    }
    if (request.type === 'music:get') {
      void (async () => {
        const tab = await findTab();
        if (!tab?.id) return { status: 'disconnected', track: null, isPlaying: false } satisfies MusicState;
        try {
          let state: MusicState;
          try { state = await api.tabs.sendMessage(tab.id, { type: 'music:read' }) as MusicState; }
          catch {
            // Static content scripts are not retroactively added to tabs that were already open during install/update.
            await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['music-content.js'] });
            state = await api.tabs.sendMessage(tab.id, { type: 'music:read' }) as MusicState;
          }
          return { ...state, selectedTabId: tab.id };
        } catch { return { status: 'connecting', track: null, isPlaying: false, selectedTabId: tab.id } satisfies MusicState; }
      })().then(respond, () => respond({ status: 'error', track: null, isPlaying: false }));
      return true;
    }
    if (request.type === 'music:control' && ['toggle', 'previous', 'next'].includes(String(request.action))) {
      void findTab().then(async tab => {
        if (!tab?.id) return { ok: false };
        try { return await api.tabs.sendMessage(tab.id, { type: 'music:control', action: request.action }); }
        catch {
          await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['music-content.js'] });
          return await api.tabs.sendMessage(tab.id, { type: 'music:control', action: request.action });
        }
      }).then(respond, () => respond({ ok: false }));
      return true;
    }
    if (request.type === 'music:playTrack' && /^[a-zA-Z0-9_-]{6,}$/.test(request.videoId || '')) {
      void findTab().then(async tab => {
        if (!tab?.id) return { ok: false };
        const message = { type: 'music:playTrack', videoId: request.videoId };
        try { return await api.tabs.sendMessage(tab.id, message); }
        catch {
          await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['music-content.js'] });
          return await api.tabs.sendMessage(tab.id, message);
        }
      }).then(respond, () => respond({ ok: false }));
      return true;
    }
  });
}
