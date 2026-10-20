import type { DashboardDocument, IdeaNode, IdeaConnection } from './model';
export type GraphAction = {
    type: 'graphNode';
    widgetId: string;
    id: string;
    expected: IdeaNode | null;
    value: IdeaNode | null;
    incident?: IdeaConnection[];
} | {
    type: 'graphConnection';
    widgetId: string;
    id: string;
    expected: IdeaConnection | null;
    value: IdeaConnection | null;
};
export function applyGraph(document: DashboardDocument, action: GraphAction, conflict: () => never) {
    const w = document.widgets.find(w => w.id === action.widgetId);
    if (!w || w.type !== 'scratchpad')
        return conflict();
    const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (action.type === 'graphNode') {
        const old = w.content.nodes.find(n => n.id === action.id) ?? null;
        if (!equal(old, action.expected) || (action.value && action.value.id !== action.id))
            return conflict();
        if (!action.value) {
            const edges = w.content.connections.filter(e => e.from === action.id || e.to === action.id);
            if (!equal(edges, action.incident ?? []))
                return conflict();
            w.content.connections = w.content.connections.filter(e => e.from !== action.id && e.to !== action.id);
        }
        w.content.nodes = w.content.nodes.filter(n => n.id !== action.id);
        if (action.value)
            w.content.nodes.push(structuredClone(action.value));
    }
    else {
        const old = w.content.connections.find(e => e.id === action.id) ?? null;
        if (!equal(old, action.expected) || (action.value && action.value.id !== action.id))
            return conflict();
        w.content.connections = w.content.connections.filter(e => e.id !== action.id);
        if (action.value)
            w.content.connections.push(structuredClone(action.value));
    }
}
