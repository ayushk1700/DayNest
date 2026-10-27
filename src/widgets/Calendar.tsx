import { IconButton } from '../ui/IconButton';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import type { CalendarEvent } from '../state/local-actions';
import { dashboardStore } from '../state/store';
import { Overlay } from '../ui/Overlay';
import { useNow } from '../timing/hooks';
import { addDays, dayKey, monthGrid, parseDay } from './dates';
export function Calendar({
  widget,
  header,
}: {
  widget: Extract<
    Widget,
    {
      type: 'calendar';
    }
  >;
  header: ReactNode;
}) {
  const today = dayKey(new Date(useNow()));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const days = monthGrid(year, month, widget.settings.weekStartsOn);
  const rows = days.slice(35).every((day) => parseDay(day).getMonth() !== month) ? 5 : 6;
  const monthEvents = widget.content.events
    .filter((e) => parseDay(e.date).getMonth() === month && parseDay(e.date).getFullYear() === year)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const viewDate = new Date(0);
  viewDate.setFullYear(year, month, 1);
  viewDate.setHours(12, 0, 0, 0);
  const labels =
    widget.settings.weekStartsOn === 1
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  function moveMonth(delta: number) {
    const d = new Date(0);
    d.setFullYear(year, month + delta, 1);
    d.setHours(12, 0, 0, 0);
    if (d.getFullYear() < 1 || d.getFullYear() > 9998) return;
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(dayKey(d));
  }
  function edit(event: CalendarEvent | null) {
    setEditing(event ? structuredClone(event) : null);
    setTitle(event?.title ?? '');
    setDate(event?.date ?? selected);
    setError('');
    setOpen(true);
  }
  function select(day: string, focus = false) {
    setSelected(day);
    const date = parseDay(day);
    setMonth(date.getMonth());
    setYear(date.getFullYear());
    if (focus)
      setTimeout(
        () =>
          document
            .querySelector<HTMLButtonElement>(
              `[data-calendar-id="${widget.id}"] [data-day="${day}"]`,
            )
            ?.focus(),
        0,
      );
  }
  return (
    <section
      className="widget calendar-card calendar-studio"
      aria-label={widget.title || 'Calendar'}
      data-calendar-id={widget.id}
    >
      {header}
      <div className="calendar-month">
        <strong
          aria-label={new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
            viewDate,
          )}
        >
          <span>{String(month + 1).padStart(2, '0')}.</span>{' '}
          {new Intl.DateTimeFormat('en', { month: 'long' }).format(viewDate)}
        </strong>
        <div className="calendar-navigation">
          <IconButton icon="left" label="Previous month" onClick={() => moveMonth(-1)} />
          <IconButton icon="right" label="Next month" onClick={() => moveMonth(1)} />
        </div>
      </div>
      <table className="calendar-grid" role="grid" aria-label="Local calendar">
        <thead>
          <tr>
            {labels.map((label, i) => (
              <th key={i} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {days.slice(row * 7, row * 7 + 7).map((day) => (
                <td key={day}>
                  <button
                    data-day={day}
                    tabIndex={day === selected ? 0 : -1}
                    className={`${day === today ? 'today ' : ''}${day === selected ? 'selected ' : ''}${widget.content.events.some((event) => event.date === day) ? 'has-event ' : ''}${parseDay(day).getMonth() !== month ? 'outside' : ''}`}
                    aria-label={`${day}${day === today ? ', today' : ''}`}
                    aria-pressed={day === selected}
                    onClick={() => select(day)}
                    onKeyDown={(e) => {
                      const delta = (
                        { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<
                          string,
                          number
                        >
                      )[e.key];
                      if (delta) {
                        e.preventDefault();
                        const next = addDays(day, delta);
                        if (/^\d{4}-/.test(next)) select(next, true);
                      }
                    }}
                  >
                    {parseDay(day).getDate()}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="calendar-selected">
        <span>{selected}</span>
        <button className="small" onClick={() => select(today)}>
          Today
        </button>
        <IconButton icon="plus" label="Add event" onClick={() => edit(null)} />
      </div>
      <div className="calendar-footer">
        <p className="calendar-note">A little room for the days that matter.</p>
        <div className="calendar-events" aria-label="Events this month">
          {monthEvents.map((event) => (
            <article key={event.id}>
              <button
                className="calendar-event-title"
                aria-label={`Select event ${event.title}, ${event.date}`}
                onClick={() => select(event.date)}
              >
                <b>{parseDay(event.date).getDate()}</b>
                <span>{event.title}</span>
              </button>
              <div className="calendar-event-actions">
                <IconButton icon="pencil" label="Edit event" onClick={() => edit(event)} />
                <IconButton
                  icon="trash"
                  destructive
                  label="Delete event"
                  onClick={() => {
                    void dashboardStore
                      .dispatch({ type: 'calendarDelete', widgetId: widget.id, expected: event })
                      .catch((e) => setError(e.message));
                  }}
                />
              </div>
            </article>
          ))}
          {!monthEvents.length && (
            <p className="empty-copy">
              Your month, a fresh page.
              <br />
              Add a day to remember.
            </p>
          )}
        </div>
        <div className="calendar-year" aria-label={`Year ${year}`}>
          <span>{String(year).padStart(4, '0').slice(0, 2)}</span>
          <span>{String(year).padStart(4, '0').slice(2)}</span>
        </div>
      </div>
      <label className="calendar-week-start">
        <span>Week starts</span>
        <select
          aria-label="Calendar week starts"
          value={widget.settings.weekStartsOn}
          onChange={(e) => {
            setError('');
            void dashboardStore
              .dispatch({
                type: 'calendarWeekStart',
                widgetId: widget.id,
                expected: widget.settings.weekStartsOn,
                value: Number(e.target.value) as 0 | 1,
              })
              .catch((e) => setError(e.message));
          }}
        >
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
        </select>
      </label>
      {error && !open && (
        <p className="local-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Overlay
          modal
          label={editing ? 'Edit calendar event' : 'New calendar event'}
          onClose={close}
        >
          <h1>{editing ? 'Edit event' : 'New event'}</h1>
          <form
            className="reminder-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                parseDay(date);
              } catch {
                setError('Choose a valid local date.');
                return;
              }
              if (!title.trim()) {
                setError('Enter an event title.');
                return;
              }
              void dashboardStore
                .dispatch({
                  type: 'calendarUpsert',
                  widgetId: widget.id,
                  expected: editing,
                  value: { id: editing?.id ?? crypto.randomUUID(), date, title: title.trim() },
                })
                .then(() => {
                  select(date);
                  close();
                })
                .catch((e) => setError(e.message));
            }}
          >
            <label>
              Event title
              <input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Event date
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" className="small" onClick={close}>
                Cancel
              </button>
              <button className="primary">Save event</button>
            </div>
          </form>
        </Overlay>
      )}
    </section>
  );
}
