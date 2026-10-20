import { applyLocal } from './local-actions';
import type { LocalAction } from './local-actions';
import { applyWorkspace } from './workspace-actions';
import type { WorkspaceAction } from './workspace-actions';
import type { DashboardDocument, Task, Widget, WidgetType, Theme, CardAppearance, DashboardBackground } from './model';
import { emptyAppearance, WIDGET_TYPES } from './model';
import { validateDashboard } from './validation';
import { applyStyleAction } from './style-actions';
import type { StyleAction } from './style-actions';
export class ConflictError extends Error {
    constructor(message = 'The saved content changed. Your change was not applied.') { super(message); }
}
export type ContentAction = {
    type: 'rename';
    widgetId: string;
    expected: string;
    value: string;
} | {
    type: 'text';
    widgetId: string;
    expected: string;
    value: string;
} | {
    type: 'addTask';
    widgetId: string;
    task: Task;
} | {
    type: 'editTask';
    widgetId: string;
    taskId: string;
    expected: string;
    value: string;
} | {
    type: 'toggleTask';
    widgetId: string;
    taskId: string;
    expected: boolean;
    value: boolean;
} | {
    type: 'deleteTask';
    widgetId: string;
    taskId: string;
    expected: Task;
} | {
    type: 'clearTasks';
    widgetId: string;
    expected: Task[];
} | {
    type: 'deleteWidget';
    widgetId: string;
    expected: Widget;
} | {
    type: 'stickyColor';
    widgetId: string;
    expected: string;
    value: 'yellow' | 'pink' | 'green';
};
export type Action = StyleAction | ContentAction | WorkspaceAction | LocalAction | { type: 'background'; expected: DashboardBackground; value: DashboardBackground } | { type: 'theme'; expected: Theme; value: Theme } | { type: 'appearance'; widgetId?: string; widgetType?: WidgetType; expected: CardAppearance; value: CardAppearance } | { type: 'pin'; widgetId: string; expected: boolean; value: boolean };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function expect(a: unknown, b: unknown) {
    if (!equal(a, b))
        throw new ConflictError();
}
export function applyAction(source: DashboardDocument, action: Action, now = Date.now()): DashboardDocument {
    const next = structuredClone(source);
    if (action.type === 'presets' || action.type === 'layoutAssistance' || action.type === 'presentation' || action.type === 'appearanceBatch' || action.type === 'align') {
        applyStyleAction(next, action, message => { throw new ConflictError(message); });
        next.revision++; return validateDashboard(next);
    }
    if (action.type === 'appearance' && action.widgetType) {
        if (action.widgetId || !(WIDGET_TYPES as readonly string[]).includes(action.widgetType)) throw new ConflictError();
        expect(next.typeAppearance?.[action.widgetType] ?? emptyAppearance(), action.expected);
        next.typeAppearance ??= {};
        if (Object.values(action.value).every(value => value == null)) delete next.typeAppearance[action.widgetType];
        else next.typeAppearance[action.widgetType] = structuredClone(action.value);
        if (!Object.keys(next.typeAppearance).length) delete next.typeAppearance;
        next.revision++; return validateDashboard(next);
    }
    if (action.type === 'background') {
        expect(next.background, action.expected); next.background = structuredClone(action.value);
        next.revision++; return validateDashboard(next);
    }
    if (action.type === 'appearance' || action.type === 'pin') {
        const target = action.widgetId ? next.widgets.find(w => w.id === action.widgetId) : next;
        if (!target) throw new ConflictError();
        if (action.type === 'pin') {
            if (!('pinned' in target)) throw new ConflictError();
            expect(target.pinned, action.expected); target.pinned = action.value;
        } else { expect(target.appearance, action.expected); target.appearance = structuredClone(action.value); }
        next.revision++;
        return validateDashboard(next);
    }
    if (action.type === 'theme') {
        expect(next.theme, action.expected);
        next.theme = action.value;
        next.revision++;
        return validateDashboard(next);
    }
    if (['clockStyle', 'notesSkin', 'calendarWeekStart', 'clockFormat', 'habitAdd', 'habitToggle', 'habitDelete', 'calendarUpsert', 'calendarDelete', 'imageAsset', 'imageCaption', 'imageFit', 'weatherCity', 'weatherUnits'].includes(action.type)) {
        applyLocal(next, action as LocalAction, () => { throw new ConflictError(); });
        next.revision += 1;
        return validateDashboard(next);
    }
    if (['zoom', 'layout', 'front', 'nudge', 'arrange', 'recoverLayout', 'createWidget', 'timer', 'timerSettings', 'upsertReminder', 'deleteReminder'].includes(action.type)) {
        applyWorkspace(next, action as WorkspaceAction, now, message => { throw new ConflictError(message); });
        next.revision += 1;
        return validateDashboard(next);
    }
    const contentAction = action as ContentAction;
    return applyContent(next, contentAction);
}
function applyContent(next: DashboardDocument, action: ContentAction): DashboardDocument {
    const w = next.widgets.find(widget => widget.id === action.widgetId);
    if (!w)
        throw new ConflictError();
    switch (action.type) {
        case 'rename':
            expect(w.title, action.expected);
            w.title = action.value;
            break;
        case 'deleteWidget':
            expect({ ...w, zIndex: 0 }, { ...action.expected, zIndex: 0 });
            next.widgets = next.widgets.filter(widget => widget.id !== w.id);
            break;
        case 'text':
            if (w.type !== 'notes' && w.type !== 'sticky')
                throw new ConflictError();
            expect(w.content.text, action.expected);
            w.content.text = action.value;
            break;
        case 'stickyColor':
            if (w.type !== 'sticky')
                throw new ConflictError();
            expect(w.settings.color, action.expected);
            w.settings.color = action.value;
            break;
        default: {
            if (w.type !== 'todo')
                throw new ConflictError();
            if (action.type === 'addTask') {
                if (w.content.tasks.some(t => t.id === action.task.id))
                    throw new ConflictError();
                w.content.tasks.push(action.task);
            }
            else if (action.type === 'clearTasks') {
                expect(w.content.tasks, action.expected);
                w.content.tasks = [];
            }
            else {
                const task = w.content.tasks.find(t => t.id === action.taskId);
                if (!task)
                    throw new ConflictError();
                if (action.type === 'editTask') {
                    expect(task.text, action.expected);
                    task.text = action.value;
                }
                if (action.type === 'toggleTask') {
                    expect(task.completed, action.expected);
                    task.completed = action.value;
                }
                if (action.type === 'deleteTask') {
                    expect(task, action.expected);
                    w.content.tasks = w.content.tasks.filter(t => t.id !== task.id);
                }
            }
        }
    }
    next.revision += 1;
    return validateDashboard(next);
}
