import { validateLegacy, InvalidDataError } from './legacy-validation';
import type { DashboardDocument, TimerContent, Reminder } from './model';
import { emptyAppearance, emptyBackground, CLOCK_STYLES, NOTE_SKINS, WIDGET_TYPES } from './model';
export { InvalidDataError } from './legacy-validation';
function fail(): never { throw new InvalidDataError('Invalid timer, reminder or dashboard data.'); }
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const exact = (v: Record<string, unknown>, keys: string[]) => { if (Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k)))
    fail(); };
const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const timestamp = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;
const bounded = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const zones = new Map<string, boolean>();
export function validTimeZone(v: unknown): v is string { if (typeof v !== 'string' || v.length > 100)
    return false; if (zones.has(v))
    return zones.get(v)!; try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    zones.set(v, true);
    return true;
}
catch {
    zones.set(v, false);
    return false;
} }
const deliveries = ['none', 'pending', 'claimed', 'delivered', 'unavailable', 'failed'];
function timer(input: unknown): TimerContent {
    const c = obj(input);
    exact(c, ['phase', 'status', 'sessionId', 'deadline', 'remainingMs', 'timeZone', 'completedSessions', 'delivery']);
    if (!['work', 'break'].includes(String(c.phase)) || typeof c.phase !== 'string' || !['idle', 'running', 'paused', 'finished'].includes(String(c.status)) || typeof c.status !== 'string' || (!bounded(c.remainingMs, 0, 86400000) || !Number.isInteger(c.remainingMs)) || !validTimeZone(c.timeZone) || typeof c.delivery !== 'string' || !deliveries.includes(c.delivery))
        fail();
    if (c.sessionId !== null && !id(c.sessionId))
        fail();
    if (c.deadline !== null && !timestamp(c.deadline))
        fail();
    if (c.status === 'running' && (c.deadline === null || c.sessionId === null || c.remainingMs === 0))
        fail();
    if (c.status !== 'running' && c.deadline !== null)
        fail();
    if (c.status === 'idle' && c.sessionId !== null)
        fail();
    if (['paused', 'finished'].includes(String(c.status)) && c.sessionId === null)
        fail();
    if (c.status === 'paused' && c.remainingMs === 0)
        fail();
    if (c.status === 'finished' && c.remainingMs !== 0)
        fail();
    if (c.status !== 'finished' && c.delivery !== 'none')
        fail();
    if (!Array.isArray(c.completedSessions) || c.completedSessions.length > 10000)
        fail();
    const ids = new Set();
    for (const record of c.completedSessions) {
        const r = obj(record);
        exact(r, ['id', 'finishedAt', 'timeZone']);
        if (!id(r.id) || !timestamp(r.finishedAt) || !validTimeZone(r.timeZone) || ids.has(r.id))
            fail();
        ids.add(r.id);
    }
    return c as unknown as TimerContent;
}
function reminders(input: unknown): Reminder[] {
    const c = obj(input);
    exact(c, ['reminders']);
    if (!Array.isArray(c.reminders) || c.reminders.length > 100)
        fail();
    const ids = new Set();
    const events = new Set();
    for (const input of c.reminders) {
        const r = obj(input);
        exact(r, ['id', 'eventId', 'message', 'dueAt', 'timeZone', 'delivery']);
        if (!id(r.id) || !id(r.eventId) || ids.has(r.id) || events.has(r.eventId) || typeof r.message !== 'string' || !r.message.trim() || r.message.length > 20000 || !timestamp(r.dueAt) || !validTimeZone(r.timeZone) || typeof r.delivery !== 'string' || !deliveries.slice(1).includes(r.delivery))
            fail();
        ids.add(r.id);
        events.add(r.eventId);
    }
    return c.reminders as Reminder[];
}
function validateV2(input: unknown): Record<string, unknown> {
    const d = obj(input);
    if (d.schemaVersion !== 2)
        fail();
    if (new TextEncoder().encode(JSON.stringify(d)).length > 2000000)
        throw new InvalidDataError('Dashboard exceeds the 2 MB document limit.');
    const legacy = structuredClone(d);
    legacy.schemaVersion = 1;
    if (!Array.isArray(legacy.widgets))
        fail();
    for (const input of legacy.widgets) {
        const w = obj(input);
        if (w.type === 'pomodoro') {
            const c = timer(w.content);
            w.content = { phase: c.phase, remainingMs: c.remainingMs, completedSessions: c.completedSessions.map(r => r.id) };
            const s = obj(w.settings);
            if (!Number.isInteger(s.workMinutes) || !Number.isInteger(s.breakMinutes))
                fail();
        }
        if (w.type === 'reminder') {
            reminders(w.content);
            w.content = { message: '', dueAt: null, timeZone: 'UTC' };
        }
    }
    validateLegacy(legacy);
    return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}
function appearance(input: unknown) {
    const a = obj(input);
    const required = ['borderColor', 'backgroundColor', 'borderWidth', 'corners', 'shadow'];
    const enums: Record<string, readonly string[]> = {
        fontFamily: ['system', 'sans', 'serif', 'mono', 'handwritten'], headingWeight: ['regular', 'medium', 'bold'],
        surface: ['solid', 'glass'], padding: ['compact', 'comfortable', 'spacious'],
        titleVisibility: ['visible', 'hidden'], titleAlignment: ['left', 'center', 'right'], controlsVisibility: ['always', 'hover'],
    };
    const ranges: Record<string, [number, number]> = { textSize: [10, 24], lineSpacing: [1, 2.2], backgroundOpacity: [0, 100], backgroundBlur: [0, 32] };
    if (required.some(k => !Object.hasOwn(a, k)) || Object.keys(a).some(k => !required.includes(k) && !Object.hasOwn(enums, k) && !Object.hasOwn(ranges, k))) fail();
    for (const [key, options] of Object.entries(enums)) if (Object.hasOwn(a, key) && a[key] !== null && (typeof a[key] !== 'string' || !options.includes(a[key] as string))) fail();
    for (const [key, [min, max]] of Object.entries(ranges)) if (Object.hasOwn(a, key) && a[key] !== null && !bounded(a[key], min, max)) fail();
    for (const key of ['borderColor', 'backgroundColor']) if (a[key] !== null && (typeof a[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(a[key] as string))) fail();
    if (a.borderWidth !== null && !['thin', 'medium', 'thick'].includes(String(a.borderWidth))) fail();
    if (a.corners !== null && !['square', 'rounded', 'soft'].includes(String(a.corners))) fail();
    if (a.shadow !== null && !['none', 'soft', 'lifted'].includes(String(a.shadow))) fail();
    for (const key of ['borderWidth', 'corners', 'shadow']) if (a[key] !== null && typeof a[key] !== 'string') fail();
}
function validateV3(input: unknown): Record<string, unknown> {
    const d = obj(input);
    exact(d, ['schemaVersion', 'revision', 'theme', 'zoom', 'appearance', 'widgets']);
    if (d.schemaVersion !== 3 || new TextEncoder().encode(JSON.stringify(d)).length > 2100000 || !Array.isArray(d.widgets)) fail();
    appearance(d.appearance);
    const old = structuredClone(d); old.schemaVersion = 2; delete old.appearance;
    for (const item of old.widgets as unknown[]) {
        const w = obj(item);
        exact(w, ['id', 'type', 'title', 'position', 'size', 'zIndex', 'settings', 'content', 'appearance', 'pinned']);
        appearance(w.appearance);
        if (typeof w.pinned !== 'boolean') fail();
        delete w.appearance; delete w.pinned;
        // Date is a current-schema addition. Validate its empty data explicitly,
        // then reuse the legacy metadata checks without widening old formats.
        if (w.type === 'date') {
            exact(obj(w.content), []); exact(obj(w.settings), []);
            w.type = 'clock'; w.content = { timeZone: '' }; w.settings = { hour24: false };
        }
    }
    validateV2(old);
    return structuredClone(d);
}
export function validateDashboard(input: unknown): DashboardDocument {
    const d = obj(input);
    exact(d, ['schemaVersion', 'revision', 'theme', 'zoom', 'appearance', 'background', 'widgets', ...['typeAppearance', 'presets', 'layoutAssistance'].filter(key => Object.hasOwn(d, key))]);
    if (Object.hasOwn(d, 'presets')) {
        if (!Array.isArray(d.presets) || d.presets.length > 100) fail();
        const ids = new Set(), names = new Set();
        for (const value of d.presets) {
            const p = obj(value); exact(p, ['id', 'name', 'appearance']);
            if (!id(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || names.has(p.name.trim().toLowerCase())) fail();
            appearance(p.appearance); ids.add(p.id); names.add(p.name.trim().toLowerCase());
        }
    }
    if (Object.hasOwn(d, 'layoutAssistance')) {
        const l = obj(d.layoutAssistance); exact(l, ['snap', 'gridSize', 'guides']);
        if (typeof l.snap !== 'boolean' || typeof l.guides !== 'boolean' || !Number.isInteger(l.gridSize) || !bounded(l.gridSize, 4, 128)) fail();
    }
    if (Object.hasOwn(d, 'typeAppearance')) {
        const defaults = obj(d.typeAppearance);
        for (const [key, value] of Object.entries(defaults)) {
            if (!(WIDGET_TYPES as readonly string[]).includes(key)) fail();
            appearance(value);
        }
    }
    if (d.schemaVersion !== 4 || new TextEncoder().encode(JSON.stringify(d)).length > 2100000 || !Array.isArray(d.widgets)) fail();
    const bg = obj(d.background);
    exact(bg, ['assetId', 'fit', 'dim']);
    if ((bg.assetId !== null && !id(bg.assetId)) || !['cover', 'contain'].includes(String(bg.fit)) || typeof bg.fit !== 'string' || !Number.isInteger(bg.dim) || !bounded(bg.dim, 0, 80)) fail();
    const old = structuredClone(d); old.schemaVersion = 3; delete old.background; delete old.typeAppearance; delete old.presets; delete old.layoutAssistance;
    for (const item of old.widgets as unknown[]) {
        const w = obj(item);
        if (Object.hasOwn(w, 'presentation')) {
            const p = obj(w.presentation); exact(p, ['mode', 'collapsed']);
            if (typeof p.mode !== 'string' || !['full', 'compact', 'content-only'].includes(p.mode) || typeof p.collapsed !== 'boolean') fail();
            delete w.presentation;
        }
        if (w.type === 'video') w.type = 'image';
        // Optional skins extend v4 without rewriting existing documents or backups.
        if (w.type === 'sticky' && Object.hasOwn(obj(w.settings), 'workspace')) {
            const s = obj(w.settings); exact(s, ['color', 'workspace']);
            if (s.workspace !== 'ambient') fail();
            delete s.workspace;
        }
        if (w.type === 'clock' && Object.hasOwn(obj(w.settings), 'style')) {
            const s = obj(w.settings); exact(s, ['hour24', 'style']);
            if (typeof s.style !== 'string' || !(CLOCK_STYLES as readonly string[]).includes(s.style)) fail();
            delete s.style;
        }
        if (w.type === 'notes' && Object.hasOwn(obj(w.settings), 'skin')) {
            const s = obj(w.settings); exact(s, ['ruled', 'skin']);
            if (typeof s.skin !== 'string' || !(NOTE_SKINS as readonly string[]).includes(s.skin) || s.ruled !== (s.skin === 'lined')) fail();
            delete s.skin;
        }
    }
    validateV3(old);
    return structuredClone(d) as unknown as DashboardDocument;
}
export function migrateDashboard(input: unknown): DashboardDocument {
    let d = obj(input);
    if (d.schemaVersion === 0) {
        exact(d, ['schemaVersion', 'theme', 'zoom', 'widgets']);
        d = { ...d, schemaVersion: 1, revision: 0 };
    }
    if (d.schemaVersion === 1) {
        const old = validateLegacy(d);
        const migrated = structuredClone(old);
        migrated.schemaVersion = 2;
        for (const input of migrated.widgets as Record<string, unknown>[]) {
            const c = obj(input.content);
            if (input.type === 'pomodoro')
                input.content = { phase: c.phase, remainingMs: (c.remainingMs as number) > 0 ? Math.ceil(c.remainingMs as number) : Number(obj(input.settings)[c.phase === 'work' ? 'workMinutes' : 'breakMinutes']) * 60000, completedSessions: (c.completedSessions as string[]).map(id => ({ id, finishedAt: 0, timeZone: 'UTC' })), status: 'idle', sessionId: null, deadline: null, timeZone: 'UTC', delivery: 'none' };
            if (input.type === 'reminder')
                input.content = { reminders: c.dueAt === null || !(c.message as string).trim() ? [] : [{ id: 'legacy-reminder', eventId: 'legacy-event', message: c.message, dueAt: c.dueAt, timeZone: validTimeZone(c.timeZone) ? c.timeZone : 'UTC', delivery: 'pending' }] };
        }
        return migrateDashboard(migrated);
    }
    if (d.schemaVersion === 2) {
        const old = validateV2(d);
        return migrateDashboard({ ...old, schemaVersion: 3, appearance: emptyAppearance(), widgets: (old.widgets as Record<string, unknown>[]).map(w => ({ ...w, appearance: emptyAppearance(), pinned: false })) });
    }
    if (d.schemaVersion === 3) return validateDashboard({ ...validateV3(d), schemaVersion: 4, background: emptyBackground() });
    return validateDashboard(d);
}
export function decodeDashboard(raw: string): DashboardDocument {
    if (raw.length > 2100000)
        throw new InvalidDataError('Dashboard exceeds the document limit.');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new InvalidDataError('Saved dashboard is not valid JSON.');
    }
    return migrateDashboard(parsed);
}
