import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { PointerEvent, ReactNode, CSSProperties } from 'react';
import type { Widget, CardAppearance } from '../state/model';
import { dashboardStore } from '../state/store';
import { useDashboard } from '../state/store';
import { widgetAppearance, cardVariables, appearanceAttributes } from '../ui/cardAppearance';
import { gestureLayout, snapLayout, movementGuides, displayedSize } from './layout';
import { defaultLayoutAssistance, defaultPresentation, isAmbientNote } from '../state/model';
import { workspaceTools, useWorkspaceTools } from '../state/workspace-tools';
import type { Layout } from './layout';
interface Gesture {
    mode: 'move' | 'resize';
    x: number;
    y: number;
    start: Layout;
    value: Layout;
    pointerId: number;
    scrollX: number;
    scrollY: number;
}
export function WidgetFrame({ widget, zoom, narrow, children, preview = false, appearanceOverride }: {
    widget: Widget;
    zoom: number;
    narrow: boolean;
    children: ReactNode;
    preview?: boolean;
    appearanceOverride?: CardAppearance;
}) {
    const state = useDashboard();
    const tools = useWorkspaceTools();
    const selecting = !preview && !isAmbientNote(widget) && tools.selecting;
    const selected = selecting && tools.selected.includes(widget.id);
    const assistance = tools.advanced ? state.document?.layoutAssistance ?? defaultLayoutAssistance() : { ...defaultLayoutAssistance(), guides: false };
    const presentation = widget.presentation ?? defaultPresentation();
    const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
    const appearance = appearanceOverride ?? (state.document ? widgetAppearance(state.document, widget) : widget.appearance);
    const appearanceStyle = cardVariables(appearance) as CSSProperties;
    const active = useRef<Gesture | null>(null);
    const [draft, setDraft] = useState<Layout | null>(null);
    const [error, setError] = useState('');
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => { if (widget.pinned && active.current) { active.current = null; setDraft(null); setGuides({}); } }, [widget.pinned]);
    useEffect(() => { const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape' && active.current) {
        active.current = null;
        setDraft(null);
        setGuides({});
    } }; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel); }, []);
    function begin(event: PointerEvent<HTMLDivElement>) {
        if (preview || selecting || narrow || widget.pinned || event.button !== 0)
            return;
        const target = event.target as HTMLElement;
        const resize = !!target.closest('[data-resize]');
        if (resize && presentation.collapsed) return;
        if (!resize && (!target.closest('.widget-heading') || target.closest('button,input,textarea,select,a,.widget-controls')))
            return;
        event.preventDefault();
        const start = { position: { ...widget.position }, size: { ...widget.size } };
        active.current = { mode: resize ? 'resize' : 'move', x: event.clientX, y: event.clientY, start, value: start, pointerId: event.pointerId, scrollX: event.currentTarget.closest('.workspace-viewport')?.scrollLeft ?? 0, scrollY: event.currentTarget.closest('.workspace-viewport')?.scrollTop ?? 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraft(start);
        setError('');
    }
    function finish() { setGuides({}); const gesture = active.current; if (!gesture)
        return; active.current = null; const changed = JSON.stringify(gesture.start) !== JSON.stringify(gesture.value); if (!changed) {
        setDraft(null);
        return;
    } void dashboardStore.dispatch({ type: 'layout', widgetId: widget.id, expected: gesture.start, value: gesture.value }).catch(e => setError(e.message)).finally(() => setDraft(null)); }
    const layout = draft ?? { position: widget.position, size: widget.size };
    return <motion.div ref={root} layout={!draft && !preview && !narrow ? 'position' : false} initial={false} transition={{ layout: { type: 'spring', stiffness: 360, damping: 34, mass: 0.8 } }} data-presentation={presentation.mode} data-collapsed={presentation.collapsed || undefined} {...appearanceAttributes(appearance)} inert={preview || undefined} className={`widget-frame ${selected ? 'widget-selected' : ''} ${selecting ? 'widget-selecting' : ''} ${preview ? 'appearance-sample' : ''} ${narrow ? 'flow-frame' : ''} ${draft ? 'gesturing' : ''} ${widget.pinned ? 'pinned-card' : ''} ${appearance.backgroundColor ? 'custom-card' : ''}`} data-widget-id={widget.id} style={{ ...appearanceStyle, ...(narrow ? { width: widget.size.width, height: displayedSize(widget).height } : { left: layout.position.x, top: layout.position.y, width: layout.size.width, height: presentation.collapsed ? 54 : layout.size.height, zIndex: draft ? 100001 : widget.zIndex }) }} onClickCapture={event => { if (selecting && !(event.target as HTMLElement).closest('.widget-select')) { event.preventDefault(); event.stopPropagation(); workspaceTools.toggle(widget.id); } }} onPointerDownCapture={event => { if (selecting && !(event.target as HTMLElement).closest('.widget-select')) { event.preventDefault(); return; } if (!preview && !selecting && event.currentTarget.contains(event.target as Node) && !active.current)
        void dashboardStore.dispatch({ type: 'front', widgetId: widget.id }).catch(e => setError(e.message)); }} onFocusCapture={event => { if (!preview && !selecting && event.currentTarget.contains(event.target as Node) && !event.currentTarget.contains(event.relatedTarget as Node | null))
        void dashboardStore.dispatch({ type: 'front', widgetId: widget.id }).catch(e => setError(e.message)); }} onPointerDown={begin} onPointerMove={event => { const g = active.current; if (!g)
        return; g.value = gestureLayout(g.start, g.mode, event.clientX - g.x + ((event.currentTarget.closest('.workspace-viewport')?.scrollLeft ?? 0) - g.scrollX), event.clientY - g.y + ((event.currentTarget.closest('.workspace-viewport')?.scrollTop ?? 0) - g.scrollY), zoom, widget.type); if (assistance.snap) g.value = snapLayout(g.value, g.mode, assistance.gridSize, widget.type);
        setGuides(g.mode === 'move' ? movementGuides({ ...g.value, size: displayedSize({ ...widget, size: g.value.size }) }, state.document?.widgets.filter(w => w.id !== widget.id && isAmbientNote(w) === isAmbientNote(widget)) ?? [], zoom, assistance) : {});
        setDraft(g.value); }} onPointerUp={finish} onPointerCancel={() => { setGuides({}); active.current = null; setDraft(null); }} onLostPointerCapture={() => { if (active.current) {
        active.current = null;
        setDraft(null);
    } }} onKeyDown={event => { if (preview || selecting || narrow || widget.pinned || (presentation.collapsed && event.altKey) || !(event.target as HTMLElement).classList.contains('widget-heading') || !event.key.startsWith('Arrow'))
        return; event.preventDefault(); const step = event.shiftKey ? 1 : 16; const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0; const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0; void dashboardStore.dispatch({ type: 'nudge', widgetId: widget.id, dx, dy, resize: event.altKey, assisted: tools.advanced }).catch(e => setError(e.message)); }}>
 {selecting && <label className="widget-select"><input type="checkbox" aria-label={`Select ${widget.title || widget.type}`} checked={selected} onChange={() => workspaceTools.toggle(widget.id)}/><span>Select</span></label>}
 {children}{guides.x != null && <span className="alignment-guide alignment-guide-x" style={{ left: guides.x - layout.position.x, top: -layout.position.y, height: Math.max(innerHeight / zoom, layout.position.y + widget.size.height + 80) }}/>}
 {guides.y != null && <span className="alignment-guide alignment-guide-y" style={{ top: guides.y - layout.position.y, left: -layout.position.x, width: Math.max(innerWidth / zoom, layout.position.x + widget.size.width + 80) }}/>}
 {widget.pinned && <span className="pin-tape" role="img" aria-label="Card pinned in place" title="Pinned in place"/>}{!preview && !selecting && !presentation.collapsed && !narrow && !widget.pinned && <button className="resize-handle" data-resize aria-label={`Resize ${widget.title || widget.type}; use Layout for keyboard controls`} tabIndex={-1}/>}{error && <p className="layout-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></p>}
 </motion.div>;
}
