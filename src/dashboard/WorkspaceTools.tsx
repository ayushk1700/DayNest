import { useEffect, useRef, useState } from 'react';
import { dashboardStore, useDashboard } from '../state/store';
import { workspaceTools, useWorkspaceTools } from '../state/workspace-tools';
import { defaultLayoutAssistance, isAmbientNote } from '../state/model';
import { useViewport } from './useViewport';
import { Overlay } from '../ui/Overlay';
import { AppearanceControls } from './AppearanceControls';
import type { Alignment } from './layout';

export function WorkspaceTools() {
    const state = useDashboard(), tools = useWorkspaceTools(), { width } = useViewport();
    const [editing, setEditing] = useState(false), [error, setError] = useState('');
    const toolbar = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const root = document.documentElement;
        if (!tools.selecting || !toolbar.current) return;
        const update = () => root.style.setProperty('--selection-tools-space', `${(toolbar.current?.getBoundingClientRect().height ?? 150) + 72}px`);
        const observer = new ResizeObserver(update); observer.observe(toolbar.current); update();
        return () => { observer.disconnect(); root.style.removeProperty('--selection-tools-space'); };
    }, [tools.selecting]);
    const widgets = state.document?.widgets.filter(w => !isAmbientNote(w)) ?? [], selected = widgets.filter(w => tools.selected.includes(w.id));
    const narrow = width < 1100, pinned = selected.some(w => w.pinned);
    useEffect(() => {
        const ids = new Set(widgets.map(w => w.id));
        const next = tools.selected.filter(id => ids.has(id));
        if (next.length !== tools.selected.length) workspaceTools.update({ selected: next });
    }, [state.document, tools.selected]);
    const reason = narrow ? 'Alignment is available in the wide canvas. Selection and appearance editing work here.' : pinned ? 'Unpin selected widgets to align or distribute them.' : selected.length < 2 ? 'Select at least two widgets to align, or three to distribute.' : selected.length < 3 ? 'Select one more widget to distribute.' : 'Alignment uses the selection bounds. Distribution needs enough space to avoid overlap.';
    function align(operation: Alignment) {
        setError('');
        void dashboardStore.dispatch({ type: 'align', operation, targets: selected.map(w => ({ id: w.id, expected: { position: w.position, size: w.size } })) }).then(() => workspaceTools.update({ message: 'Selection layout updated. Undo restores the previous positions.' })).catch(e => setError(e.message));
    }
    if (!tools.advanced) return null;
    return <div ref={toolbar} className={`selection-toolbar ${tools.selecting ? 'selection-toolbar-open' : ''}`}>
        <button type="button" className="small" aria-pressed={tools.selecting} onClick={() => { workspaceTools.update({ selecting: !tools.selecting, selected: [], message: '' }); setError(''); }}>{tools.selecting ? 'Done selecting' : 'Select widgets'}</button>
        {tools.selecting && <><span role="status">{selected.length} selected</span><button type="button" className="small" onClick={() => workspaceTools.update({ selected: widgets.map(w => w.id) })}>Select all</button><button type="button" className="small" onClick={() => workspaceTools.update({ selected: [] })}>Clear selection</button><button type="button" className="primary" disabled={!selected.length} onClick={() => setEditing(true)}>Edit appearance</button>
        <div className="selection-alignments" role="group" aria-label="Align selected widgets">{(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const).map(operation => <button type="button" className="small" key={operation} disabled={narrow || pinned || selected.length < 2 || state.pending > 0} title={reason} onClick={() => align(operation)}>Align {operation}</button>)}{(['horizontal', 'vertical'] as const).map(operation => <button type="button" className="small" key={operation} disabled={narrow || pinned || selected.length < 3 || state.pending > 0} title={reason} onClick={() => align(operation)}>Distribute {operation === 'horizontal' ? 'horizontally' : 'vertically'}</button>)}</div><p>{reason}</p></>}
        {tools.message && <p role="status">{tools.message}<button className="selection-dismiss" aria-label="Dismiss workspace message" onClick={() => workspaceTools.update({ message: '' })}>×</button></p>}{error && <p role="alert">{error}</p>}
        {editing && <Overlay modal label="Customize selected widgets" onClose={() => setEditing(false)}><h1>Style {selected.length} selected widgets</h1><AppearanceControls widgetIds={selected.map(w => w.id)} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)}/></Overlay>}
    </div>;
}

export function LayoutAssistanceControls() {
    const { advanced } = useWorkspaceTools();
    const state = useDashboard(), live = state.document?.layoutAssistance ?? defaultLayoutAssistance();
    const [grid, setGrid] = useState(live.gridSize), [error, setError] = useState('');
    useEffect(() => setGrid(live.gridSize), [live.gridSize]);
    function save(value: typeof live) { setError(''); void dashboardStore.dispatch({ type: 'layoutAssistance', expected: live, value }).catch(e => setError(e.message)); }
    if (!advanced) return null;
    return <section className="layout-assistance-controls"><h2>Layout assistance</h2><label><input type="checkbox" checked={live.snap} disabled={state.pending > 0} onChange={e => save({ ...live, snap: e.target.checked })}/>Snap to grid</label><label>Grid size (canvas pixels)<input aria-label="Grid size" type="number" min={4} max={128} step={1} value={grid} onChange={e => setGrid(e.target.valueAsNumber)}/></label><button type="button" className="small" disabled={state.pending > 0 || !Number.isInteger(grid) || grid < 4 || grid > 128 || grid === live.gridSize} onClick={() => save({ ...live, gridSize: grid })}>Save grid size</button><label><input type="checkbox" checked={live.guides} disabled={state.pending > 0} onChange={e => save({ ...live, guides: e.target.checked })}/>Show alignment guides while moving</label><p className="appearance-help">Grid and guides use canvas coordinates at every zoom. Pinned widgets stay put. Narrow windows keep their flowing layout.</p>{error && <p role="alert">{error}</p>}</section>;
}
