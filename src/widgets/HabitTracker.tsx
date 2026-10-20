import { IconButton } from '../ui/IconButton';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { dashboardStore } from '../state/store';
import { useNow } from '../timing/hooks';
import { addDays, dayKey, parseDay } from './dates';
import type { Action } from '../state/actions';
export function HabitTracker({ widget, header }: {
    widget: Extract<Widget, {
        type: 'habit';
    }>;
    header: ReactNode;
}) {
    const now = useNow();
    const today = dayKey(new Date(now));
    const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    function run(action: Action) { setError(''); return dashboardStore.dispatch(action).catch(e => { setError(e.message); throw e; }); }
    return <section className="widget habit-card" aria-label={widget.title || 'Habit Tracker'}>{header}<form className="habit-add" onSubmit={e => { e.preventDefault(); if (!name.trim() || busy)
        return; setBusy(true); void run({ type: 'habitAdd', widgetId: widget.id, value: { id: crypto.randomUUID(), name: name.trim(), dates: [] } }).then(() => setName('')).catch(() => { }).finally(() => setBusy(false)); }}><input aria-label="New habit" maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="A small daily habit…"/><IconButton type="submit" className="primary" icon="plus" label="Add habit" disabled={!name.trim() || busy}/></form><p className="habit-caption">Last 7 local days · today is {today}</p><div className="habit-list">{!widget.content.habits.length && <p className="empty-copy">Build a rhythm. Add your first habit above.</p>}{widget.content.habits.map(h => <article className="habit-row" key={h.id}><div className="habit-title"><strong>{h.name}</strong><IconButton icon="trash" destructive label={`Delete habit ${h.name}`} onClick={() => { void run({ type: 'habitDelete', widgetId: widget.id, expected: h }).catch(() => { }); }}/></div><div className="habit-history">{dates.map(date => <button key={date} className={h.dates.includes(date) ? 'habit-day complete' : 'habit-day'} aria-label={`${h.name}, ${date}${date === today ? ', today' : ''}`} aria-pressed={h.dates.includes(date)} onClick={() => { void run({ type: 'habitToggle', widgetId: widget.id, habitId: h.id, date, expected: h.dates.includes(date), value: !h.dates.includes(date) }).catch(() => { }); }}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(parseDay(date))}</span><span>{h.dates.includes(date) ? '✓' : parseDay(date).getDate()}</span></button>)}</div></article>)}</div>{error && <p className="local-error" role="alert">{error}</p>}</section>;
}
