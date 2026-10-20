import type { Widget, WidgetType, LayoutAssistance } from '../state/model';
import { idleTimer, cardDefaults } from '../state/model';
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    top?: number;
}
export interface Viewport {
    width: number;
    height: number;
    top?: number;
}
export interface Layout {
    position: Widget['position'];
    size: Widget['size'];
}
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical';
export function displayedSize(widget: Widget): Widget['size'] { return widget.presentation?.collapsed ? { width: widget.size.width, height: 54 } : widget.size; }
export function snapLayout(layout: Layout, mode: 'move' | 'resize', grid: number, type: WidgetType): Layout {
    const snap = (n: number) => Math.max(0, Math.round(n / grid) * grid);
    return mode === 'move' ? { ...layout, position: { x: snap(layout.position.x), y: snap(layout.position.y) } }
        : { ...layout, size: { width: Math.min(5000, Math.max(minimums[type].width, snap(layout.size.width))), height: Math.min(5000, Math.max(minimums[type].height, snap(layout.size.height))) } };
}
export function movementGuides(layout: Layout, others: Widget[], zoom: number, settings: LayoutAssistance): { x?: number; y?: number } {
    if (!settings.guides) return {};
    const result: { x?: number; y?: number } = {};
    for (const axis of ['x', 'y'] as const) {
        const dimension = axis === 'x' ? 'width' : 'height';
        let closest = 6 / zoom;
        for (const other of others) for (const anchor of [0, .5, 1]) for (const targetAnchor of [0, .5, 1]) {
            const target = other.position[axis] + displayedSize(other)[dimension] * targetAnchor;
            const distance = Math.abs(layout.position[axis] + layout.size[dimension] * anchor - target);
            if (distance <= closest) { closest = distance; result[axis] = target; }
        }
    }
    return result;
}
export function alignedLayouts(widgets: Widget[], operation: Alignment): Map<string, Layout> {
    if (widgets.length < 2) throw Error('Select at least two widgets to align.');
    if (widgets.some(w => w.pinned)) throw Error('Unpin selected widgets before aligning or distributing.');
    if (new Set(widgets.map(w => w.id)).size !== widgets.length) throw Error('Select each widget only once.');
    if (!['left', 'center', 'right', 'top', 'middle', 'bottom', 'horizontal', 'vertical'].includes(operation)) throw Error('Unknown layout operation.');
    const horizontal = ['left', 'center', 'right', 'horizontal'].includes(operation), axis = horizontal ? 'x' : 'y', dimension = horizontal ? 'width' : 'height';
    const min = Math.min(...widgets.map(w => w.position[axis])), max = Math.max(...widgets.map(w => w.position[axis] + displayedSize(w)[dimension]));
    const result = new Map<string, Layout>();
    if (operation === 'horizontal' || operation === 'vertical') {
        if (widgets.length < 3) throw Error('Select at least three widgets to distribute.');
        const sorted = [...widgets].sort((a, b) => a.position[axis] - b.position[axis] || a.id.localeCompare(b.id));
        const last = sorted.at(-1)!;
        const end = last.position[axis] + displayedSize(last)[dimension];
        const gap = (end - min - sorted.reduce((sum, w) => sum + displayedSize(w)[dimension], 0)) / (widgets.length - 1);
        if (gap < 0) throw Error('Spread the selection out before distributing without overlap.');
        let cursor = min;
        for (const [index, w] of sorted.entries()) { result.set(w.id, { position: { ...w.position, [axis]: index === 0 || index === sorted.length - 1 ? w.position[axis] : cursor }, size: w.size }); cursor += displayedSize(w)[dimension] + gap; }
    } else for (const w of widgets) {
        const extent = displayedSize(w)[dimension];
        const value = ['left', 'top'].includes(operation) ? min : ['right', 'bottom'].includes(operation) ? max - extent : (min + max - extent) / 2;
        result.set(w.id, { position: { ...w.position, [axis]: Math.max(0, value) }, size: w.size });
    }
    return result;
}
export const minimums: Record<WidgetType, Widget['size']> = { scratchpad: { width: 300, height: 220 }, wellbeing: { width: 300, height: 190 }, video: { width: 260, height: 260 }, date: { width: 280, height: 180 }, todo: { width: 300, height: 360 }, notes: { width: 320, height: 260 }, sticky: { width: 150, height: 150 }, pomodoro: { width: 300, height: 263 }, reminder: { width: 340, height: 360 }, clock: { width: 240, height: 180 }, habit: { width: 300, height: 300 }, image: { width: 200, height: 200 }, calendar: { width: 320, height: 320 }, weather: { width: 260, height: 220 } };
export function gestureLayout(start: Layout, mode: 'move' | 'resize', dx: number, dy: number, zoom: number, type: WidgetType): Layout {
    if (!Number.isFinite(zoom) || zoom <= 0)
        throw Error('Invalid zoom');
    return mode === 'move' ? { size: start.size, position: { x: Math.max(0, start.position.x + dx / zoom), y: Math.max(0, start.position.y + dy / zoom) } } : { position: start.position, size: { width: Math.min(5000, Math.max(minimums[type].width, start.size.width + dx / zoom)), height: Math.min(5000, Math.max(minimums[type].height, start.size.height + dy / zoom)) } };
}
export function availablePosition(widgets: Widget[], size: Widget['size'], view: Viewport): Widget['position'] {
    const step = 24;
    const maxX = Math.max(0, view.width - size.width - 20), maxY = Math.max(0, view.height - size.height - 20);
    for (let y = view.top ?? 84; y <= maxY; y += step)
        for (let x = 20; x <= maxX; x += step)
            if (!widgets.some(w => x < w.position.x + w.size.width + 12 && x + size.width + 12 > w.position.x && y < w.position.y + w.size.height + 12 && y + size.height + 12 > w.position.y))
                return { x, y };
    // A crowded workspace still gets a visible, offset card rather than an off-screen one.
    return { x: Math.min(maxX, 20 + (widgets.length % 6) * 24), y: Math.max(view.top ?? 84, Math.min(maxY, (view.top ?? 84) + (widgets.length % 6) * 24)) };
}
export function arrangeLayout(widgets: Widget[], view: Viewport): Layout[] {
    let x = 20, y = view.top ?? 84, row = 0;
    const placed = widgets.filter(w => w.pinned).map(w => ({ position: w.position, size: w.size }));
    return widgets.map(w => {
        if (w.pinned) return { position: w.position, size: w.size };
        for (let tries = 0; tries < 20000; tries++) {
            if (x > 20 && x + w.size.width > view.width - 20) { x = 20; y += Math.max(row, w.size.height) + 24; row = 0; }
            const obstacle = placed.find(p => x < p.position.x + p.size.width + 16 && x + w.size.width + 16 > p.position.x && y < p.position.y + p.size.height + 16 && y + w.size.height + 16 > p.position.y);
            if (!obstacle) { const result = { position: { x, y }, size: w.size }; placed.push(result); x += w.size.width + 24; row = Math.max(row, w.size.height); return result; }
            x = obstacle.position.x + obstacle.size.width + 24;
        }
        throw Error('Unpin a card or use a wider workspace before arranging this layout.');
    });
}
export function recoveredLayout(w: Widget, view: Viewport): Layout { return { size: w.size, position: { x: Math.max(0, Math.min(w.position.x, view.width - Math.min(w.size.width, view.width) - 20)), y: Math.max(view.top ?? 84, Math.min(w.position.y, view.height - 60)) } }; }
export type CoreType = WidgetType;
export function createWidget(type: CoreType, id: string): Widget {
    const base = { ...cardDefaults(), id, title: '', position: { x: 20, y: 20 }, size: minimums[type], zIndex: 0 };
    switch (type) {
        case 'scratchpad': return { ...base, type, title: 'Scratchpad', size: { width: 360, height: 240 }, settings: {}, content: { nodes: [], connections: [] } };
        case 'wellbeing': return { ...base, type, title: 'Wellbeing', size: { width: 320, height: 190 }, settings: {}, content: {} };
        case 'video': return { ...base, type, title: 'Video', size: { width: 400, height: 400 }, settings: { fit: 'contain' }, content: { assetId: null, caption: '' } };
        case 'date': return { ...base, type, title: 'Date', size: { width: 600, height: 240 }, settings: {}, content: {} };
        case 'todo': return { ...base, type, title: 'Todo List', size: { width: 356, height: 486 }, settings: { showCompleted: true }, content: { tasks: [] } };
        case 'notes': return { ...base, type, title: 'Notes', size: { width: 469, height: 375 }, settings: { ruled: false }, content: { text: '' } };
        case 'sticky': return { ...base, type, title: 'Sticky Note', settings: { color: 'yellow' }, content: { text: '' } };
        case 'pomodoro': return { ...base, type, title: 'Pomodoro Timer', size: { width: 319, height: 340 }, settings: { workMinutes: 25, breakMinutes: 5 }, content: idleTimer() };
        case 'clock': return { ...base, type, title: 'Clock', size: { width: 300, height: 280 }, settings: { hour24: false, style: 'digital' }, content: { timeZone: '' } };
        case 'habit': return { ...base, type, title: 'Habit Tracker', size: { width: 420, height: 420 }, settings: { weekStartsOn: 1 }, content: { habits: [] } };
        case 'image': return { ...base, type, title: 'Image', size: { width: 340, height: 400 }, settings: { fit: 'contain' }, content: { assetId: null, caption: '' } };
        case 'calendar': return { ...base, type, title: 'Calendar', size: { width: 400, height: 520 }, settings: { weekStartsOn: 0 }, content: { events: [] } };
        case 'weather': return { ...base, type, title: 'Weather', size: { width: 540, height: 360 }, settings: { units: 'celsius' }, content: { city: '', provider: null } };
        case 'reminder': return { ...base, type, title: 'Reminder', size: { width: 360, height: 400 }, settings: { notify: true }, content: { reminders: [] } };
    }
}

