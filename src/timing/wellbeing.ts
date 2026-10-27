import { defaultWellbeingSettings, emptyWellbeingHistory } from '../state/model';
import type { DashboardDocument, WellbeingActive } from '../state/model';

const bytes = (d: DashboardDocument) => new TextEncoder().encode(JSON.stringify(d)).length;
export function beginRecordingTimer(d: DashboardDocument, widgetId: string, now: number) {
  if (!d.wellbeingSettings?.recordingEnabled) return;
  const w = d.widgets.find((w) => w.id === widgetId);
  if (!w || w.type !== 'pomodoro' || w.content.status !== 'running' || w.content.deadline! <= now)
    return;
  const h = (d.wellbeingHistory ??= emptyWellbeingHistory()),
    t = w.content;
  const from = Math.max(
    now,
    d.wellbeingSettings?.startedAt ?? now,
    ...h.intervals.filter((e) => e.widgetId === widgetId).map((e) => e.to),
  );
  if (from < t.deadline! && !h.active.some((a) => a.widgetId === widgetId))
    h.active.push({
      widgetId,
      sessionId: t.sessionId!,
      phase: t.phase,
      from,
      deadline: t.deadline!,
      timeZone: t.timeZone,
    });
}
function closeInterval(d: DashboardDocument, a: WellbeingActive, now: number) {
  const h = d.wellbeingHistory!,
    end = Math.min(now, a.deadline);
  if (end > a.from) {
    const id = `${a.widgetId}:${a.sessionId}:${a.from}:${end}`;
    if (!h.intervals.some((e) => e.id === id))
      h.intervals.push({
        id,
        widgetId: a.widgetId,
        sessionId: a.sessionId,
        phase: a.phase,
        from: a.from,
        to: end,
        timeZone: a.timeZone,
      });
  }
  if (now >= a.deadline) {
    const id = `${a.widgetId}:${a.sessionId}:${a.phase}`;
    if (!h.completions.some((e) => e.id === id))
      h.completions.push({
        id,
        widgetId: a.widgetId,
        sessionId: a.sessionId,
        phase: a.phase,
        at: a.deadline,
        timeZone: a.timeZone,
      });
  }
}
// Called under the repository's document lock, before changing a timer.
export function settleRecording(
  d: DashboardDocument,
  now: number,
  widgetId?: string,
  dueOnly = false,
) {
  const h = d.wellbeingHistory;
  if (!h) return;
  h.active = h.active.filter((a) => {
    if ((widgetId && a.widgetId !== widgetId) || (dueOnly && a.deadline > now)) return true;
    closeInterval(d, a, now);
    return false;
  });
}
export function retainWellbeing(d: DashboardDocument, now: number) {
  const h = d.wellbeingHistory;
  if (!h) return;
  const cutoff = Math.max(
    0,
    now - (d.wellbeingSettings ?? defaultWellbeingSettings()).retentionDays * 86400000,
  );
  h.intervals = h.intervals
    .filter((e) => e.to > cutoff)
    .map((e) =>
      e.from < cutoff
        ? { ...e, from: cutoff, id: `${e.widgetId}:${e.sessionId}:${cutoff}:${e.to}` }
        : e,
    );
  h.completions = h.completions.filter((e) => e.at >= cutoff);
  // Cap memory and the shared document budget; disclose capacity-based removal.
  h.intervals.sort((a, b) => a.to - b.to);
  h.completions.sort((a, b) => a.at - b.at);
  while (h.intervals.length > 1000) {
    h.intervals.shift();
    h.storageLimited = true;
  }
  while (h.completions.length > 1000) {
    h.completions.shift();
    h.storageLimited = true;
  }
  while (bytes(d) > 2100000 && (h.intervals.length || h.completions.length)) {
    if ((h.intervals[0]?.to ?? Infinity) <= (h.completions[0]?.at ?? Infinity)) h.intervals.shift();
    else h.completions.shift();
    h.storageLimited = true;
  }
  if (bytes(d) > 2100000 && h.active.length) {
    h.active = [];
    h.storageLimited = true;
    if (d.wellbeingSettings) d.wellbeingSettings.recordingEnabled = false;
  }
}
export function reconcileRecording(d: DashboardDocument, now: number): boolean {
  if (!d.wellbeingHistory) return false;
  const before = JSON.stringify(d.wellbeingHistory);
  settleRecording(d, now, undefined, true);
  retainWellbeing(d, now);
  return before !== JSON.stringify(d.wellbeingHistory);
}
