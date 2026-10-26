import type { DashboardDocument, Widget, ClockStyle, NoteSkin, LinkShortcut } from './model';
import { noteSkin } from './model';
export type Habit = Extract<Widget, {
    type: 'habit';
}>['content']['habits'][number];
export type CalendarEvent = Extract<Widget, {
    type: 'calendar';
}>['content']['events'][number];
export type LocalAction = {
    type: 'clockStyle'; widgetId: string; expected: ClockStyle; value: ClockStyle;
} | {
    type: 'notesSkin'; widgetId: string; expected: NoteSkin; value: NoteSkin;
} | {
    type: 'calendarWeekStart'; widgetId: string; expected: 0 | 1; value: 0 | 1;
} | {
    type: 'clockFormat';
    widgetId: string;
    expected: boolean;
    value: boolean;
} | {
    type: 'habitAdd';
    widgetId: string;
    value: Habit;
} | {
    type: 'habitToggle';
    widgetId: string;
    habitId: string;
    date: string;
    expected: boolean;
    value: boolean;
} | {
    type: 'habitDelete';
    widgetId: string;
    expected: Habit;
} | {
    type: 'calendarUpsert';
    widgetId: string;
    expected: CalendarEvent | null;
    value: CalendarEvent;
} | {
    type: 'calendarDelete';
    widgetId: string;
    expected: CalendarEvent;
} | {
    type: 'linkShortcutUpsert';
    widgetId: string;
    expected: LinkShortcut | null;
    value: LinkShortcut;
} | {
    type: 'linkShortcutDelete';
    widgetId: string;
    expected: LinkShortcut;
} | {
    type: 'imageAsset';
    widgetId: string;
    expected: string | null;
    value: string | null;
} | {
    type: 'imageCaption';
    widgetId: string;
    expected: string;
    value: string;
} | {
    type: 'imageFit';
    widgetId: string;
    expected: 'cover' | 'contain';
    value: 'cover' | 'contain';
} | {
    type: 'weatherUnits';
    widgetId: string;
    expected: 'celsius' | 'fahrenheit';
    value: 'celsius' | 'fahrenheit';
} | {
    type: 'weatherCity';
    widgetId: string;
    expected: string;
    value: string;
};
export function applyLocal(doc: DashboardDocument, action: LocalAction, conflict: () => never): void {
    const w = doc.widgets.find(w => w.id === action.widgetId);
    if (!w)
        return conflict();
    const expect = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b))
        conflict(); };
    if (action.type === 'clockStyle') {
        if (w.type !== 'clock') return conflict();
        expect(w.settings.style ?? 'simple', action.expected);
        w.settings.style = action.value; return;
    }
    if (action.type === 'notesSkin') {
        if (w.type !== 'notes') return conflict();
        expect(noteSkin(w.settings), action.expected);
        w.settings.skin = action.value; w.settings.ruled = action.value === 'lined'; return;
    }
    if (action.type === 'calendarWeekStart') {
        if (w.type !== 'calendar') return conflict();
        expect(w.settings.weekStartsOn, action.expected);
        w.settings.weekStartsOn = action.value; return;
    }
    if (action.type === 'clockFormat') {
        if (w.type !== 'clock')
            return conflict();
        expect(w.settings.hour24, action.expected);
        w.settings.hour24 = action.value;
        return;
    }
    if (action.type === 'weatherCity') {
        if (w.type !== 'weather')
            return conflict();
        expect(w.content.city, action.expected);
        w.content.city = action.value;
        return;
    }
    if (action.type === 'weatherUnits') {
        if (w.type !== 'weather') return conflict();
        expect(w.settings.units, action.expected);
        w.settings.units = action.value;
        return;
    }
    if (action.type === 'imageAsset') {
        if (w.type !== 'image' && w.type !== 'video')
            return conflict();
        expect(w.content.assetId, action.expected);
        w.content.assetId = action.value;
        return;
    }
    if (action.type === 'imageCaption') {
        if (w.type !== 'image' && w.type !== 'video')
            return conflict();
        expect(w.content.caption, action.expected);
        w.content.caption = action.value;
        return;
    }
    if (action.type === 'imageFit') {
        if (w.type !== 'image' && w.type !== 'video')
            return conflict();
        expect(w.settings.fit, action.expected);
        w.settings.fit = action.value;
        return;
    }
    if (action.type === 'habitAdd') {
        if (w.type !== 'habit')
            return conflict();
        if (w.content.habits.some(h => h.id === action.value.id))
            return conflict();
        w.content.habits.push(action.value);
        return;
    }
    if (action.type === 'habitToggle') {
        if (w.type !== 'habit')
            return conflict();
        const habit = w.content.habits.find(h => h.id === action.habitId);
        if (!habit)
            return conflict();
        expect(habit.dates.includes(action.date), action.expected);
        habit.dates = action.value ? [...habit.dates, action.date].sort() : habit.dates.filter(d => d !== action.date);
        return;
    }
    if (action.type === 'habitDelete') {
        if (w.type !== 'habit')
            return conflict();
        const i = w.content.habits.findIndex(h => h.id === action.expected.id);
        if (i < 0)
            return conflict();
        expect(w.content.habits[i], action.expected);
        w.content.habits.splice(i, 1);
        return;
    }
    if (action.type === 'linkShortcutUpsert' || action.type === 'linkShortcutDelete') {
        if (w.type !== 'linkGroup') return conflict();
        if (action.type === 'linkShortcutDelete') {
            const i = w.content.links.findIndex(link => link.id === action.expected.id);
            if (i < 0) return conflict();
            expect(w.content.links[i], action.expected);
            w.content.links.splice(i, 1);
            return;
        }
        const i = w.content.links.findIndex(link => link.id === action.value.id);
        if (action.expected === null) {
            if (i >= 0) return conflict();
            w.content.links.push(action.value);
        } else {
            if (i < 0) return conflict();
            expect(w.content.links[i], action.expected);
            w.content.links[i] = action.value;
        }
        return;
    }
    if (w.type !== 'calendar')
        return conflict();
    if (action.type === 'calendarDelete') {
        const i = w.content.events.findIndex(e => e.id === action.expected.id);
        if (i < 0)
            return conflict();
        expect(w.content.events[i], action.expected);
        w.content.events.splice(i, 1);
        return;
    }
    const i = w.content.events.findIndex(e => e.id === action.value.id);
    if (action.expected === null) {
        if (i >= 0)
            return conflict();
        w.content.events.push(action.value);
    }
    else {
        if (i < 0)
            return conflict();
        expect(w.content.events[i], action.expected);
        w.content.events[i] = action.value;
    }
}
