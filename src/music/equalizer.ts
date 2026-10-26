export const MUSIC_EQ_PRESETS = [
  { id: 'studio', label: 'Balanced', bands: [0, 0, 0, 0, 0] },
  { id: 'warm-bass', label: 'Warm', bands: [4, 2, 0, 0, 1] },
  { id: 'vocal', label: 'Vocal', bands: [-2, 0, 3, 3, 1] },
  { id: 'night-drive', label: 'Night drive', bands: [4, 1, 0, 2, 4] },
  { id: 'acoustic', label: 'Acoustic air', bands: [2, 1, 1, 2, 2] },
  { id: 'classical', label: 'Orchestra', bands: [2, -1, 0, 1, 2] },
  { id: 'my-preset', label: 'My Preset', bands: [2, 1, 0, 1, 2] }
] as const;
export type MusicEqPreset = typeof MUSIC_EQ_PRESETS[number]['id'];
export function isMusicEqPreset(value: unknown): value is MusicEqPreset {
  return MUSIC_EQ_PRESETS.some(preset => preset.id === value);
}
export function musicEqPreset(value: MusicEqPreset) {
  return MUSIC_EQ_PRESETS.find(preset => preset.id === value) ?? MUSIC_EQ_PRESETS[0];
}
const LABELS_KEY = 'purrductivity.music.eq.labels';
export function musicEqPresetLabel(value: MusicEqPreset): string {
  const fallback = musicEqPreset(value).label;
  try {
    const labels = JSON.parse(localStorage.getItem(LABELS_KEY) || '{}') as Record<string, unknown>;
    const label = labels[value];
    return typeof label === 'string' && label.trim() ? label.trim().slice(0, 24) : fallback;
  } catch { return fallback; }
}
export function renameMusicEqPreset(value: MusicEqPreset, label: string): void {
  const trimmed = label.trim().slice(0, 24);
  if (!trimmed) return;
  try {
    const labels = JSON.parse(localStorage.getItem(LABELS_KEY) || '{}') as Record<string, unknown>;
    labels[value] = trimmed;
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
  } catch { /* Renaming remains available for the current view. */ }
}
