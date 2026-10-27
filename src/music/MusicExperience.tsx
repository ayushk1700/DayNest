import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  controlMusic,
  getMusicEqStatus,
  goDashboard,
  isExtensionPage,
  loadMusicEqPreset,
  loadMusicSpatial,
  openImmersive,
  openYouTubeMusic,
  playMusicTrack,
  readMusicState,
  setMusicEqPreset,
  setMusicSpatial,
} from './browser';
import { emptyMusicState, type MusicState } from './types';
import { MUSIC_EQ_PRESETS, musicEqPresetLabel, type MusicEqPreset } from './equalizer';
import type { Widget } from '../state/model';
import { WidgetHeader } from '../widgets/WidgetHeader';
import { Icon, type Name as IconName } from '../ui/Icon';
import './music.css';
import '../ui/uicons.css';

type MusicIconName = 'back' | 'next' | 'play' | 'pause' | 'open' | 'expand' | 'music' | 'history';
const musicIcons: Record<MusicIconName, IconName> = {
  back: 'left',
  next: 'right',
  play: 'play',
  pause: 'pause',
  open: 'external',
  expand: 'expand',
  music: 'music',
  history: 'history',
};
function MusicIcon({ name }: { name: MusicIconName }) {
  return <Icon name={musicIcons[name]} />;
}
function MusicSpatialButton({
  spatial,
  onToggle,
  className = '',
  showLabel = false,
}: {
  spatial: boolean;
  onToggle: () => void;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <motion.button
      type="button"
      className={`music-spatial-trigger ${spatial ? 'is-on' : ''} ${showLabel ? 'has-label' : ''} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      aria-label={spatial ? 'Turn spatial stereo off' : 'Turn spatial stereo on'}
      aria-pressed={spatial}
      title={spatial ? 'Spatial stereo on · headphones recommended' : 'Spatial stereo'}
      onClick={onToggle}
    >
      <Icon name="equalizer" />
      {showLabel && <span>{spatial ? 'SPATIAL ON' : 'SPATIAL'}</span>}
    </motion.button>
  );
}
function MusicEqualizer({
  playing,
  immersive = false,
  preset,
  active,
  spatial,
  onPresetChange,
  onSpatialChange,
}: {
  playing: boolean;
  immersive?: boolean;
  preset: MusicEqPreset;
  active: boolean;
  spatial: boolean;
  onPresetChange: (preset: MusicEqPreset) => void;
  onSpatialChange: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`music-equalizer ${immersive ? 'music-equalizer-immersive' : 'music-equalizer-toolbar'} ${playing ? 'is-playing' : ''}`}
    >
      <MusicSpatialButton spatial={spatial} onToggle={() => onSpatialChange(!spatial)} showLabel />
      <motion.button
        type="button"
        className="music-equalizer-trigger"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Equalizer presets"
        aria-expanded={open}
        title="Equalizer presets"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="equalizer" />
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.section
            key="eq-menu"
            className="music-equalizer-menu"
            aria-label="Equalizer presets"
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.99 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <p>LISTENING PROFILE</p>
            {MUSIC_EQ_PRESETS.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.985 }}
                aria-pressed={preset === item.id}
                className={preset === item.id ? 'is-selected' : ''}
                onClick={() => onPresetChange(item.id)}
              >
                <span>{musicEqPresetLabel(item.id)}</span>
                <small>
                  {item.bands.map((value) => `${value > 0 ? '+' : ''}${value}`).join(' · ')}
                </small>
                <i aria-hidden="true">
                  {preset === item.id ? (
                    <motion.span
                      initial={{ scale: 0.65, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Icon name="check" />
                    </motion.span>
                  ) : null}
                </i>
              </motion.button>
            ))}
            <motion.button
              type="button"
              className={`eq-spatial-toggle ${spatial ? 'is-selected' : ''}`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.985 }}
              aria-pressed={spatial}
              onClick={() => onSpatialChange(!spatial)}
            >
              <span>
                <strong>Spatial stereo</strong>
                <small>
                  {active && spatial
                    ? 'HRTF stage is active · headphones recommended'
                    : spatial
                      ? 'Ready · starts when the equalizer is on'
                      : 'Widen the stereo image for headphones'}
                </small>
              </span>
              <i aria-hidden="true">{spatial ? <Icon name="check" /> : null}</i>
            </motion.button>
            <footer>
              {active ? 'REAL EQ ACTIVE' : 'Start EQ from the Edge toolbar on YouTube Music'} · not
              Dolby Atmos
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
export function MusicExperience({
  immersive = false,
  widget,
}: {
  immersive?: boolean;
  widget?: Extract<Widget, { type: 'music' }>;
}) {
  const [state, setState] = useState<MusicState>(emptyMusicState);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [eqPreset, setEqPreset] = useState<MusicEqPreset>(loadMusicEqPreset);
  const [eqActive, setEqActive] = useState(false);
  const [spatial, setSpatial] = useState(loadMusicSpatial);
  const [, setEqLabelRevision] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentTracks, setRecentTracks] = useState<MusicState['track'][]>(() => {
    try {
      return JSON.parse(localStorage.getItem('purrductivity.music.history') || '[]').slice(0, 12);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    let live = true;
    const update = () =>
      void readMusicState()
        .then((next) => {
          if (live) setState(next);
        })
        .catch(() => {
          if (live) setState({ ...emptyMusicState, status: 'error' });
        });
    update();
    const timer = window.setInterval(update, 1800);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!immersive) return;
    const update = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setFullscreenError('');
    };
    const failed = () =>
      setFullscreenError(
        'Fullscreen could not open. Your browser may block fullscreen on this page.',
      );
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('fullscreenerror', failed);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('fullscreenerror', failed);
    };
  }, [immersive]);
  useEffect(() => {
    const refreshLabels = (event: StorageEvent) => {
      if (event.key === 'purrductivity.music.eq.labels') setEqLabelRevision((value) => value + 1);
      if (event.key === 'purrductivity.music.spatial') setSpatial(event.newValue === 'true');
    };
    window.addEventListener('storage', refreshLabels);
    return () => window.removeEventListener('storage', refreshLabels);
  }, []);
  useEffect(() => {
    let live = true;
    const update = () =>
      void getMusicEqStatus()
        .then((result) => {
          if (live) {
            setEqActive(result.active);
            if (result.active) setSpatial(result.spatial);
          }
        })
        .catch(() => {
          if (live) setEqActive(false);
        });
    update();
    const timer = window.setInterval(update, 1500);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  const chooseEqPreset = (preset: MusicEqPreset) => {
    setEqPreset(preset);
    try {
      localStorage.setItem('purrductivity.music.eq.preset', preset);
    } catch {
      /* Keep the current view selection. */
    }
    void setMusicEqPreset(preset)
      .then((result) => {
        setEqActive(result.active);
        if (!result.active && isExtensionPage)
          setActionError(
            'Preset saved. Start the real EQ from the Edge toolbar while YouTube Music is active.',
          );
      })
      .catch(() => setActionError('Could not update the equalizer preset.'));
  };
  const chooseSpatial = (enabled: boolean) => {
    setSpatial(enabled);
    void setMusicSpatial(enabled)
      .then((result) => setEqActive(result.active))
      .catch(() => setActionError('Could not update spatial stereo.'));
  };
  useEffect(() => {
    const track = state.track;
    if (state.status !== 'connected' || !track?.title) return;
    setRecentTracks((previous) => {
      if (previous[0]?.title === track.title && previous[0]?.artist === track.artist) {
        const refreshedTrack = {
          ...previous[0],
          ...track,
          currentTimeSeconds: previous[0].currentTimeSeconds,
          durationSeconds: previous[0].durationSeconds,
        };
        if (JSON.stringify(refreshedTrack) === JSON.stringify(previous[0])) return previous;
        const refreshed = [refreshedTrack, ...previous.slice(1)];
        try {
          localStorage.setItem('purrductivity.music.history', JSON.stringify(refreshed));
        } catch {
          /* Keep the in-memory history. */
        }
        return refreshed;
      }
      const next = [
        track,
        ...previous.filter((item) => item?.title !== track.title || item?.artist !== track.artist),
      ].slice(0, 12);
      try {
        localStorage.setItem('purrductivity.music.history', JSON.stringify(next));
      } catch {
        /* History remains available for this view. */
      }
      return next;
    });
  }, [
    state.status,
    state.track?.title,
    state.track?.artist,
    state.track?.album,
    state.track?.artworkUrl,
    state.track?.videoId,
  ]);
  const run = async (action: 'toggle' | 'next' | 'previous') => {
    setPending(true);
    setActionError('');
    try {
      if (!(await controlMusic(action)))
        setActionError('The YouTube Music control was unavailable.');
    } catch {
      setActionError('Could not reach the YouTube Music tab.');
    } finally {
      setPending(false);
    }
  };
  const playHistoryTrack = async (index: number) => {
    if (index < 1 || pending) return;
    const selected = recentTracks[index];
    if (!selected) return;
    setPending(true);
    setActionError('');
    setHistoryOpen(false);
    try {
      if (selected.videoId) {
        if (!(await playMusicTrack(selected.videoId)))
          setActionError('Could not open that track in YouTube Music.');
        return;
      }
      // Older saved entries have no video ID. Keep their previous-track fallback.
      const presses = index + (Number(state.track?.currentTimeSeconds) > 4 ? 1 : 0);
      for (let press = 0; press < presses; press++) {
        if (!(await controlMusic('previous'))) {
          setActionError('Could not return to that track in YouTube Music.');
          break;
        }
        if (press < presses - 1) await new Promise((resolve) => window.setTimeout(resolve, 1100));
      }
    } catch {
      setActionError('Could not reach the YouTube Music tab.');
    } finally {
      setPending(false);
    }
  };
  const connected = state.status === 'connected' && !!state.track;
  const artwork = state.track?.artworkUrl;
  const trackKey =
    state.track?.videoId || `${state.track?.title ?? 'track'}-${state.track?.artist ?? ''}`;
  const duration = state.track?.durationSeconds;
  const current = state.track?.currentTimeSeconds;
  const hasTimeline =
    Number.isFinite(duration) &&
    Number(duration) > 0 &&
    Number.isFinite(current) &&
    Number(current) >= 0;
  const elapsed = hasTimeline ? Math.min(Number(current), Number(duration)) : 0;
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const toggleFullscreen = () => {
    setFullscreenError('');
    if (!document.fullscreenEnabled) {
      setFullscreenError('Fullscreen is unavailable in this browser.');
      return;
    }
    const request = isFullscreen
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void request.catch(() =>
      setFullscreenError(
        'Fullscreen could not open. Allow fullscreen for this page and try again.',
      ),
    );
  };
  if (immersive) {
    return (
      <main className="music-immersive music-gallery">
        <div className="gallery-backdrop" aria-hidden="true">
          <AnimatePresence initial={false}>
            {artwork && (
              <motion.img
                key={trackKey}
                className="gallery-backdrop-image"
                src={artwork}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="gallery-back"
          onClick={goDashboard}
          aria-label="Return to dashboard"
          title="Return to dashboard"
        >
          <MusicIcon name="back" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          className="music-fullscreen-toggle"
          onClick={toggleFullscreen}
          disabled={!document.fullscreenEnabled}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isFullscreen}
          title={
            !document.fullscreenEnabled
              ? 'Fullscreen is unavailable in this browser'
              : isFullscreen
                ? 'Exit fullscreen (Esc)'
                : 'Enter fullscreen'
          }
        >
          <Icon name={isFullscreen ? 'compress' : 'expand'} />
        </motion.button>
        <MusicEqualizer
          playing={state.isPlaying}
          immersive
          preset={eqPreset}
          active={eqActive}
          spatial={spatial}
          onPresetChange={chooseEqPreset}
          onSpatialChange={chooseSpatial}
        />
        {fullscreenError && (
          <p className="gallery-fullscreen-error" role="status">
            {fullscreenError}
          </p>
        )}
        {connected ? (
          <>
            <section className="gallery-showcase" aria-label="Now playing">
              <article className="gallery-glass-card">
                <div className="gallery-card-main">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={trackKey}
                      className="gallery-cover gallery-card-art"
                      initial={{ opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      transition={{ duration: 0.2 }}
                    >
                      {artwork ? (
                        <img
                          src={artwork}
                          alt="Album artwork"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      ) : (
                        <span aria-hidden="true">
                          <MusicIcon name="music" />
                        </span>
                      )}
                    </motion.div>
                  </AnimatePresence>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={trackKey}
                      className="gallery-track"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.18 }}
                    >
                      <p className="gallery-eyebrow">
                        <span className="gallery-live-dot" />
                        NOW PLAYING
                      </p>
                      <h1 title={state.track!.title}>{state.track!.title}</h1>
                      {state.track!.artist && (
                        <p title={state.track!.artist}>{state.track!.artist}</p>
                      )}
                      {state.track!.album && <small>{state.track!.album}</small>}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <footer className="gallery-dock" aria-label="Playback controls">
                  <div className="gallery-dock-controls">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => void run('previous')}
                      disabled={pending}
                      aria-label="Previous track"
                    >
                      <MusicIcon name="back" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.94 }}
                      className="gallery-play"
                      onClick={() => void run('toggle')}
                      disabled={pending}
                      aria-label={state.isPlaying ? 'Pause' : 'Play'}
                    >
                      <MusicIcon name={state.isPlaying ? 'pause' : 'play'} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => void run('next')}
                      disabled={pending}
                      aria-label="Next track"
                    >
                      <MusicIcon name="next" />
                    </motion.button>
                  </div>
                  {hasTimeline && (
                    <div
                      className="gallery-timeline"
                      role="img"
                      aria-label={`Playback position ${clock(elapsed)} of ${clock(Number(duration))}`}
                    >
                      <span>{clock(elapsed)}</span>
                      <div>
                        <i
                          style={{ width: `${duration ? (elapsed / Number(duration)) * 100 : 0}%` }}
                        />
                      </div>
                      <span>{clock(Number(duration))}</span>
                    </div>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    className="gallery-history-toggle"
                    onClick={() => setHistoryOpen((open) => !open)}
                    aria-label="Recently played tracks"
                    aria-expanded={historyOpen}
                    title="Recently played"
                  >
                    <MusicIcon name="history" />
                  </motion.button>
                  <AnimatePresence initial={false}>
                    {historyOpen && (
                      <motion.section
                        key="music-history"
                        className="gallery-history"
                        aria-label="Recently played tracks"
                        initial={{ opacity: 0, y: 8, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.99 }}
                        transition={{ duration: 0.17 }}
                      >
                        <div className="gallery-history-heading">
                          <span>LISTENING HISTORY</span>
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setHistoryOpen(false)}
                            aria-label="Close listening history"
                          >
                            <Icon name="close" />
                          </motion.button>
                        </div>
                        {recentTracks.length ? (
                          <ul>
                            {recentTracks.map(
                              (track, index) =>
                                track && (
                                  <li key={`${track.title}-${track.artist || ''}-${index}`}>
                                    <motion.button
                                      whileTap={{ scale: 0.985 }}
                                      className="gallery-history-item"
                                      onClick={() => void playHistoryTrack(index)}
                                      disabled={index === 0 || pending}
                                      aria-label={`Play ${track.title} by ${track.artist || 'Unknown artist'}`}
                                      title={
                                        index === 0 ? 'Currently playing' : `Play ${track.title}`
                                      }
                                    >
                                      <span className="gallery-history-art">
                                        {track.artworkUrl ? (
                                          <img src={track.artworkUrl} alt="" />
                                        ) : (
                                          <MusicIcon name="music" />
                                        )}
                                      </span>
                                      <span className="gallery-history-copy">
                                        <strong title={track.title}>{track.title}</strong>
                                        <small title={track.artist || 'Unknown artist'}>
                                          {track.artist || 'Unknown artist'}
                                        </small>
                                      </span>
                                      {index === 0 ? (
                                        <span className="gallery-history-current">NOW</span>
                                      ) : (
                                        <span className="gallery-history-play">
                                          <MusicIcon name="play" />
                                        </span>
                                      )}
                                    </motion.button>
                                  </li>
                                ),
                            )}
                          </ul>
                        ) : (
                          <p>Tracks will appear here as you listen.</p>
                        )}
                      </motion.section>
                    )}
                  </AnimatePresence>
                  {actionError && (
                    <span className="gallery-error" role="status">
                      {actionError}
                    </span>
                  )}
                </footer>
              </article>
            </section>
          </>
        ) : (
          <section className="gallery-empty">
            <div className="gallery-empty-mark" aria-hidden="true">
              <MusicIcon name="music" />
            </div>
            <p className="gallery-eyebrow">IMMERSIVE MUSIC</p>
            <h1>Your music, in its own space.</h1>
            <p>Open YouTube Music in another tab to start listening here.</p>
            <button onClick={openYouTubeMusic}>
              <MusicIcon name="open" />
              Open YouTube Music
            </button>
            {state.status === 'connecting' && <small role="status">Connecting…</small>}
            {state.status === 'error' && (
              <small role="status">Could not connect. Open or reload YouTube Music.</small>
            )}
          </section>
        )}
      </main>
    );
  }
  return (
    <main
      className={`music-experience ${widget ? 'widget music-widget' : ''} ${immersive ? 'music-immersive' : ''} ${connected ? 'is-connected' : 'is-disconnected'}`}
    >
      {widget && (
        <WidgetHeader
          widget={widget}
          tools={
            <button
              className="music-widget-immersive"
              onClick={openImmersive}
              aria-label="Open immersive music"
            >
              <MusicIcon name="expand" />
            </button>
          }
        />
      )}
      {widget && (
        <MusicSpatialButton
          spatial={spatial}
          onToggle={() => chooseSpatial(!spatial)}
          className="music-widget-spatial-overlay"
          showLabel
        />
      )}
      <div className="music-ambient" aria-hidden="true">
        <AnimatePresence initial={false}>
          {artwork && (
            <motion.div
              key={trackKey}
              className="music-ambient-art"
              style={{ backgroundImage: `url("${artwork.replaceAll('"', '')}")` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
      </div>
      {!widget && (
        <MusicEqualizer
          playing={state.isPlaying}
          preset={eqPreset}
          active={eqActive}
          spatial={spatial}
          onPresetChange={chooseEqPreset}
          onSpatialChange={chooseSpatial}
        />
      )}
      {!widget && !immersive && (
        <button
          className="music-overflow"
          onClick={openImmersive}
          aria-label="Open immersive music"
        >
          <MusicIcon name="expand" />
        </button>
      )}
      {connected ? (
        <section className="music-player" aria-label="YouTube Music player">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={trackKey}
              className="music-details"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18 }}
            >
              <p className={`music-kicker ${state.isPlaying ? 'is-playing' : ''}`}>
                <span className="music-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                NOW PLAYING
              </p>
              <h1 title={state.track!.title}>{state.track!.title}</h1>
              {state.track!.artist && (
                <p className="music-artist" title={state.track!.artist}>
                  {state.track!.artist}
                </p>
              )}
              {state.track!.album && <small title={state.track!.album}>{state.track!.album}</small>}
            </motion.div>
          </AnimatePresence>
          {hasTimeline && (
            <div
              className="music-progress"
              role="img"
              aria-label={`Playback position ${clock(elapsed)} of ${clock(Number(duration))}`}
            >
              <span>{clock(elapsed)}</span>
              <div>
                <i style={{ width: `${duration ? (elapsed / Number(duration)) * 100 : 0}%` }} />
              </div>
              <span>{clock(Number(duration))}</span>
            </div>
          )}
          <nav className="music-controls" aria-label="Playback controls">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => void run('previous')}
              disabled={pending}
              aria-label="Previous track"
            >
              <MusicIcon name="back" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              className="music-play"
              onClick={() => void run('toggle')}
              disabled={pending}
              aria-label={state.isPlaying ? 'Pause' : 'Play'}
            >
              <MusicIcon name={state.isPlaying ? 'pause' : 'play'} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => void run('next')}
              disabled={pending}
              aria-label="Next track"
            >
              <MusicIcon name="next" />
            </motion.button>
          </nav>
          {actionError && (
            <p className="music-connection" role="status">
              {actionError}
            </p>
          )}
          <p className="music-connection">Playing from YouTube Music</p>
        </section>
      ) : (
        <section className="music-empty">
          <div className="music-mark" aria-hidden="true">
            <MusicIcon name="music" />
          </div>
          <h1>{immersive ? 'Your music, in its own space.' : 'Open YouTube Music'}</h1>
          <p>
            {immersive
              ? 'Open YouTube Music in another tab to start listening here.'
              : 'In another tab to control your music here.'}
          </p>
          <button className="music-open" onClick={openYouTubeMusic}>
            <MusicIcon name="open" />
            Open YouTube Music
          </button>
          {!immersive && (
            <button
              className="music-immersive-link"
              onClick={openImmersive}
              aria-label="Open immersive music"
            >
              <MusicIcon name="expand" />
            </button>
          )}
          {state.status === 'connecting' && <small role="status">Connecting…</small>}
          {state.status === 'error' && (
            <small role="status">Could not connect. Open or reload YouTube Music.</small>
          )}
        </section>
      )}
      {!isExtensionPage && !widget && (
        <p className="music-preview-note">Playback controls work in the installed extension.</p>
      )}
    </main>
  );
}
