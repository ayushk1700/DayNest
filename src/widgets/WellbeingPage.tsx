import { useRef, useState } from 'react';
import type { DashboardDocument, WellbeingSettings } from '../state/model';
import { defaultWellbeingSettings } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { wellbeingStats, sessionTime } from './wellbeingSummary';
import { InsightBrandBar, InsightGlyph } from './InsightChrome';
import './wellbeing.css';

export function WellbeingPage({
  document,
  now,
  zone,
  close,
}: {
  document: DashboardDocument;
  now: number;
  zone: string;
  close: () => void;
}) {
  const [range, setRange] = useState<1 | 7 | 30>(7),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(''),
    [goalEditing, setGoalEditing] = useState(false);
  const state = useDashboard(),
    settings = document.wellbeingSettings ?? defaultWellbeingSettings(),
    summary = wellbeingStats(document, now, zone, range);
  const [goalDraft, setGoalDraft] = useState(String(settings.dailyBreakGoal ?? 3));
  const clearButton = useRef<HTMLButtonElement>(null);
  const chartMax = Math.max(
    3600000,
    Math.ceil(Math.max(...summary.days.map((d) => Math.max(d.workMs, d.breakMs))) / 3600000) *
      3600000,
  );
  const goal = settings.dailyBreakGoal ?? null,
    target = (goal ?? 0) * range,
    percentage = target ? Math.round((summary.breaks / target) * 100) : null;
  const hourMax = Math.max(1, ...summary.hourly),
    enoughHistory =
      summary.days.filter((d) => d.workMs > 0).length >= 3 && summary.workMs >= 3600000;
  const best = summary.hourly.reduce(
    (best, _, i) =>
      summary.hourly[i] + summary.hourly[(i + 1) % 24] >
      summary.hourly[best] + summary.hourly[(best + 1) % 24]
        ? i
        : best,
    0,
  );
  const hour = (h: number) => `${h % 12 || 12}${h % 24 < 12 ? 'am' : 'pm'}`;
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      Date.parse(date + 'T12:00:00Z'),
    );
  async function change(value: WellbeingSettings) {
    setError('');
    try {
      await dashboardStore.dispatch({ type: 'wellbeingSettings', expected: settings, value });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
      return false;
    }
  }
  async function clear() {
    setError('');
    try {
      await dashboardStore.dispatch({
        type: 'clearWellbeing',
        expected: document.wellbeingHistory ?? null,
      });
      setConfirm(false);
      setTimeout(() => clearButton.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History changed. Please try again.');
    }
  }
  const recordingButton = (
    <button
      disabled={state.pending > 0}
      onClick={() => void change({ ...settings, recordingEnabled: !settings.recordingEnabled })}
    >
      {settings.recordingEnabled
        ? 'Pause recording'
        : settings.startedAt === null
          ? 'Enable local recording'
          : 'Resume recording'}
    </button>
  );
  return (
    <div className="insight-page wellbeing-page">
      <InsightBrandBar close={close} />
      <header className="wellbeing-page-heading">
        <div>
          <h1>Your wellbeing</h1>
          <p>A little more balance, at your own pace.</p>
        </div>
        <div className="wellbeing-period-picker">
          <label>
            <InsightGlyph name="clock" />
            <select
              aria-label="Statistics period"
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as 1 | 7 | 30)}
            >
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <span>
            {dateLabel(summary.days[0].date)} — {dateLabel(summary.days.at(-1)!.date)}
          </span>
        </div>
      </header>
      {settings.startedAt === null && (
        <section className="wellbeing-consent" aria-label="Local recording">
          <p>
            Keep a local record of DayNest timer intervals and completions. Recording is optional;
            browsing and other apps are not tracked.
          </p>
          {recordingButton}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="wellbeing-overview">
        <div>
          <i>
            <InsightGlyph name="clock" />
          </i>
          <div>
            <span>Focus time</span>
            <strong>{sessionTime(summary.workMs)}</strong>
          </div>
        </div>
        <div>
          <i>
            <InsightGlyph name="cup" />
          </i>
          <div>
            <span>Breaks completed</span>
            <strong>{summary.breaks}</strong>
          </div>
        </div>
        <div>
          <i>
            <InsightGlyph name="check" />
          </i>
          <div>
            <span>Habit check-ins</span>
            <strong>{summary.habits}</strong>
          </div>
        </div>
        <div>
          <i>
            <InsightGlyph name="bars" />
          </i>
          <div>
            <span>Daily average</span>
            <strong>
              {settings.startedAt === null
                ? '—'
                : sessionTime(
                    summary.workMs / range < 60000
                      ? summary.workMs / range
                      : Math.round(summary.workMs / range / 60000) * 60000,
                  )}
            </strong>
          </div>
        </div>
      </div>
      <div className="wellbeing-design-grid">
        <section className="wellbeing-rhythm">
          <h2>Your rhythm {range === 1 ? 'today' : range === 7 ? 'this week' : 'this month'}</h2>
          <div className="wellbeing-chart-wrap">
            <div className="wellbeing-y-axis">
              {[1, 0.6667, 0.3333, 0].map((n, i) => (
                <span key={i}>
                  {n === 0 ? '0h' : `${Math.round(((chartMax * n) / 3600000) * 10) / 10}h`}
                </span>
              ))}
            </div>
            <div
              className="wellbeing-chart"
              role="img"
              aria-label={`Recorded focus and break running time over ${range} days; exact values are available in Daily data.`}
              style={{ gridTemplateColumns: `repeat(${range},minmax(0,1fr))` }}
            >
              {summary.days.map((day, i) => (
                <div key={day.date}>
                  <div className="wellbeing-chart-bars">
                    <i
                      className="focus-bar"
                      style={{ height: `${(day.workMs / chartMax) * 150}px` }}
                    >
                      <span>{day.workMs > 0 && range <= 7 ? sessionTime(day.workMs) : ''}</span>
                    </i>
                    <i
                      className="break-bar"
                      style={{ height: `${(day.breakMs / chartMax) * 150}px` }}
                    />
                  </div>
                  <span>
                    {range === 30
                      ? i % 5 === 0 || i === 29
                        ? day.date.slice(8)
                        : ''
                      : range === 1
                        ? 'Today'
                        : day.label}
                  </span>
                  {range <= 7 && <small>{dateLabel(day.date)}</small>}
                </div>
              ))}
            </div>
          </div>
          <div className="wellbeing-chart-legend">
            <span>
              <i />
              Focus time
            </span>
            <span>
              <i />
              Break time
            </span>
          </div>
          {summary.workMs === 0 && (
            <p className="wellbeing-no-history">No focus time recorded for this period.</p>
          )}
        </section>
        <section className="wellbeing-rest">
          <h2>A little room for rest</h2>
          <div
            className="wellbeing-goal-ring"
            role="img"
            aria-label={
              percentage === null
                ? 'No break goal set'
                : `${summary.breaks} completed break timers out of a goal of ${target}; ${percentage} percent`
            }
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="goal-track" cx="60" cy="60" r="48" />
              <circle
                className="goal-progress"
                cx="60"
                cy="60"
                r="48"
                strokeDasharray={`${(Math.min(100, percentage ?? 0) / 100) * 301.593} 301.593`}
              />
            </svg>
            <div>
              <strong>{percentage === null ? '—' : `${percentage}%`}</strong>
              <span>Break goal</span>
            </div>
          </div>
          <p>
            {goal === null
              ? 'Choose a daily break-timer goal to see your progress.'
              : `${summary.breaks} of ${target} recorded completions · ${goal} per day. A completed timer does not establish that you rested.`}
          </p>
          <button className="wellbeing-text-button" onClick={() => setGoalEditing(!goalEditing)}>
            {goal === null ? 'Set a break goal' : 'Edit break goal'}
          </button>
          {goalEditing && (
            <form
              className="wellbeing-goal-form"
              onSubmit={(e) => {
                e.preventDefault();
                void change({ ...settings, dailyBreakGoal: Number(goalDraft) }).then((ok) => {
                  if (ok) setGoalEditing(false);
                });
              }}
            >
              <label>
                Daily break timer goal
                <input
                  aria-label="Daily break timer goal"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                />
              </label>
              <button disabled={state.pending > 0}>Save goal</button>
              <button
                type="button"
                disabled={state.pending > 0}
                onClick={() =>
                  void change({ ...settings, dailyBreakGoal: null }).then((ok) => {
                    if (ok) setGoalEditing(false);
                  })
                }
              >
                Remove goal
              </button>
            </form>
          )}
        </section>
        <section className="wellbeing-focus-window">
          <div>
            <h2>Your recorded focus window</h2>
            <strong>
              {enoughHistory ? `${hour(best)} — ${hour((best + 2) % 24)}` : 'More history needed'}
            </strong>
          </div>
          <div className="wellbeing-heatmap">
            <div
              role="img"
              aria-label={summary.hourly.map((ms, h) => `${h}:00, ${sessionTime(ms)}`).join('; ')}
            >
              {summary.hourly.map((ms, h) => (
                <i
                  key={h}
                  style={{
                    background:
                      ms > 0
                        ? `color-mix(in srgb,var(--insight-sage) ${Math.max(12, (ms / hourMax) * 100)}%,var(--surface))`
                        : undefined,
                  }}
                />
              ))}
            </div>
            <div>
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>11pm</span>
            </div>
          </div>
        </section>
        <section className="wellbeing-kind-note">
          <InsightGlyph name="sun" />
          <div>
            <h2>Focus and rest both count.</h2>
            <p>
              Make space for focus.
              <br />
              Leave room to pause.
            </p>
          </div>
        </section>
      </div>
      <p className="wellbeing-private">
        <InsightGlyph name="lock" />
        Only activity recorded in DayNest is shown. Other apps and browsing are not tracked.
      </p>
      <details className="wellbeing-details">
        <summary>Daily data &amp; how totals work</summary>
        <p>
          Recorded session time sums concurrent timers and can exceed elapsed clock time. It is not
          screen time, unique attention or a health score. Live totals refresh about every 15
          seconds. Days use {zone}; the daily average is rounded to the nearest minute and divides
          recorded focus time by all {range} selected calendar days, including days without records.
          A focus window appears only with at least three recorded days and one hour of work
          intervals. It identifies the two-hour window with the most recorded session time, not a
          prediction.
        </p>
        <p>
          Existing focus completions: {summary.sessions}. Older completion counts do not establish
          duration; no hours are inferred from them. Habit counts reflect current habits; eligible
          schedules and historical targets are unavailable, so no target fraction is shown.
        </p>
        <div className="wellbeing-table-wrap">
          <table className="insight-stats-table">
            <caption>Daily records · {zone}</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Focus minutes</th>
                <th scope="col">Break minutes</th>
                <th scope="col">Break timers</th>
                <th scope="col">Habit check-ins</th>
              </tr>
            </thead>
            <tbody>
              {summary.days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">
                    {d.label} · {d.date}
                  </th>
                  <td>{(d.workMs / 60000).toFixed(1)}</td>
                  <td>{(d.breakMs / 60000).toFixed(1)}</td>
                  <td>{d.breaks}</td>
                  <td>{d.habits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="wellbeing-details wellbeing-storage">
        <summary>Local recording &amp; privacy</summary>
        <div className="wellbeing-recording">
          <div>
            <strong>
              {settings.recordingEnabled ? 'Local recording is on' : 'Local recording is paused'}
            </strong>
            {settings.startedAt !== null && (
              <p>
                Current history began{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: zone,
                }).format(settings.startedAt)}
                . Paused and unrecorded periods are excluded.
              </p>
            )}
          </div>
          {settings.startedAt !== null && recordingButton}
        </div>
        <label>
          Keep local records for{' '}
          <select
            aria-label="History retention"
            disabled={state.pending > 0}
            value={settings.retentionDays}
            onChange={(e) =>
              void change({ ...settings, retentionDays: Number(e.target.value) as 30 | 90 })
            }
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <p>
          Reducing retention removes older records. Storage keeps at most 1,000 intervals and 1,000
          completions; capacity can shorten history. Deleting a Wellbeing card keeps this shared
          history. Backups may retain older copies.
        </p>
        {document.wellbeingHistory?.storageLimited && (
          <p role="status">
            The storage limit was reached. Some timer records may be missing; totals cover retained
            records only.
          </p>
        )}
        <button ref={clearButton} disabled={state.pending > 0} onClick={() => setConfirm(true)}>
          Clear wellbeing history
        </button>
        {confirm && (
          <div
            className="wellbeing-clear"
            role="group"
            aria-label="Confirm clearing wellbeing history"
          >
            <p>
              Delete recorded timer intervals and completion events? Existing habits, legacy
              completion counts and other widgets stay saved. If recording is on, fresh history
              starts now. This cannot be undone; backups may still contain copies.
            </p>
            <button disabled={state.pending > 0} onClick={() => void clear()}>
              Confirm clear history
            </button>
            <button disabled={state.pending > 0} onClick={() => setConfirm(false)}>
              Keep history
            </button>
          </div>
        )}
      </details>
    </div>
  );
}
