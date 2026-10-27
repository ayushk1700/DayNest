import type { MusicAction, MusicState } from './types';
import { isMusicEqPreset, type MusicEqPreset } from './equalizer';

interface MusicChrome {
  runtime?: {
    id?: string;
    sendMessage(message: unknown): Promise<unknown>;
    getURL(path: string): string;
  };
}
const chromeApi = (globalThis as typeof globalThis & { chrome?: MusicChrome }).chrome;
export const isExtensionPage = Boolean(chromeApi?.runtime?.id);
export async function readMusicState(): Promise<MusicState> {
  if (!chromeApi?.runtime?.id) return { status: 'disconnected', track: null, isPlaying: false };
  return (await chromeApi.runtime.sendMessage({ type: 'music:get' })) as MusicState;
}
export async function controlMusic(action: MusicAction): Promise<boolean> {
  if (!chromeApi?.runtime?.id) return false;
  const result = (await chromeApi.runtime.sendMessage({ type: 'music:control', action })) as {
    ok?: boolean;
  };
  return result?.ok === true;
}
export async function playMusicTrack(videoId: string): Promise<boolean> {
  if (!chromeApi?.runtime?.id || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return false;
  const result = (await chromeApi.runtime.sendMessage({ type: 'music:playTrack', videoId })) as {
    ok?: boolean;
  };
  return result?.ok === true;
}
export async function setMusicEqPreset(
  preset: MusicEqPreset,
): Promise<{ active: boolean; error?: string }> {
  if (!chromeApi?.runtime?.id) return { active: false };
  const result = (await chromeApi.runtime.sendMessage({ type: 'music:eq:set', preset })) as {
    ok?: boolean;
    active?: boolean;
    error?: string;
  };
  return { active: result?.active === true, error: result?.error };
}
export async function getMusicEqStatus(): Promise<{ active: boolean; spatial: boolean }> {
  if (!chromeApi?.runtime?.id) return { active: false, spatial: false };
  const result = (await chromeApi.runtime.sendMessage({ type: 'music:eq:status' })) as {
    active?: boolean;
    spatial?: boolean;
  };
  return { active: result?.active === true, spatial: result?.spatial === true };
}
const SPATIAL_AUDIO_KEY = 'purrductivity.music.spatial';
export function loadMusicSpatial(): boolean {
  try {
    return localStorage.getItem(SPATIAL_AUDIO_KEY) === 'true';
  } catch {
    return false;
  }
}
export async function setMusicSpatial(
  enabled: boolean,
): Promise<{ active: boolean; spatial: boolean }> {
  try {
    localStorage.setItem(SPATIAL_AUDIO_KEY, String(enabled));
  } catch {
    /* Keep the in-memory selection. */
  }
  if (!chromeApi?.runtime?.id) return { active: false, spatial: enabled };
  const result = (await chromeApi.runtime.sendMessage({ type: 'music:eq:spatial', enabled })) as {
    active?: boolean;
    spatial?: boolean;
  };
  return { active: result?.active === true, spatial: enabled };
}
export async function startMusicEq(
  streamId: string,
  preset: MusicEqPreset,
  spatial = loadMusicSpatial(),
): Promise<{ active: boolean; spatial?: boolean; error?: string }> {
  if (!chromeApi?.runtime?.id)
    return { active: false, error: 'Equalizer is available in the installed extension.' };
  const result = (await chromeApi.runtime.sendMessage({
    type: 'music:eq:start',
    streamId,
    preset,
    spatial,
  })) as { ok?: boolean; active?: boolean; spatial?: boolean; error?: string };
  return { active: result?.active === true, spatial: result?.spatial, error: result?.error };
}
export async function stopMusicEq(): Promise<void> {
  if (chromeApi?.runtime?.id) await chromeApi.runtime.sendMessage({ type: 'music:eq:stop' });
}
export function loadMusicEqPreset(): MusicEqPreset {
  try {
    const value = localStorage.getItem('purrductivity.music.eq.preset');
    return isMusicEqPreset(value) ? value : 'studio';
  } catch {
    return 'studio';
  }
}
export function openImmersive(): void {
  if (chromeApi?.runtime?.id)
    window.open(chromeApi.runtime.getURL('immersive.html'), '_blank', 'noopener');
}
export function goDashboard(): void {
  if (chromeApi?.runtime?.id) window.location.assign(chromeApi.runtime.getURL('index.html'));
  else window.close();
}
export function openYouTubeMusic(): void {
  window.open('https://music.youtube.com/', '_blank', 'noopener');
}
