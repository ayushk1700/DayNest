import type { AppearancePreset, CardAppearance, DashboardDocument, LayoutAssistance, Presentation } from './model';
import { defaultLayoutAssistance, defaultPresentation, isAmbientNote } from './model';
import { alignedLayouts } from '../dashboard/layout';
import type { Alignment, Layout } from '../dashboard/layout';
import { appearanceKeys } from '../ui/cardAppearance';

export type StyleAction =
    { type: 'presets'; expected: AppearancePreset[]; value: AppearancePreset[] }
    | { type: 'layoutAssistance'; expected: LayoutAssistance; value: LayoutAssistance }
    | { type: 'presentation'; widgetId: string; expected: Presentation; value: Presentation }
    | { type: 'appearanceBatch'; targets: { id: string; expected: CardAppearance }[]; patch: Partial<CardAppearance> }
    | { type: 'align'; targets: { id: string; expected: Layout }[]; operation: Alignment };

export function applyStyleAction(next: DashboardDocument, action: StyleAction, conflict: (message?: string) => never) {
    const expect = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) conflict(); };
    if (action.type === 'presets') {
        expect(next.presets ?? [], action.expected);
        next.presets = structuredClone(action.value);
        if (!next.presets.length) delete next.presets;
    } else if (action.type === 'layoutAssistance') {
        expect(next.layoutAssistance ?? defaultLayoutAssistance(), action.expected);
        next.layoutAssistance = structuredClone(action.value);
    } else if (action.type === 'presentation') {
        const w = next.widgets.find(w => w.id === action.widgetId);
        if (!w) return conflict();
        expect(w.presentation ?? defaultPresentation(), action.expected);
        w.presentation = structuredClone(action.value);
    } else {
        if (!action.targets.length || new Set(action.targets.map(t => t.id)).size !== action.targets.length) return conflict('Select one or more unique widgets.');
        const widgets = action.targets.map(target => {
            const widget = next.widgets.find(w => w.id === target.id);
            if (!widget) return conflict('A selected widget was removed.');
            return widget;
        });
        if (action.type === 'appearanceBatch') {
            if (Object.keys(action.patch).some(k => !(appearanceKeys as readonly string[]).includes(k))) return conflict('Unsupported appearance property.');
            widgets.forEach((w, index) => {
                for (const key of Object.keys(action.patch) as (keyof CardAppearance)[]) {
                    expect(w.appearance[key] ?? null, action.targets[index].expected[key] ?? null);
                    Object.assign(w.appearance, { [key]: action.patch[key] ?? null });
                }
            });
        } else {
            widgets.forEach((w, index) => expect({ position: w.position, size: w.size }, action.targets[index].expected));
            if (widgets.some(w => isAmbientNote(w) !== isAmbientNote(widgets[0]))) return conflict('Align widgets within the same workspace.');
            let layouts: ReturnType<typeof alignedLayouts>;
            try { layouts = alignedLayouts(widgets, action.operation); }
            catch (error) { return conflict(error instanceof Error ? error.message : 'This layout operation is unavailable.'); }
            widgets.forEach(w => { w.position = layouts.get(w.id)!.position; });
        }
    }
}
