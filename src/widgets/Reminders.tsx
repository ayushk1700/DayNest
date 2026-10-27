import { IconButton } from '../ui/IconButton';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget, Reminder } from '../state/model';
import { dashboardStore } from '../state/store';
import { useNow } from '../timing/hooks';
import { Overlay } from '../ui/Overlay';
const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function Reminders({
  widget,
  header,
}: {
  widget: Extract<
    Widget,
    {
      type: 'reminder';
    }
  >;
  header: ReactNode;
}) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [message, setMessage] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  function edit(reminder: Reminder | null) {
    setEditing(reminder ? structuredClone(reminder) : null);
    setMessage(reminder?.message ?? '');
    setDue(localInput(new Date(reminder?.dueAt ?? Date.now() + 3600000)));
    setError('');
    setOpen(true);
  }
  return (
    <section className="widget reminder-card" aria-label={widget.title || 'Reminder'}>
      {header}
      <div className="reminder-list">
        {!widget.content.reminders.length && (
          <p className="empty-copy">
            Keep something important in sight. Add a local reminder below.
          </p>
        )}
        {[...widget.content.reminders]
          .sort((a, b) => a.dueAt - b.dueAt)
          .map((r) => (
            <article className="reminder-entry" key={r.id}>
              <p className="reminder-message">{r.message}</p>
              <h3>{r.dueAt <= now ? 'Reminder passed' : 'Upcoming reminder'}</h3>
              <time dateTime={new Date(r.dueAt).toISOString()}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                  timeZone: r.timeZone,
                }).format(r.dueAt)}
              </time>
              <p className="reminder-zone">{r.timeZone}</p>
              <p className="delivery-note">
                {r.dueAt > now
                  ? 'Scheduled locally'
                  : r.delivery === 'delivered'
                    ? 'Notification sent'
                    : r.delivery === 'pending'
                      ? 'Notification pending'
                      : r.delivery === 'claimed'
                        ? 'Notification delivery attempted'
                        : 'System notification unavailable'}
              </p>
              <div className="reminder-actions">
                <IconButton icon="pencil" label="Edit reminder" onClick={() => edit(r)} />
                <IconButton
                  icon="trash"
                  destructive
                  label="Delete reminder"
                  onClick={() => {
                    void dashboardStore
                      .dispatch({ type: 'deleteReminder', widgetId: widget.id, expected: r })
                      .catch((e) => setError(e.message));
                  }}
                />
              </div>
            </article>
          ))}
      </div>
      <IconButton
        className="add-reminder"
        icon="plus"
        label="Add reminder"
        onClick={() => edit(null)}
      />
      {error && !open && (
        <p className="timer-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Overlay modal label={editing ? 'Edit reminder' : 'New reminder'} onClose={close}>
          <h1>{editing ? 'Edit reminder' : 'New reminder'}</h1>
          <form
            className="reminder-form"
            onSubmit={(event) => {
              event.preventDefault();
              const dueAt = new Date(due).getTime();
              if (
                !message.trim() ||
                !Number.isFinite(dueAt) ||
                localInput(new Date(dueAt)) !== due
              ) {
                setError(
                  'Enter a message and a valid local date/time. Daylight-saving gaps cannot be scheduled.',
                );
                return;
              }
              setBusy(true);
              setError('');
              void dashboardStore
                .dispatch({
                  type: 'upsertReminder',
                  widgetId: widget.id,
                  expected: editing,
                  value: {
                    id: editing?.id ?? crypto.randomUUID(),
                    eventId: crypto.randomUUID(),
                    message: message.trim(),
                    dueAt,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    delivery: 'pending',
                  },
                })
                .then(close)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Reminder message
              <textarea
                required
                maxLength={20000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              Due date and time
              <input
                required
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <p className="confirm-copy">
              Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              Past times are shown as passed.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" className="small" onClick={close}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save reminder
              </button>
            </div>
          </form>
        </Overlay>
      )}
    </section>
  );
}
