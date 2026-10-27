import type { DashboardDocument } from '../state/model';
import { localDate } from '../timing/time';

/** Read existing records only. A completion count cannot establish focus duration. */
export function wellbeingSummary(
  document: DashboardDocument,
  now: number,
  timeZone: string,
  range: 1 | 7 | 30 = 7,
) {
  const today = localDate(now, timeZone);
  const end = Date.parse(`${today}T12:00:00Z`);
  const days = Array.from({ length: range }, (_, i) => {
    const at = end - (range - 1 - i) * 86400000;
    return {
      date: new Date(at).toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(at),
      sessions: 0,
      habits: 0,
    };
  });
  for (const widget of document.widgets) {
    if (widget.type === 'pomodoro')
      for (const record of widget.content.completedSessions) {
        if (record.finishedAt > now || record.finishedAt < end - (range + 1) * 86400000) continue;
        const day = days.find((day) => day.date === localDate(record.finishedAt, timeZone));
        if (day) day.sessions++;
      }
    if (widget.type === 'habit')
      for (const habit of widget.content.habits)
        for (const date of habit.dates) {
          const day = days.find((day) => day.date === date);
          if (day) day.habits++;
        }
  }
  return {
    days,
    sessions: days.reduce((total, day) => total + day.sessions, 0),
    habits: days.reduce((total, day) => total + day.habits, 0),
  };
}

/** Split actual running intervals at local calendar boundaries, including DST. */
export function wellbeingStats(
  document: DashboardDocument,
  now: number,
  timeZone: string,
  range: 1 | 7 | 30 = 7,
) {
  const legacy = wellbeingSummary(document, now, timeZone, range);
  const days = legacy.days.map((day) => ({
    ...day,
    workMs: 0,
    breakMs: 0,
    breaks: 0,
    recordedCompletions: 0,
  }));
  const h = document.wellbeingHistory;
  const cutoff = Math.max(0, now - (document.wellbeingSettings?.retentionDays ?? 90) * 86400000);
  const hourly = Array<number>(24).fill(0),
    hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' });
  const hours = (from: number, to: number) => {
    let cursor = from;
    while (cursor < to) {
      const hour = Number(hourFormat.format(cursor));
      let end = Math.min(to, cursor + 3600000);
      if (Number(hourFormat.format(end - 1)) !== hour) {
        let lo = cursor + 1,
          hi = end;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (Number(hourFormat.format(mid)) === hour) lo = mid + 1;
          else hi = mid;
        }
        end = lo;
      }
      hourly[hour] += end - cursor;
      cursor = end;
    }
  };
  const add = (from: number, to: number, phase: 'work' | 'break') => {
    let cursor = Math.max(from, cutoff);
    const end = Math.min(to, now);
    if (end <= cursor || end < Date.parse(days[0].date + 'T00:00:00Z') - 86400000) return;
    while (cursor < end) {
      const date = localDate(cursor, timeZone);
      let boundary = end;
      if (localDate(end - 1, timeZone) !== date) {
        let low = cursor + 1,
          high = end;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (localDate(middle, timeZone) === date) low = middle + 1;
          else high = middle;
        }
        boundary = low;
      }
      const day = days.find((d) => d.date === date);
      if (day) {
        if (phase === 'work') {
          day.workMs += boundary - cursor;
          hours(cursor, boundary);
        } else day.breakMs += boundary - cursor;
      }
      cursor = boundary;
    }
  };
  for (const e of h?.intervals ?? []) add(e.from, e.to, e.phase);
  for (const a of h?.active ?? []) add(a.from, Math.min(now, a.deadline), a.phase);
  for (const e of h?.completions ?? []) {
    if (e.at > now || e.at < cutoff) continue;
    const day = days.find((d) => d.date === localDate(e.at, timeZone));
    if (day) {
      if (e.phase === 'break') day.breaks++;
      else day.recordedCompletions++;
    }
  }
  return {
    days,
    hourly,
    workMs: days.reduce((n, d) => n + d.workMs, 0),
    breaks: days.reduce((n, d) => n + d.breaks, 0),
    habits: legacy.habits,
    sessions: legacy.sessions,
    recordedCompletions: days.reduce((n, d) => n + d.recordedCompletions, 0),
  };
}
export function sessionTime(ms: number) {
  return ms <= 0
    ? '0 min'
    : ms < 60000
      ? '<1 min'
      : ms < 3600000
        ? Math.floor(ms / 60000) + ' min'
        : Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
}
