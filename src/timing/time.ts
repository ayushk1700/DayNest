import { reconcileRecording } from './wellbeing';
import type { DashboardDocument, TimerContent, Delivery } from '../state/model';
export function remainingMs(timer: TimerContent, now: number): number {
  return timer.status === 'running' ? Math.max(0, timer.deadline! - now) : timer.remainingMs;
}
const dateFormats = new Map<string, Intl.DateTimeFormat>();
export function localDate(at: number, timeZone: string): string {
  if (!dateFormats.has(timeZone))
    dateFormats.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    );
  const parts = dateFormats.get(timeZone)!.formatToParts(new Date(at));
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join('-');
}
export function completedToday(timer: TimerContent, now: number, timeZone: string): number {
  const today = localDate(now, timeZone);
  return timer.completedSessions.filter((r) => localDate(r.finishedAt, timeZone) === today).length;
}
export function reconcileDue(doc: DashboardDocument, now: number): boolean {
  let changed = reconcileRecording(doc, now);
  for (const w of doc.widgets)
    if (w.type === 'pomodoro' && w.content.status === 'running' && w.content.deadline! <= now) {
      const t = w.content;
      if (t.phase === 'work' && !t.completedSessions.some((r) => r.id === t.sessionId))
        t.completedSessions = [
          ...t.completedSessions,
          { id: t.sessionId!, finishedAt: t.deadline!, timeZone: t.timeZone },
        ].slice(-10000);
      t.status = 'finished';
      t.deadline = null;
      t.remainingMs = 0;
      t.delivery = 'pending';
      changed = true;
    }
  return changed;
}
export interface PendingEvent {
  id: string;
  widgetId: string;
  title: string;
  message: string;
  notify: boolean;
}
export function pendingEvents(doc: DashboardDocument, now: number): PendingEvent[] {
  const events: PendingEvent[] = [];
  for (const w of doc.widgets) {
    if (
      w.type === 'pomodoro' &&
      w.content.status === 'finished' &&
      w.content.delivery === 'pending'
    )
      events.push({
        id: `timer:${w.id}:${w.content.sessionId}`,
        widgetId: w.id,
        title: w.content.phase === 'work' ? 'Work session complete' : 'Break complete',
        message: w.title,
        notify: true,
      });
    if (w.type === 'reminder')
      for (const r of w.content.reminders)
        if (r.dueAt <= now && r.delivery === 'pending')
          events.push({
            id: `reminder:${w.id}:${r.eventId}`,
            widgetId: w.id,
            title: w.title || 'Reminder',
            message: r.message,
            notify: w.settings.notify,
          });
  }
  return events;
}
export function setDelivery(
  doc: DashboardDocument,
  eventId: string,
  expected: Delivery,
  value: Delivery,
): boolean {
  for (const w of doc.widgets) {
    if (
      w.type === 'pomodoro' &&
      `timer:${w.id}:${w.content.sessionId}` === eventId &&
      w.content.delivery === expected
    ) {
      w.content.delivery = value;
      return true;
    }
    if (w.type === 'reminder')
      for (const r of w.content.reminders)
        if (
          `reminder:${w.id}:${r.eventId}` === eventId &&
          r.delivery === expected &&
          value !== 'none'
        ) {
          r.delivery = value;
          return true;
        }
  }
  return false;
}
export function nextDeadline(doc: DashboardDocument): number | null {
  const times: number[] = [];
  for (const w of doc.widgets) {
    if (w.type === 'pomodoro' && w.content.status === 'running') times.push(w.content.deadline!);
    if (w.type === 'reminder')
      for (const r of w.content.reminders) if (r.delivery === 'pending') times.push(r.dueAt);
  }
  return times.length ? Math.min(...times) : null;
}
