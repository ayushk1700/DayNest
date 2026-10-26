export type Delivery = 'none' | 'pending' | 'claimed' | 'delivered' | 'unavailable' | 'failed';
export interface TimerContent {
    phase: 'work' | 'break';
    status: 'idle' | 'running' | 'paused' | 'finished';
    sessionId: string | null;
    deadline: number | null;
    remainingMs: number;
    timeZone: string;
    completedSessions: {
        id: string;
        finishedAt: number;
        timeZone: string;
    }[];
    delivery: Delivery;
}
export interface Reminder {
    id: string;
    eventId: string;
    message: string;
    dueAt: number;
    timeZone: string;
    delivery: Exclude<Delivery, 'none'>;
}
export function idleTimer(): TimerContent { return { phase: 'work', status: 'idle', sessionId: null, deadline: null, remainingMs: 1500000, timeZone: 'UTC', completedSessions: [], delivery: 'none' }; }
export const THEMES = ['Warm Earth', 'Midnight', 'Ocean Breeze', 'Forest Green', 'Soft Sunset', 'Lavender', 'Paper & Ink', 'Sakura', 'Matcha', 'Nordic Snow', 'Vintage Sepia', 'Peach Cream'] as const;
export type RecommendedTheme = typeof THEMES[number];
// Retain old names in stored documents and history without forcing a rewrite.
export type Theme = RecommendedTheme | 'Dark Mode' | 'Sunset';
export function canonicalTheme(theme: Theme): RecommendedTheme { return theme === 'Dark Mode' ? 'Midnight' : theme === 'Sunset' ? 'Soft Sunset' : theme; }
export function isTheme(value: unknown): value is Theme { return typeof value === 'string' && ((THEMES as readonly string[]).includes(value) || value === 'Dark Mode' || value === 'Sunset'); }
export interface CardAppearance {
    borderColor: string | null;
    backgroundColor: string | null;
    borderWidth: 'thin' | 'medium' | 'thick' | null;
    corners: 'square' | 'rounded' | 'soft' | null;
    shadow: 'none' | 'soft' | 'lifted' | null;
    fontFamily?: 'system' | 'sans' | 'serif' | 'mono' | 'handwritten' | null;
    textSize?: number | null;
    headingWeight?: 'regular' | 'medium' | 'bold' | null;
    lineSpacing?: number | null;
    surface?: 'solid' | 'glass' | null;
    backgroundOpacity?: number | null;
    backgroundBlur?: number | null;
    padding?: 'compact' | 'comfortable' | 'spacious' | null;
    titleVisibility?: 'visible' | 'hidden' | null;
    titleAlignment?: 'left' | 'center' | 'right' | null;
    controlsVisibility?: 'always' | 'hover' | null;
}
export const emptyAppearance = (): CardAppearance => ({ borderColor: null, backgroundColor: null, borderWidth: null, corners: null, shadow: null });
export const cardDefaults = () => ({ appearance: emptyAppearance(), pinned: false });
export interface AppearancePreset { id: string; name: string; appearance: CardAppearance; }
export interface LayoutAssistance { snap: boolean; gridSize: number; guides: boolean; }
export const defaultLayoutAssistance = (): LayoutAssistance => ({ snap: false, gridSize: 16, guides: true });
export interface Presentation { mode: 'full' | 'compact' | 'content-only'; collapsed: boolean; }
export const defaultPresentation = (): Presentation => ({ mode: 'full', collapsed: false });
export interface DashboardBackground { assetId: string | null; fit: 'cover' | 'contain'; dim: number; }
export const emptyBackground = (): DashboardBackground => ({ assetId: null, fit: 'cover', dim: 20 });
export interface Task {
    id: string;
    text: string;
    completed: boolean;
}
export const LINK_SHORTCUT_ICONS = ['link', 'search', 'music', 'calendar', 'notes', 'todo', 'weather', 'image', 'timer', 'habit', 'external', 'location'] as const;
export type LinkShortcutIcon = typeof LINK_SHORTCUT_ICONS[number];
export const LINK_SHORTCUT_COLORS = ['coral', 'amber', 'sage', 'sky', 'lavender', 'rose'] as const;
export type LinkShortcutColor = typeof LINK_SHORTCUT_COLORS[number];
export interface LinkShortcut { id: string; title: string; url: string; icon: LinkShortcutIcon; color: LinkShortcutColor; }
export interface LinkGroupContent { links: LinkShortcut[]; }
export type IdeaTone = 'paper' | 'sage' | 'sky' | 'sand' | 'rose' | 'lavender';
export interface IdeaNode { id: string; title: string; body: string; position: { x: number; y: number }; width?: number; height?: number; tone?: IdeaTone; }
export interface IdeaConnection { id: string; from: string; to: string; }
export interface ScratchpadContent { nodes: IdeaNode[]; connections: IdeaConnection[]; }
export interface WellbeingSettings {
    dailyBreakGoal?: number | null; recordingEnabled: boolean; retentionDays: 30 | 90; startedAt: number | null; }
export const defaultWellbeingSettings = (): WellbeingSettings => ({ recordingEnabled: false, retentionDays: 90, startedAt: null });
export interface ContentMap {
    music: Record<string, never>;
    linkGroup: LinkGroupContent;
    scratchpad: ScratchpadContent;
    wellbeing: Record<string, never>;
    video: { assetId: string | null; caption: string };
    date: Record<string, never>;
    todo: {
        tasks: Task[];
    };
    notes: {
        text: string;
    };
    sticky: {
        text: string;
    };
    pomodoro: TimerContent;
    reminder: {
        reminders: Reminder[];
    };
    clock: {
        timeZone: string;
    };
    habit: {
        habits: {
            id: string;
            name: string;
            dates: string[];
        }[];
    };
    image: {
        assetId: string | null;
        caption: string;
    };
    calendar: {
        events: {
            id: string;
            date: string;
            title: string;
        }[];
    };
    weather: {
        city: string;
        provider: string | null;
    };
}
export const CLOCK_STYLES = ['simple', 'digital', 'analog'] as const;
export type ClockStyle = typeof CLOCK_STYLES[number];
export const NOTE_SKINS = ['plain', 'lined', 'grid', 'dotted', 'kraft'] as const;
export type NoteSkin = typeof NOTE_SKINS[number];
export function noteSkin(settings: { ruled: boolean; skin?: NoteSkin }): NoteSkin { return settings.skin ?? (settings.ruled ? 'lined' : 'plain'); }
export interface SettingsMap {
    music: Record<string, never>;
    linkGroup: Record<string, never>;
    scratchpad: Record<string, never>;
    wellbeing: Record<string, never>;
    video: { fit: 'cover' | 'contain' };
    date: Record<string, never>;
    todo: {
        showCompleted: boolean;
    };
    notes: {
        ruled: boolean;
        skin?: NoteSkin;
    };
    sticky: {
        color: 'yellow' | 'pink' | 'green';
        workspace?: 'ambient';
    };
    pomodoro: {
        workMinutes: number;
        breakMinutes: number;
    };
    reminder: {
        notify: boolean;
    };
    clock: {
        hour24: boolean;
        style?: ClockStyle;
    };
    habit: {
        weekStartsOn: 0 | 1;
    };
    image: {
        fit: 'cover' | 'contain';
    };
    calendar: {
        weekStartsOn: 0 | 1;
    };
    weather: {
        units: 'celsius' | 'fahrenheit';
    };
}
export type WidgetType = keyof ContentMap;
export const WIDGET_TYPES = ['video', 'date', 'todo', 'notes', 'sticky', 'pomodoro', 'reminder', 'clock', 'habit', 'image', 'calendar', 'weather', 'scratchpad', 'wellbeing', 'music', 'linkGroup'] as const satisfies readonly WidgetType[];
export type Widget = {
    [K in WidgetType]: {
        id: string;
        type: K;
        title: string;
        position: {
            x: number;
            y: number;
        };
        size: {
            width: number;
            height: number;
        };
        zIndex: number;
        appearance: CardAppearance;
        pinned: boolean;
        presentation?: Presentation;
        settings: SettingsMap[K];
        content: ContentMap[K];
    };
}[WidgetType];
export const isAmbientNote = (widget: Widget): boolean => widget.type === 'sticky' && widget.settings.workspace === 'ambient';
export interface DashboardDocument {
    schemaVersion: 8;
    revision: number;
    theme: Theme;
    zoom: number;
    appearance: CardAppearance;
    typeAppearance?: Partial<Record<WidgetType, CardAppearance>>;
    presets?: AppearancePreset[];
    layoutAssistance?: LayoutAssistance;
    background: DashboardBackground;
    wellbeingSettings?: WellbeingSettings;
    wellbeingHistory?: WellbeingHistory;
    widgets: Widget[];
}
export function seedDashboard(): DashboardDocument {
    return { schemaVersion: 8, revision: 0, theme: 'Ocean Breeze', zoom: 1, appearance: emptyAppearance(), background: emptyBackground(), widgets: [
            { ...cardDefaults(), id: 'todo-initial', type: 'todo', title: 'Todo List', position: { x: 58, y: 84 }, size: { width: 356, height: 486 }, zIndex: 0, settings: { showCompleted: true }, content: { tasks: [{ id: 'task-initial', text: 'Be happy', completed: false }] } },
            { ...cardDefaults(), id: 'notes-initial', type: 'notes', title: 'Notes (titles are changeable)', position: { x: 490, y: 122 }, size: { width: 469, height: 375 }, zIndex: 1, settings: { ruled: false }, content: { text: 'DayNest - track everything on one page!' } },
            { ...cardDefaults(), id: 'pomodoro-initial', type: 'pomodoro', title: 'Pomodoro Timer', position: { x: 996, y: 122 }, size: { width: 319, height: 263 }, zIndex: 2, settings: { workMinutes: 25, breakMinutes: 5 }, content: idleTimer() },
            { ...cardDefaults(), id: 'sticky-initial', type: 'sticky', title: 'Sticky Note', position: { x: 845, y: 415 }, size: { width: 150, height: 150 }, zIndex: 3, settings: { color: 'yellow' }, content: { text: 'Keep track of your scattered thoughts - stickies can go anywhere!' } },
        ] };
}

export interface WellbeingInterval { id: string; widgetId: string; sessionId: string; phase: 'work' | 'break'; from: number; to: number; timeZone: string; }
export interface WellbeingCompletion { id: string; widgetId: string; sessionId: string; phase: 'work' | 'break'; at: number; timeZone: string; }
export interface WellbeingActive { widgetId: string; sessionId: string; phase: 'work' | 'break'; from: number; deadline: number; timeZone: string; }
export interface WellbeingHistory { intervals: WellbeingInterval[]; completions: WellbeingCompletion[]; active: WellbeingActive[]; storageLimited: boolean; }
export const emptyWellbeingHistory = (): WellbeingHistory => ({intervals:[],completions:[],active:[],storageLimited:false});
