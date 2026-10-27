import { IconButton } from '../ui/IconButton';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { isAmbientNote } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { StickyNote } from './StickyNote';
import { WidgetFrame } from '../dashboard/WidgetFrame';
import { remainingMs, completedToday, localDate } from '../timing/time';
import { useNow } from '../timing/hooks';
import { Icon } from '../ui/Icon';
import { Overlay } from '../ui/Overlay';
import { motion } from 'motion/react';

function TimerProgress({ value, label }: { value: number; label: string }) {
  const percentage = Math.round(value * 100);
  return (
    <div
      className="timer-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <motion.div
        initial={false}
        animate={{ scaleX: value }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />
    </div>
  );
}
export function Pomodoro({
  widget,
  header,
}: {
  widget: Extract<
    Widget,
    {
      type: 'pomodoro';
    }
  >;
  header: ReactNode;
}) {
  const now = useNow(),
    t = widget.content;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const document = useDashboard().document;
  const stickies = document?.widgets.filter(isAmbientNote) ?? [];
  const [work, setWork] = useState(widget.settings.workMinutes);
  const [rest, setRest] = useState(widget.settings.breakMinutes);
  const close = useCallback(() => setSettings(false), []);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = localDate(now, zone);
  const count = useMemo(() => completedToday(t, now, zone), [t.completedSessions, day, zone]);
  const ms = remainingMs(t, now);
  const seconds = Math.ceil(ms / 1000);
  const totalMs =
    (t.phase === 'work' ? widget.settings.workMinutes : widget.settings.breakMinutes) * 60_000;
  const progress =
    t.status === 'finished'
      ? 1
      : t.status === 'idle'
        ? 0
        : Math.max(0, Math.min(1, 1 - ms / totalMs));
  const label =
    t.status === 'running'
      ? 'Pause'
      : t.status === 'paused'
        ? 'Resume'
        : t.status === 'finished'
          ? t.phase === 'work'
            ? 'Start break'
            : 'Start work'
          : 'Start';
  function command(command: 'start' | 'pause' | 'resume' | 'reset' | 'next') {
    setBusy(true);
    setError('');
    void dashboardStore
      .dispatch({
        type: 'timer',
        widgetId: widget.id,
        expected: t,
        command,
        sessionId: crypto.randomUUID(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }
  const timerControls = (
    <div className="timer-actions">
      <button
        className="primary"
        disabled={busy || (t.status === 'running' && ms === 0)}
        onClick={() =>
          command(
            t.status === 'running'
              ? 'pause'
              : t.status === 'paused'
                ? 'resume'
                : t.status === 'finished'
                  ? 'next'
                  : 'start',
          )
        }
      >
        <Icon name={t.status === 'running' ? 'pause' : 'play'} />
        {label}
      </button>
      <button
        className="small"
        disabled={busy || t.status === 'idle'}
        aria-label="Reset current session"
        onClick={() => command('reset')}
      >
        <Icon name="reset" />
      </button>
    </div>
  );
  return (
    <section className="widget timer-card live-timer" aria-label={widget.title || 'Pomodoro Timer'}>
      {header}
      <button
        className="ambient-launch"
        title="Open distraction-free Ambient mode"
        onClick={() => setAmbient(true)}
      >
        <Icon name="timer" />
        Ambient
      </button>
      <motion.p
        key={`${t.phase}-${t.status}`}
        className="timer-phase"
        role="status"
        initial={{ opacity: 0, y: 3 }}
        animate={
          t.status === 'finished'
            ? { opacity: [0, 1], y: [4, 0], scale: [0.98, 1.02, 1] }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{ duration: t.status === 'finished' ? 0.38 : 0.2 }}
      >
        {t.phase === 'work' ? 'Work' : 'Break'} ·{' '}
        {t.status === 'running' && ms === 0 ? 'Finishing…' : t.status}
      </motion.p>
      <div className="timer" role="timer" aria-label="Time remaining">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </div>
      <TimerProgress value={progress} label="Session progress" />
      <p className="cycles">
        Work cycles completed today: <strong>{count}</strong>
      </p>
      <div className="timer-actions">
        <button
          className="primary"
          disabled={busy || (t.status === 'running' && ms === 0)}
          onClick={() =>
            command(
              t.status === 'running'
                ? 'pause'
                : t.status === 'paused'
                  ? 'resume'
                  : t.status === 'finished'
                    ? 'next'
                    : 'start',
            )
          }
        >
          <Icon name={t.status === 'running' ? 'pause' : 'play'} />
          {label}
        </button>
        <button
          className="small"
          disabled={busy || t.status === 'idle'}
          aria-label="Reset current session"
          title="Reset the current phase; keep completed sessions"
          onClick={() => command('reset')}
        >
          <Icon name="reset" />
        </button>
      </div>
      <IconButton
        icon="settings"
        label="Timer settings"
        className="timer-settings-toggle"
        onClick={() => {
          setWork(widget.settings.workMinutes);
          setRest(widget.settings.breakMinutes);
          setSettings(true);
        }}
      />
      {t.status === 'finished' && (
        <p className="delivery-note">
          {t.delivery === 'delivered'
            ? 'Notification sent.'
            : t.delivery === 'claimed'
              ? 'Notification delivery attempted.'
              : t.delivery === 'pending'
                ? 'Notification pending.'
                : 'Session saved. System notification unavailable.'}
        </p>
      )}
      {error && (
        <p className="timer-error" role="alert">
          {error}
        </p>
      )}
      {ambient && (
        <Overlay modal fullPage label="Ambient focus" onClose={() => setAmbient(false)}>
          <header className="ambient-header">
            <span>
              Ambient <span className="ambient-header-hint">/ one thing at a time</span>
            </span>
            <button className="ambient-exit" onClick={() => setAmbient(false)}>
              <Icon name="close" />
              Exit focus
            </button>
          </header>
          <main className="ambient-content">
            <section className="ambient-timer" aria-label="Pomodoro timer">
              <p className="ambient-eyebrow">
                {t.phase === 'work' ? 'Time to focus' : 'Take a breath'}
              </p>
              <div className="ambient-time" role="timer" aria-label="Time remaining">
                {String(Math.floor(seconds / 60)).padStart(2, '0')}
                <span>:</span>
                {String(seconds % 60).padStart(2, '0')}
              </div>
              <TimerProgress value={progress} label="Session progress" />
              <p className="ambient-status" role="status">
                {t.phase === 'work' ? 'Work' : 'Break'} ·{' '}
                {t.status === 'running' && ms === 0 ? 'Finishing…' : t.status}
              </p>
              {timerControls}
              {error && <p role="alert">{error}</p>}
            </section>
          </main>
          <button
            className="ambient-add"
            aria-label={addingNote ? 'Adding sticky note' : 'Add sticky note'}
            title="Add sticky note"
            disabled={addingNote}
            onClick={() => {
              setAddingNote(true);
              setError('');
              void dashboardStore
                .dispatch({
                  type: 'createWidget',
                  kind: 'sticky',
                  workspace: 'ambient',
                  id: crypto.randomUUID(),
                  view: { width: window.innerWidth, height: window.innerHeight },
                })
                .catch((e) => setError(e.message))
                .finally(() => setAddingNote(false));
            }}
          >
            <Icon name="plus" />
          </button>
          <div
            className="ambient-note-canvas"
            style={{
              minWidth: Math.max(
                0,
                ...stickies.map((note) => note.position.x + note.size.width + 24),
              ),
              minHeight: Math.max(
                0,
                ...stickies.map((note) => note.position.y + note.size.height + 24),
              ),
            }}
          >
            {stickies.map(
              (note) =>
                note.type === 'sticky' && (
                  <WidgetFrame key={note.id} widget={note} zoom={1} narrow={false}>
                    <StickyNote widget={note} />
                  </WidgetFrame>
                ),
            )}
          </div>
        </Overlay>
      )}
      {settings && (
        <Overlay modal label="Timer settings" onClose={close}>
          <h1>Timer settings</h1>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              void dashboardStore
                .dispatch({
                  type: 'timerSettings',
                  widgetId: widget.id,
                  expected: widget.settings,
                  value: { workMinutes: work, breakMinutes: rest },
                })
                .then(close)
                .catch((e) => setError(e.message));
            }}
          >
            <div className="layout-fields">
              <label>
                Work minutes
                <input
                  required
                  type="number"
                  min="1"
                  max="240"
                  step="1"
                  value={work}
                  onChange={(e) => setWork(e.target.valueAsNumber)}
                />
              </label>
              <label>
                Break minutes
                <input
                  required
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  value={rest}
                  onChange={(e) => setRest(e.target.valueAsNumber)}
                />
              </label>
            </div>
            <p className="confirm-copy">
              Settings apply to new sessions. Reset a running or paused session before changing
              durations.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" className="small" onClick={close}>
                Cancel
              </button>
              <button className="primary" disabled={!['idle', 'finished'].includes(t.status)}>
                Save durations
              </button>
            </div>
          </form>
        </Overlay>
      )}
    </section>
  );
}
