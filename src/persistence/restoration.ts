import type { DashboardDocument } from '../state/model';
import { remainingMs } from '../timing/time';
export function safeReplacement(source: DashboardDocument, now = Date.now()): DashboardDocument {
    const doc = structuredClone(source);
    for (const widget of doc.widgets) {
        if (widget.type === 'pomodoro') {
            const t = widget.content;
            if (t.status === 'running') {t.remainingMs = Math.max(1,remainingMs(t,now));t.status='paused';t.deadline=null;}
            if (t.delivery === 'pending' || t.delivery === 'claimed') t.delivery='unavailable';
        }
        if (widget.type === 'reminder') for (const r of widget.content.reminders) if (r.dueAt<=now || r.delivery==='claimed') r.delivery='unavailable';
    }
    if (doc.wellbeingSettings) doc.wellbeingSettings.recordingEnabled=false;
    if (doc.wellbeingHistory) doc.wellbeingHistory.active=[];
    return doc;
}
