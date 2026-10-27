import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  MUSIC_EQ_PRESETS,
  isMusicEqPreset,
  musicEqPresetLabel,
  renameMusicEqPreset,
} from './equalizer';
import {
  getMusicEqStatus,
  loadMusicEqPreset,
  loadMusicSpatial,
  setMusicEqPreset,
  setMusicSpatial,
  startMusicEq,
  stopMusicEq,
} from './browser';
import { Icon } from '../ui/Icon';
import './equalizer-popup.css';
import '../ui/uicons.css';

interface EqChrome {
  tabs: {
    query(query: {
      active: boolean;
      lastFocusedWindow: boolean;
    }): Promise<{ id?: number; url?: string }[]>;
  };
  tabCapture: { getMediaStreamId(options: { targetTabId: number }): Promise<string> };
}
const chromeApi = (globalThis as typeof globalThis & { chrome?: EqChrome }).chrome;

export function EqualizerPopup() {
  const [preset, setPreset] = useState(loadMusicEqPreset);
  const [spatial, setSpatial] = useState(loadMusicSpatial);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Choose a sound profile, then start EQ on your YouTube Music tab.',
  );
  const [targetTabId, setTargetTabId] = useState<number>();
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [, setLabelRevision] = useState(0);

  useEffect(() => {
    void getMusicEqStatus()
      .then((status) => {
        setActive(status.active);
        setSpatial(status.active ? status.spatial : loadMusicSpatial());
      })
      .catch(() => undefined);
    void chromeApi?.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
      setTargetTabId(tab?.url?.startsWith('https://music.youtube.com/') ? tab.id : undefined);
    });
  }, []);

  const choose = async (value: string) => {
    if (!isMusicEqPreset(value)) return;
    setPreset(value);
    try {
      localStorage.setItem('purrductivity.music.eq.preset', value);
    } catch {
      /* Keep this popup's selection. */
    }
    const result = await setMusicEqPreset(value);
    if (result.active) setMessage(`EQ is on · ${musicEqPresetLabel(value)}`);
    else setMessage(`Selected: ${musicEqPresetLabel(value)}. Start EQ on the YouTube Music tab.`);
  };

  const saveName = () => {
    const name = draftName.trim();
    if (!name) return;
    renameMusicEqPreset(preset, name);
    setLabelRevision((value) => value + 1);
    setRenaming(false);
    setMessage(`Saved as “${name.slice(0, 24)}”.`);
  };

  const chooseSpatial = async (enabled: boolean) => {
    setSpatial(enabled);
    try {
      const result = await setMusicSpatial(enabled);
      setActive(result.active);
      setMessage(
        result.active
          ? `Spatial stereo ${enabled ? 'on' : 'off'} · HRTF stage`
          : enabled
            ? 'Spatial stereo selected. Start the equalizer to apply it.'
            : 'Spatial stereo off.',
      );
    } catch {
      setMessage(
        enabled
          ? 'Spatial stereo saved. It will apply when the equalizer starts.'
          : 'Spatial stereo preference saved as off.',
      );
    }
  };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (active) {
        await stopMusicEq();
        setActive(false);
        setMessage('Equalizer off.');
      } else {
        if (!chromeApi || targetTabId === undefined) {
          setMessage('Open YouTube Music and click the EQ icon from that tab.');
          return;
        }
        // Request capture directly from the popup button gesture. If Chrome
        // reports a leftover stream, ask the offscreen processor to release it
        // and retry once instead of leaving the popup stuck in the OFF state.
        let streamId: string;
        try {
          streamId = await chromeApi.tabCapture.getMediaStreamId({ targetTabId });
        } catch (captureError) {
          const reason =
            captureError instanceof Error ? captureError.message : String(captureError);
          if (!/active stream/i.test(reason)) throw captureError;
          setMessage('Releasing the previous audio capture…');
          await stopMusicEq();
          try {
            streamId = await chromeApi.tabCapture.getMediaStreamId({ targetTabId });
          } catch {
            throw new Error(
              'Chrome still has an active audio capture. Close other equalizer sessions, then try again.',
            );
          }
        }
        const result = await startMusicEq(streamId, preset, spatial);
        if (!result.active) throw new Error(result.error || 'Could not start audio processing.');
        setActive(true);
        setMessage(
          `EQ is on · ${musicEqPresetLabel(preset)}${result.spatial ? ' · HRTF spatial stereo' : ''}`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start the equalizer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.main className="eq-popup" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <header>
        <span className="eq-popup-mark" aria-hidden="true">
          <Icon name="equalizer" />
        </span>
        <div>
          <p>DAYNEST AUDIO</p>
          <h1>Music Equalizer</h1>
        </div>
        <span className={`eq-live ${active ? 'is-on' : ''}`}>{active ? 'ON' : 'OFF'}</span>
      </header>
      <p className="eq-lede">A considered sound, tuned for your listening.</p>
      <div className="eq-preset-heading">
        <span>LISTENING PROFILE</span>
        <span>5 BAND</span>
      </div>
      <div className="eq-presets" role="radiogroup" aria-label="Equalizer preset">
        {MUSIC_EQ_PRESETS.map((item) => (
          <motion.button
            type="button"
            role="radio"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.99 }}
            aria-checked={preset === item.id}
            className={`eq-preset ${preset === item.id ? 'is-selected' : ''}`}
            key={item.id}
            onClick={() => void choose(item.id)}
          >
            <span>
              <strong>{musicEqPresetLabel(item.id)}</strong>
              <small>
                {item.bands.map((value) => `${value > 0 ? '+' : ''}${value}`).join(' · ')} dB
              </small>
            </span>
            <i aria-hidden="true">
              {preset === item.id && (
                <AnimatePresence initial={false}>
                  <motion.span
                    initial={{ scale: 0.65, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                  >
                    <span className="eq-selected-dot" />
                  </motion.span>
                </AnimatePresence>
              )}
            </i>
          </motion.button>
        ))}
      </div>
      <section className="eq-spatial-section" aria-label="Spatial audio">
        <div className="eq-spatial-heading">
          <span>SPATIAL AUDIO</span>
          <small>HEADPHONES</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={spatial}
          className={`eq-spatial-choice ${spatial ? 'is-selected' : ''}`}
          onClick={() => void chooseSpatial(!spatial)}
        >
          <span>
            <strong>Spatial upmix</strong>
            <small>
              {spatial
                ? active
                  ? 'Center/side HRTF upmix active'
                  : 'Will apply when the equalizer starts'
                : 'Widen stereo with a center/side HRTF stage'}
            </small>
          </span>
          <i aria-hidden="true">
            <b />
          </i>
        </button>
        <p className="eq-spatial-note">
          Approximate center/side extraction from the stereo mix. Can introduce artifacts; it is not
          a true Dolby Atmos mix.
        </p>
      </section>
      <AnimatePresence mode="wait" initial={false}>
        {renaming ? (
          <motion.div
            key="rename"
            className="eq-rename"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
          >
            <input
              autoFocus
              aria-label="Preset name"
              maxLength={24}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveName();
                if (event.key === 'Escape') setRenaming(false);
              }}
            />
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={saveName}>
              Save
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setRenaming(false)}
            >
              Cancel
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="rename-open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="eq-rename-open"
            onClick={() => {
              setDraftName(musicEqPresetLabel(preset));
              setRenaming(true);
            }}
          >
            Rename selected · {musicEqPresetLabel(preset)}
          </motion.button>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        className={`eq-toggle ${active ? 'is-on' : ''}`}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy ? 'Connecting audio…' : active ? 'Turn EQ off' : 'Start equalizer'}
      </motion.button>
      <p className="eq-status" role="status">
        {message}
      </p>
    </motion.main>
  );
}
