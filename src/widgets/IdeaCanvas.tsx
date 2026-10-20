import { InsightBrandBar, InsightGlyph } from './InsightChrome';
import { useDrafts } from '../state/drafts';
import { useEffect, useRef, useState } from 'react';
import type { IdeaNode, Widget } from '../state/model';
import type { Action } from '../state/actions';
import { dashboardStore, useDashboard } from '../state/store';
import { DraftField } from '../ui/DraftField';
import './ideaCanvas.css';
type Scratchpad = Extract<Widget, {
    type: 'scratchpad';
}>;
export function IdeaCanvas({ widget, close, startNew }: {
    widget: Scratchpad;
    close: () => void;
    startNew: boolean;
}) {
    const [tool,setTool]=useState<'select'|'pan'|'connect'>('select'),[searchOpen,setSearchOpen]=useState(false);
    const [selected, setSelected] = useState<string | null>(null), [query, setQuery] = useState(''), [list, setList] = useState(false);
    const [view, setView] = useState({ x: 60, y: 60, zoom: 1 }), [grid, setGrid] = useState(true), [source, setSource] = useState<string | null>(null);
    const [error, setError] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null);
    const [moving, setMoving] = useState<{
        id: string;
        x: number;
        y: number;
    } | null>(null);
    const area = useRef<HTMLDivElement>(null), initialized = useRef(false);
    const drafts = useDrafts();
    const state = useDashboard(), nodes = widget.content.nodes, edges = widget.content.connections;
    const chosen = nodes.find(n => n.id === selected), visible = nodes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(query.toLowerCase()));
    async function send(action: Action) { setError(''); try {
        await dashboardStore.dispatch(action);
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.');
        return false;
    } }
    async function add() { const id = crypto.randomUUID(); const node: IdeaNode = { id, title: 'Untitled idea', body: '', position: { x: Math.max(-100000, Math.min(100000, Math.round((100 - view.x) / view.zoom) + nodes.length % 5 * 220)), y: Math.max(-100000, Math.min(100000, Math.round((100 - view.y) / view.zoom) + Math.floor(nodes.length / 5) * 140)) } }; if (await send({ type: 'graphNode', widgetId: widget.id, id, expected: null, value: node }))
        setSelected(id); }
    useEffect(() => { if (!initialized.current) {
        initialized.current = true;
        if (startNew) void add(); else if(nodes.length) fit();
    } }, []);
    async function connect(to: string) { if (!source)
        return; const id = crypto.randomUUID(); if (await send({ type: 'graphConnection', widgetId: widget.id, id, expected: null, value: { id, from: source, to } }))
        setSource(null); }
    function fit() { if (!nodes.length) {
        setView({ x: 60, y: 60, zoom: 1 });
        return;
    } const rect = area.current?.getBoundingClientRect(); const minX = Math.min(...nodes.map(n => n.position.x)), minY = Math.min(...nodes.map(n => n.position.y)); const width = Math.max(...nodes.map(n => n.position.x + (n.width??200))) - minX, height = Math.max(...nodes.map(n => n.position.y + (n.height??100))) - minY; const zoom = Math.max(.0001, Math.min(1, ((rect?.width ?? 800) - 80) / width, ((rect?.height ?? 500) - 80) / height)); setView({ x: 40 - minX * zoom, y: 40 - minY * zoom, zoom }); }
    function zoom(factor: number) { setView(v => { const z = Math.max(.0001, Math.min(2, v.zoom * factor)); const r = area.current?.getBoundingClientRect(); const cx = (r?.width ?? 800) / 2, cy = (r?.height ?? 500) / 2; return { x: cx - (cx - v.x) * z / v.zoom, y: cy - (cy - v.y) * z / v.zoom, zoom: z }; }); }
    return <div className="insight-page idea-page"><InsightBrandBar close={close} workspace/><header className="idea-page-heading"><div><h1>{widget.title || 'Scratchpad'}</h1><p>Let one thought lead to another.</p></div><div className="idea-top-actions"><button className="sage-button" onClick={()=>void add()} disabled={nodes.length>=200||state.pending>0}>+ Idea</button><button aria-pressed={tool==='connect'} onClick={()=>{setTool('connect');if(chosen)setSource(chosen.id);}}><InsightGlyph name="link"/>Connect</button><button aria-label="Search canvas" aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><InsightGlyph name="search"/></button>{searchOpen&&<input autoFocus aria-label="Search ideas" placeholder="Find an idea…" value={query} onChange={e=>setQuery(e.target.value)}/>}</div></header>
        <div className="idea-floating-tools" aria-label="Canvas tools"><button aria-label="Select tool" aria-pressed={tool==='select'} onClick={()=>setTool('select')}><InsightGlyph name="cursor"/></button><button aria-label="Pan tool" aria-pressed={tool==='pan'} onClick={()=>setTool('pan')}><InsightGlyph name="hand"/></button><button aria-label="Add idea" onClick={()=>void add()} disabled={nodes.length>=200||state.pending>0}>+</button><button aria-label="Connect tool" aria-pressed={tool==='connect'} onClick={()=>{setTool('connect');if(chosen)setSource(chosen.id);}}><InsightGlyph name="link"/></button><details className="idea-more"><summary aria-label="Canvas options">⋯</summary><div><button aria-pressed={list} onClick={()=>setList(!list)}>{list?'Canvas view':'List view'}</button><button onClick={fit}>Fit ideas</button><button aria-pressed={grid} onClick={()=>setGrid(!grid)}>Grid</button><button disabled={!state.canUndo||state.pending>0||drafts.length>0} onClick={()=>void dashboardStore.travel('undo').catch(e=>setError(e.message))}>Undo</button><button disabled={!state.canRedo||state.pending>0||drafts.length>0} onClick={()=>void dashboardStore.travel('redo').catch(e=>setError(e.message))}>Redo</button></div></details></div>
        <div className="idea-zoom-controls"><button onClick={()=>zoom(.8)} aria-label="Zoom out">−</button><span>{Math.round(view.zoom*10000)/100}%</span><button onClick={()=>zoom(1.25)} aria-label="Zoom in">+</button></div>
        <div className="idea-local-status"><i/>Saved on this device.</div>
        {error && <p role="alert">{error} Your saved ideas were kept.</p>}{source && <p role="status">Choose a destination for {nodes.find(n => n.id === source)?.title}. <button onClick={() => setSource(null)}>Cancel connection</button></p>}
        <div className="idea-workspace"><div className={`idea-board ${grid ? 'idea-grid' : ''} ${list ? 'as-list' : ''}`} ref={area} aria-label="Idea canvas" onPointerDown={e => { if (e.target !== e.currentTarget)
        return; const x = e.clientX, y = e.clientY, original = view; e.currentTarget.setPointerCapture(e.pointerId); const element = e.currentTarget; const move = (p: PointerEvent) => setView({ ...original, x: original.x + p.clientX - x, y: original.y + p.clientY - y }); const stop = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', stop); element.removeEventListener('pointercancel', stop); }; element.addEventListener('pointermove', move); element.addEventListener('pointerup', stop); element.addEventListener('pointercancel', stop); }}>
            {!nodes.length && <p className="idea-no-content">Every idea starts somewhere. Add your first idea.</p>}
            <div className="idea-plane" style={list ? undefined : { transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})` }}>
            {!list && <svg className="idea-threads" aria-hidden="true">{edges.map(edge => { const a = nodes.find(n => n.id === edge.from)!, b = nodes.find(n => n.id === edge.to)!; const ap = moving?.id === a.id ? moving : a.position, bp = moving?.id === b.id ? moving : b.position; const dx=bp.x-ap.x,dy=bp.y-ap.y;
 const aw=a.width??200,ah=a.height??100,bw=b.width??200,bh=b.height??100,horizontal=Math.abs(dx)>Math.abs(dy),ax=ap.x+(horizontal?(dx>=0?aw:0):aw/2),ay=ap.y+(horizontal?ah/2:(dy>=0?ah:0)),bx=bp.x+(horizontal?(dx>=0?0:bw):bw/2),by=bp.y+(horizontal?bh/2:(dy>=0?0:bh));
 const path=horizontal?`M${ax},${ay} C${(ax+bx)/2},${ay} ${(ax+bx)/2},${by} ${bx},${by}`:`M${ax},${ay} C${ax},${(ay+by)/2} ${bx},${(ay+by)/2} ${bx},${by}`;return <path key={edge.id} d={path}/>; })}</svg>}
            {visible.map(node => <div className={`idea-node ${selected === node.id ? 'selected' : ''}`} key={node.id} style={list ? (node.width?{width:node.width}:undefined) : { left: moving?.id === node.id ? moving.x : node.position.x, top: moving?.id === node.id ? moving.y : node.position.y, width:node.width??200, ...(node.height?{height:node.height}:{}) }}><button className="idea-node-title" aria-label={`Edit ${node.title}`} onClick={() => {if(tool==='connect'){if(source&&source!==node.id)void connect(node.id);else setSource(node.id);}else setSelected(node.id);}} onPointerDown={e => { if (list || tool!=='select' || e.button !== 0)
        return; const x = e.clientX, y = e.clientY, element = e.currentTarget; let last = node.position, dragged = false; element.setPointerCapture(e.pointerId); const move = (p: PointerEvent) => { if (Math.hypot(p.clientX - x, p.clientY - y) < 4 && !dragged)
        return; dragged = true; last = { x: Math.max(-100000, Math.min(100000, Math.round(node.position.x + (p.clientX - x) / view.zoom))), y: Math.max(-100000, Math.min(100000, Math.round(node.position.y + (p.clientY - y) / view.zoom))) }; setMoving({ id: node.id, ...last }); }; const stop = (p: PointerEvent) => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', stop); element.removeEventListener('pointercancel', stop); setMoving(null); if (dragged && p.type !== 'pointercancel')
        void send({ type: 'graphNode', widgetId: widget.id, id: node.id, expected: node, value: { ...node, position: last } }); }; element.addEventListener('pointermove', move); element.addEventListener('pointerup', stop); element.addEventListener('pointercancel', stop); }}>{node.title}</button><button className="idea-node-menu" aria-label={`Options for ${node.title}`} onClick={()=>setSelected(node.id)}>⋮</button>{node.body&&<p>{node.body.slice(0,85)}</p>}<i className="idea-port-left"/><i className="idea-port-top"/><i className="idea-port-bottom"/><button className="idea-port" data-idea-port={node.id} aria-label={`Connect ${node.title}`} onPointerDown={e => { const x = e.clientX, y = e.clientY; const end = (p: PointerEvent) => { document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); if (p.type === 'pointercancel' || Math.hypot(p.clientX - x, p.clientY - y) < 5)
        return; const to = document.elementFromPoint(p.clientX, p.clientY)?.closest('[data-idea-port]')?.getAttribute('data-idea-port'); if (to && to !== node.id) {
        const id = crypto.randomUUID();
        void send({ type: 'graphConnection', widgetId: widget.id, id, expected: null, value: { id, from: node.id, to } });
    } }; document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end); }} onClick={() => { if (!source)
        setSource(node.id);
    else if (source !== node.id)
        void connect(node.id); }}><span/></button></div>)}
            </div></div>
            <aside className="idea-editor" hidden={!chosen&&!source} aria-label="Idea editor"><button className="idea-editor-close" aria-label="Close idea editor" onClick={()=>{setSelected(null);setSource(null);}}>×</button>{chosen ? <><h2>Edit idea</h2><DraftField key={`${chosen.id}-title`} label="Idea title" value={chosen.title} maxLength={120} required onSave={async (expected, value) => { await dashboardStore.dispatch({ type: 'graphNode', widgetId: widget.id, id: chosen.id, expected: { ...chosen, title: expected }, value: { ...chosen, title: value } }); }}/><DraftField key={`${chosen.id}-body`} label="Idea text" value={chosen.body} maxLength={4000} multiline onSave={async (expected, value) => { await dashboardStore.dispatch({ type: 'graphNode', widgetId: widget.id, id: chosen.id, expected: { ...chosen, body: expected }, value: { ...chosen, body: value } }); }}/><button onClick={() => setSource(chosen.id)}>Connect to another idea</button>{source && <select aria-label="Connection destination" value="" onChange={e => void connect(e.target.value)}><option value="">Choose destination…</option>{nodes.filter(n => n.id !== source && !edges.some(e => (e.from === source && e.to === n.id) || (e.to === source && e.from === n.id))).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select>}<h3>Move idea</h3><div className="idea-toolbar">{[[0, -20, 'Up'], [-20, 0, 'Left'], [20, 0, 'Right'], [0, 20, 'Down']].map(([x, y, label]) => <button key={label} onClick={() => void send({ type: 'graphNode', widgetId: widget.id, id: chosen.id, expected: chosen, value: { ...chosen, position: { x: chosen.position.x + Number(x), y: chosen.position.y + Number(y) } } })}>{label}</button>)}</div><h3>Connections</h3>{edges.filter(e => e.from === chosen.id || e.to === chosen.id).map(edge => <div key={edge.id}>{nodes.find(n => n.id === (edge.from === chosen.id ? edge.to : edge.from))?.title} <button aria-label={`Remove connection to ${nodes.find(n => n.id === (edge.from === chosen.id ? edge.to : edge.from))?.title}`} onClick={() => void send({ type: 'graphConnection', widgetId: widget.id, id: edge.id, expected: edge, value: null })}>Remove</button></div>)}<button onClick={() => setDeleteId(chosen.id)}>Delete idea</button>{deleteId === chosen.id && <div role="group" aria-label="Confirm idea deletion"><p>Delete this idea and its connections? Undo can restore them.</p><button onClick={() => { void send({ type: 'graphNode', widgetId: widget.id, id: chosen.id, expected: chosen, value: null, incident: edges.filter(e => e.from === chosen.id || e.to === chosen.id) }).then(ok => { if (ok) {
        setSelected(null);
        setDeleteId(null);
    } }); }}>Confirm delete</button><button onClick={() => setDeleteId(null)}>Keep idea</button></div>}</> : <p>Select an idea to edit it. Drag a title to move it; drag empty space to pan. Use List view and Move controls for keyboard access.</p>}<p className="insight-caption">{nodes.length}/200 ideas · {edges.length}/400 connections. Plain text, saved locally. Unsaved text is available in draft recovery if you leave.</p></aside>
        </div></div>;
}
