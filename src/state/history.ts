import type { DashboardDocument, Widget } from './model';
import type { Action } from './actions';
import { ConflictError } from './actions';
import { validateDashboard } from './validation';
import { remainingMs } from '../timing/time';

export interface Patch {
    widgetId?: string;
    field: 'theme' | 'zoom' | 'appearance' | 'typeAppearance' | 'presets' | 'layoutAssistance' | 'presentation' | 'background' | 'pinned' | 'widget' | 'title' | 'position' | 'size' | 'settings' | 'content';
    before: unknown;
    after: unknown;
}
export interface Change { before: DashboardDocument; after: DashboardDocument; }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Delivery is owned by the background worker, never by content history.
function comparable(value: unknown, patch: Pick<Patch, 'field'>): unknown {
    if (patch.field === 'widget' && value) {
        const w = structuredClone(value) as Widget;
        w.zIndex = 0;
        return w;
    }
    if (patch.field === 'content' && value && typeof value === 'object' && 'reminders' in value)
        return { reminders: (value as { reminders: Record<string, unknown>[] }).reminders.map(({ delivery, ...r }) => { void delivery; return r; }) };
    return value;
}
export function diff(before: DashboardDocument, after: DashboardDocument): Patch[] {
    const patches: Patch[] = [];
    for (const field of ['theme', 'zoom', 'appearance', 'background', 'typeAppearance', 'presets', 'layoutAssistance'] as const)
        if (!equal(before[field], after[field])) patches.push({ field, before: before[field], after: after[field] });
    for (const id of new Set([...before.widgets, ...after.widgets].map(w => w.id))) {
        const a = before.widgets.find(w => w.id === id), b = after.widgets.find(w => w.id === id);
        if (!a || !b) { patches.push({ widgetId: id, field: 'widget', before: a, after: b }); continue; }
        for (const field of ['title', 'position', 'size', 'settings', 'content', 'appearance', 'pinned', 'presentation'] as const) {
            if (field === 'content' && a.type === 'pomodoro') continue;
            if (!equal(comparable(a[field], { field }), comparable(b[field], { field })))
                patches.push({ widgetId: id, field, before: a[field], after: b[field] });
        }
    }
    return structuredClone(patches);
}
// Reinserted scheduled content must not replay an old OS notification.
function safeRestoredWidget(widget: Widget, now: number): Widget {
    if (widget.type === 'pomodoro') {
        const t = widget.content;
        if (t.status === 'running') { t.remainingMs = Math.max(1, remainingMs(t, now)); t.status = 'paused'; t.deadline = null; }
        if (t.delivery === 'pending' || t.delivery === 'claimed') t.delivery = 'unavailable';
    }
    if (widget.type === 'reminder')
        for (const r of widget.content.reminders) if (r.dueAt <= now || r.delivery === 'claimed') r.delivery = 'unavailable';
    return widget;
}
export function applyPatches(source: DashboardDocument, patches: Patch[], now = Date.now()): DashboardDocument {
    const next = structuredClone(source);
    for (const patch of patches) {
        if (!patch.widgetId) {
            if (patch.field !== 'theme' && patch.field !== 'zoom' && patch.field !== 'appearance' && patch.field !== 'background' && patch.field !== 'typeAppearance' && patch.field !== 'presets' && patch.field !== 'layoutAssistance') throw new ConflictError();
            if (!equal(next[patch.field], patch.before)) throw new ConflictError();
            if ((patch.field === 'typeAppearance' || patch.field === 'presets' || patch.field === 'layoutAssistance') && patch.after === undefined) delete next[patch.field];
            else Object.assign(next, { [patch.field]: structuredClone(patch.after) });
            continue;
        }
        const index = next.widgets.findIndex(w => w.id === patch.widgetId);
        const w = next.widgets[index];
        if (patch.field === 'widget') {
            if (!equal(comparable(w, patch), comparable(patch.before, patch))) throw new ConflictError();
            if (patch.after === undefined) next.widgets.splice(index, 1);
            else {
                const restored = safeRestoredWidget(structuredClone(patch.after) as Widget, now);
                if (w) next.widgets[index] = restored;
                else next.widgets.push(restored);
            }
        } else {
            if (!w || patch.field === 'theme' || patch.field === 'zoom' || patch.field === 'background' || patch.field === 'typeAppearance' || patch.field === 'presets' || patch.field === 'layoutAssistance' || !equal(comparable(w[patch.field], patch), comparable(patch.before, patch))) throw new ConflictError();
            if (w.pinned && (patch.field === 'position' || patch.field === 'size')) throw new ConflictError('This card is pinned. Unpin it before changing its layout.');
            const value = structuredClone(patch.after);
            if (w.type === 'reminder' && patch.field === 'content') {
                const restored = value as Extract<Widget, { type: 'reminder' }>['content'];
                for (const r of restored.reminders) {
                    const live = w.content.reminders.find(old => old.eventId === r.eventId);
                    r.delivery = live?.delivery ?? (r.dueAt <= now ? 'unavailable' : r.delivery === 'claimed' ? 'unavailable' : r.delivery);
                }
            }
            if (patch.field === 'presentation' && value === undefined) delete w.presentation;
            else Object.assign(w, { [patch.field]: value });
            if (w.type === 'pomodoro' && patch.field === 'settings' && w.content.status === 'idle')
                w.content.remainingMs = (w.content.phase === 'work' ? w.settings.workMinutes : w.settings.breakMinutes) * 60000;
        }
    }
    next.revision++;
    return validateDashboard(next);
}
export const reverse = (patches: Patch[]) => patches.map(p => ({ ...p, before: p.after, after: p.before }));
interface Entry { patches: Patch[]; key: string; at: number; }
export class History {
    undo: Entry[] = [];
    redo: Entry[] = [];
    record(change: Change, action: Action, at = Date.now()) {
        if (action.type === 'front' || action.type === 'timer') return;
        const patches = diff(change.before, change.after);
        if (!patches.length) return;
        const key = ['text', 'rename', 'editTask', 'imageCaption', 'weatherCity', 'zoom'].includes(action.type) ? JSON.stringify([action.type, 'widgetId' in action ? action.widgetId : '', 'taskId' in action ? action.taskId : '']) : '';
        const last = this.undo.at(-1);
        if (key && last?.key === key && at - last.at < 1200 && last.patches.length === patches.length && last.patches.every((p, i) => p.widgetId === patches[i].widgetId && p.field === patches[i].field && equal(p.after, patches[i].before))) {
            last.patches.forEach((p, i) => p.after = patches[i].after); last.at = at;
        } else this.undo.push({ patches, key, at });
        this.redo = [];
        // Bound both entry count and retained document/image metadata memory.
        while (this.undo.length > 50 || (this.undo.length > 1 && JSON.stringify(this.undo).length > 8000000)) this.undo.shift();
    }
    complete(direction: 'undo' | 'redo', change: Change) {
        this[direction].pop();
        const target = direction === 'undo' ? this.redo : this.undo;
        target.push({ patches: direction === 'undo' ? diff(change.after, change.before) : diff(change.before, change.after), key: '', at: 0 });
    }
    clear() { this.undo = []; this.redo = []; }
}
