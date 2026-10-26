import { WidgetHeader } from './WidgetHeader';
import { InsightGlyph } from './InsightChrome';
import { WellbeingPage } from './WellbeingPage';
import { IdeaCanvas } from './IdeaCanvas';
import { useCallback, useEffect, useState } from 'react';
import type { ScratchpadContent, Widget } from '../state/model';
import { useDashboard } from '../state/store';
import { Overlay } from '../ui/Overlay';
import { Icon } from '../ui/Icon';
import { wellbeingStats, sessionTime } from './wellbeingSummary';
import './insights.css';

function GraphPreview({ content }: { content: ScratchpadContent }) {
    const visible = content.nodes.slice(0, 6);
    if (!visible.length) return <div className="insight-empty"><Icon name="graph" className="empty-node-mark"/><p>A little space for your next idea.</p></div>;
    const minX = Math.min(...visible.map(n => n.position.x)), minY = Math.min(...visible.map(n => n.position.y));
    const maxX = Math.max(...visible.map(n => n.position.x)), maxY = Math.max(...visible.map(n => n.position.y));
    const nodes = visible.map(n => ({ ...n, x: 70 + (n.position.x - minX) / Math.max(1, maxX - minX) * 400, y: 26 + (n.position.y - minY) / Math.max(1, maxY - minY) * 175 }));
    return <div className="graph-preview"><svg viewBox="0 0 540 230" role="img" aria-label={`Preview of ${visible.length} of ${content.nodes.length} ideas; ${content.connections.length} connections`}>
        {content.connections.map(edge => {
            const from = nodes.find(n => n.id === edge.from), to = nodes.find(n => n.id === edge.to);
            return from && to ? <path key={edge.id} d={`M${from.x},${from.y} C${(from.x + to.x) / 2},${from.y} ${(from.x + to.x) / 2},${to.y} ${to.x},${to.y}`}/> : null;
        })}
        {nodes.map(node => {const width=Math.min(150,Math.max(94,node.title.length*7+26));return <g key={node.id}><title>{node.title}</title><rect x={node.x-width/2} y={node.y-20} width={width} height="40" rx="5"/><text x={node.x} y={node.y+5} textAnchor="middle">{node.title.length>18?node.title.slice(0,17)+'…':node.title}</text><circle cx={node.x-width/2} cy={node.y} r="4"/></g>;})}
    </svg>{content.nodes.length > 6 && <small>Showing 6 of {content.nodes.length} ideas</small>}</div>;
}

export function ScratchpadCard({ widget }: { widget: Extract<Widget, { type: 'scratchpad' }> }) {
    const [intent, setIntent] = useState<'open' | 'new' | null>(null);
    const close = useCallback(() => setIntent(null), []);
    return <section className="widget insight-card scratchpad-card" aria-label={widget.title || 'Scratchpad'}><WidgetHeader widget={widget} leading={<InsightGlyph name="graph"/>} subtitle={<span className="insight-caption">{widget.content.nodes.length} ideas · {widget.content.connections.length} connections</span>} tools={<button className="insight-expand" aria-label="Expand Scratchpad" onClick={()=>setIntent('open')}><InsightGlyph name="expand"/></button>}/>
        <GraphPreview content={widget.content}/>
        <div className="insight-footer"><button className="insight-open" onClick={() => setIntent('open')}>Open idea canvas <Icon name="external"/></button><button className="small insight-add" onClick={() => setIntent('new')}><Icon name="plus"/>Idea</button></div>
        {intent && <Overlay fullPage modal label={`${widget.title || 'Scratchpad'} idea canvas`} onClose={close}><IdeaCanvas widget={widget} close={close} startNew={intent === 'new'}/></Overlay>}
    </section>;
}

export function WellbeingCard({ widget }: { widget: Extract<Widget, { type: 'wellbeing' }> }) {
    const [open, setOpen] = useState(false), [range,setRange] = useState<1|7|30>(7);
    const close = useCallback(() => setOpen(false), []);
    const document = useDashboard().document;
    const [now, setNow] = useState(Date.now);
    useEffect(() => { const tick = setInterval(() => setNow(Date.now()), document?.wellbeingHistory?.active.length ? 15000 : 60000); return () => clearInterval(tick); }, [document?.wellbeingHistory?.active.length]);
    useEffect(()=>setNow(Date.now()),[document?.wellbeingHistory]);
    if (!document) return null;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const summary = wellbeingStats(document, now, zone, range), hasData = summary.workMs > 0 || summary.sessions > 0 || summary.habits > 0 || summary.breaks > 0;
    const max = Math.max(1, ...summary.days.map(day => summary.workMs>0?day.workMs:day.sessions));
    return <section className="widget insight-card wellbeing-card" aria-label={widget.title || 'Wellbeing'}><WidgetHeader widget={widget} leading={<InsightGlyph name="sun"/>} tools={<><select className="wellbeing-card-period" aria-label="Wellbeing card period" value={range} onChange={e=>setRange(Number(e.target.value) as 1|7|30)}><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><button className="insight-expand" aria-label="Expand Wellbeing" onClick={()=>setOpen(true)}><Icon name="expand" className="insight-glyph"/></button></>}/>
        {hasData ? <div className="wellbeing-snapshot"><div><strong>{summary.workMs>0?sessionTime(summary.workMs):summary.sessions}</strong><span>{summary.workMs>0?'Focus time':'Existing focus completions'}</span></div><div className={`wellbeing-sparkline ${range===30?'many-days':''}`} role="img" aria-label={summary.days.map(day => `${day.label}: ${summary.workMs>0?sessionTime(day.workMs):day.sessions+' existing focus completions'}`).join(', ')}>{summary.days.map((day,i) => <div key={day.date}><i style={{ height: `${(summary.workMs>0?day.workMs:day.sessions) ? Math.max(4, (summary.workMs>0?day.workMs:day.sessions) / max * 56) : 1}px` }}/><span>{range===30?(i%7===0?day.date.slice(8):''):day.label[0]}</span></div>)}</div></div> : <div className="wellbeing-empty"><p>Your week starts here.</p><span>Choose local recording in View stats, or keep it off.</span></div>}
        <div className="insight-footer"><span className="insight-caption">{hasData ? `${summary.breaks} breaks · ${summary.habits} habits` : 'No recorded activity yet'}</span><button className="insight-open" onClick={() => setOpen(true)}>View stats <Icon name="external"/></button></div>
        {open && <Overlay fullPage modal label={`${widget.title || 'Wellbeing'} statistics`} onClose={close}><WellbeingPage document={document} now={now} zone={zone} close={close}/></Overlay>}
    </section>;
}
