import { isTheme } from './model';
export class InvalidDataError extends Error {
}
const fail = (message: string): never => { throw new InvalidDataError(message); };
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail('Expected an object.');
const keys = (v: Record<string, unknown>, names: string[]) => {
    if (Object.keys(v).some(k => !names.includes(k)) || names.some(k => !(k in v)))
        fail('Unexpected or missing fields.');
};
const str = (v: unknown, max = 100000): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => num(v, min, max) && Number.isSafeInteger(v);
const list = (v: unknown, max: number): unknown[] => Array.isArray(v) && v.length <= max ? v : fail('Invalid or oversized list.');
const unique = (values: unknown[]) => {
    if (new Set(values).size !== values.length)
        fail('Duplicate IDs or dates.');
};
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function validateLegacy(input: unknown): Record<string, unknown> {
    const d = object(input);
    keys(d, ['schemaVersion', 'revision', 'theme', 'zoom', 'widgets']);
    if (d.schemaVersion !== 1 || !integer(d.revision, 0) || !isTheme(d.theme) || !num(d.zoom, .25, 2))
        fail('Invalid dashboard version, revision or preferences.');
    const widgets = list(d.widgets, 100);
    unique(widgets.map(w => object(w).id));
    for (const value of widgets) {
        const w = object(value);
        keys(w, ['id', 'type', 'title', 'position', 'size', 'zIndex', 'settings', 'content']);
        const p = object(w.position), s = object(w.size), c = object(w.content), settings = object(w.settings);
        keys(p, ['x', 'y']);
        keys(s, ['width', 'height']);
        if (!id(w.id) || !str(w.title, 200) || !num(p.x, -100000, 100000) || !num(p.y, -100000, 100000) || !num(s.width, 100, 5000) || !num(s.height, 100, 5000) || !integer(w.zIndex, 0, 1000000))
            fail('Invalid widget metadata.');
        let valid = false;
        switch (w.type) {
            case 'todo': {
                keys(c, ['tasks']);
                keys(settings, ['showCompleted']);
                const tasks = list(c.tasks, 500);
                unique(tasks.map(t => object(t).id));
                valid = typeof settings.showCompleted === 'boolean' && tasks.every(t => { const task = object(t); keys(task, ['id', 'text', 'completed']); return id(task.id) && str(task.text, 20000) && task.text.trim().length > 0 && typeof task.completed === 'boolean'; });
                break;
            }
            case 'notes':
                keys(c, ['text']);
                keys(settings, ['ruled']);
                valid = str(c.text) && typeof settings.ruled === 'boolean';
                break;
            case 'sticky':
                keys(c, ['text']);
                keys(settings, ['color']);
                valid = str(c.text, 20000) && typeof settings.color === 'string' && ['yellow', 'pink', 'green'].includes(settings.color);
                break;
            case 'pomodoro':
                keys(c, ['phase', 'remainingMs', 'completedSessions']);
                keys(settings, ['workMinutes', 'breakMinutes']);
                valid = typeof c.phase === 'string' && ['work', 'break'].includes(c.phase) && num(c.remainingMs, 0, 86400000) && list(c.completedSessions, 10000).every(v => id(v)) && num(settings.workMinutes, 1, 240) && num(settings.breakMinutes, 1, 120);
                unique(list(c.completedSessions, 10000));
                break;
            case 'reminder':
                keys(c, ['message', 'dueAt', 'timeZone']);
                keys(settings, ['notify']);
                valid = str(c.message, 20000) && (c.dueAt === null || num(c.dueAt, 0, 8640000000000000)) && str(c.timeZone, 100) && typeof settings.notify === 'boolean';
                break;
            case 'clock':
                keys(c, ['timeZone']);
                keys(settings, ['hour24']);
                valid = str(c.timeZone, 100) && typeof settings.hour24 === 'boolean';
                break;
            case 'habit': {
                keys(c, ['habits']);
                keys(settings, ['weekStartsOn']);
                const habits = list(c.habits, 100);
                unique(habits.map(h => object(h).id));
                valid = [0, 1].includes(Number(settings.weekStartsOn)) && typeof settings.weekStartsOn === 'number' && habits.every(h => { const habit = object(h); keys(habit, ['id', 'name', 'dates']); const dates = list(habit.dates, 10000); unique(dates); return id(habit.id) && str(habit.name, 200) && dates.every(date); });
                break;
            }
            case 'image':
                keys(c, ['assetId', 'caption']);
                keys(settings, ['fit']);
                valid = (c.assetId === null || id(c.assetId)) && str(c.caption, 2000) && typeof settings.fit === 'string' && ['cover', 'contain'].includes(settings.fit);
                break;
            case 'calendar': {
                keys(c, ['events']);
                keys(settings, ['weekStartsOn']);
                const events = list(c.events, 1000);
                unique(events.map(e => object(e).id));
                valid = typeof settings.weekStartsOn === 'number' && [0, 1].includes(settings.weekStartsOn) && events.every(e => { const event = object(e); keys(event, ['id', 'date', 'title']); return id(event.id) && date(event.date) && str(event.title, 200); });
                break;
            }
            case 'weather':
                keys(c, ['city', 'provider']);
                keys(settings, ['units']);
                valid = str(c.city, 200) && (c.provider === null || id(c.provider)) && typeof settings.units === 'string' && ['celsius', 'fahrenheit'].includes(settings.units);
                break;
            default: fail('Unknown widget type.');
        }
        if (!valid)
            fail('Invalid widget content or settings.');
    }
    if (new TextEncoder().encode(JSON.stringify(d)).length > 2000000)
        fail('Dashboard exceeds the 2 MB document limit.');
    // Return an isolated JSON value; callers cannot mutate the validated source accidentally.
    return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}
