export interface MusicTrack { title: string; artist?: string; album?: string; artworkUrl?: string; videoId?: string; durationSeconds?: number; currentTimeSeconds?: number; }
export interface MusicState { status: 'disconnected' | 'connecting' | 'connected' | 'error'; track: MusicTrack | null; isPlaying: boolean; selectedTabId?: number; }
export type MusicAction = 'toggle' | 'next' | 'previous';
export const emptyMusicState: MusicState = { status: 'disconnected', track: null, isPlaying: false };
