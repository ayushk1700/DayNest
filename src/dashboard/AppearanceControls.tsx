import { useEffect, useId, useRef, useState } from 'react';
import type { CardAppearance, WidgetType } from '../state/model';
import { emptyAppearance, WIDGET_TYPES } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { resolveAppearance, widgetTypeLabels } from '../ui/cardAppearance';
import { WidgetFrame } from './WidgetFrame';
import { WidgetContent } from '../widgets/DashboardWidgets';
import { createWidget } from './layout';
import { PresetControls } from './PresetControls';
import { appearanceKeys, widgetAppearance } from '../ui/cardAppearance';
import { appearanceSnapshot } from '../ui/appearanceSnapshot';
import { useWorkspaceTools, workspaceTools } from '../state/workspace-tools';

type Key = keyof CardAppearance;
type Field = { key: Key; label: string; options?: [string, string][]; min?: number; max?: number; step?: number; unit?: string };
const fields: { name: string; fields: Field[] }[] = [
    { name: 'Text', fields: [
        { key: 'fontFamily', label: 'Font', options: [['system', 'System UI'], ['sans', 'Arial / Helvetica'], ['serif', 'Georgia / Times'], ['mono', 'Consolas / Courier'], ['handwritten', 'Handwritten / cursive']] },
        { key: 'textSize', label: 'Text size', min: 10, max: 24, step: 1, unit: 'px' },
        { key: 'headingWeight', label: 'Heading weight', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']] },
        { key: 'lineSpacing', label: 'Line spacing', min: 1, max: 2.2, step: .1 },
    ] },
    { name: 'Surface', fields: [
        { key: 'surface', label: 'Surface', options: [['solid', 'Solid'], ['glass', 'Glass']] },
        { key: 'backgroundColor', label: 'Background color' },
        { key: 'backgroundOpacity', label: 'Background opacity', min: 0, max: 100, step: 1, unit: '%' },
        { key: 'backgroundBlur', label: 'Background blur', min: 0, max: 32, step: 1, unit: 'px' },
        { key: 'borderColor', label: 'Border color' },
        { key: 'borderWidth', label: 'Border width', options: [['thin', 'Thin'], ['medium', 'Medium'], ['thick', 'Thick']] },
        { key: 'corners', label: 'Corners', options: [['square', 'Slightly rounded'], ['rounded', 'Rounded'], ['soft', 'Extra soft']] },
        { key: 'shadow', label: 'Shadow', options: [['none', 'None'], ['soft', 'Soft'], ['lifted', 'Lifted']] },
    ] },
    { name: 'Spacing', fields: [{ key: 'padding', label: 'Padding', options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']] }] },
    { name: 'Header', fields: [
        { key: 'titleVisibility', label: 'Title', options: [['visible', 'Visible'], ['hidden', 'Hidden']] },
        { key: 'titleAlignment', label: 'Title alignment', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
        { key: 'controlsVisibility', label: 'Card controls', options: [['always', 'Always shown'], ['hover', 'On hover or keyboard focus']] },
    ] },
];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const baseline: Partial<Record<Key, string | number>> = { backgroundColor: '#f8fcfd', borderColor: '#d6e0e3', textSize: 14, lineSpacing: 1.5, backgroundOpacity: 100, backgroundBlur: 0 };
function cleared(draft: CardAppearance, keys: Key[]): CardAppearance {
    const next = { ...draft }, legacy = emptyAppearance();
    for (const key of keys) { if (key in legacy) Object.assign(next, { [key]: null }); else delete next[key]; }
    return next;
}
export function AppearanceControls({ widgetId, widgetIds, chooseTarget = false, onSaved, onCancel }: { widgetId?: string; widgetIds?: string[]; chooseTarget?: boolean; onSaved?: () => void; onCancel?: () => void }) {
    const state = useDashboard(), doc = state.document!;
    const { advanced } = useWorkspaceTools();
    const uid = useId();
    const batch = widgetIds !== undefined;
    const batchWidgets = doc.widgets.filter(w => widgetIds?.includes(w.id));
    const [batchBase] = useState(() => batchWidgets.map(w => ({ id: w.id, expected: structuredClone(w.appearance) })));
    const [batchSnapshots] = useState(() => batchWidgets.map(w => {
        const frame = document.querySelector<HTMLElement>(`[data-widget-id="${w.id}"]`);
        const card = frame?.querySelector<HTMLElement>('.widget,.sticky');
        return card ? appearanceSnapshot(doc, w, card) : widgetAppearance(doc, w);
    }));
    const [touched, setTouched] = useState<Key[]>([]);
    const editor = useRef<HTMLDivElement>(null);
    const [selected, setSelected] = useState(widgetId ?? '');
    const type = selected.startsWith('type:') ? selected.slice(5) as WidgetType : undefined;
    const widget = batch ? batchWidgets[0] : selected && !type ? doc.widgets.find(w => w.id === selected) : undefined;
    const live = batch ? widget?.appearance : type ? doc.typeAppearance?.[type] ?? emptyAppearance() : selected ? widget?.appearance : doc.appearance;
    const [base, setBase] = useState(() => structuredClone(live ?? emptyAppearance()));
    const [draft, setDraft] = useState(() => structuredClone(live ?? emptyAppearance()));
    const [saving, setSaving] = useState(false), [pinBusy, setPinBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const dirty = batch ? touched.length > 0 : !same(draft, base);
    useEffect(() => { if (!dirty && !saving && live && !same(live, base)) { setBase(structuredClone(live)); setDraft(structuredClone(live)); } }, [live, dirty, saving, base]);
    const disabled = saving || state.pending > 0 || state.status !== 'ready' || !live;
    const resolution = widget ? resolveAppearance(doc.appearance, doc.typeAppearance?.[widget.type], draft)
        : type ? resolveAppearance(doc.appearance, draft) : resolveAppearance(draft);
    const inherited = widget ? resolveAppearance(doc.appearance, doc.typeAppearance?.[widget.type]) : type ? resolveAppearance(doc.appearance) : resolveAppearance(emptyAppearance());
    const sampleType = widget?.type ?? type ?? 'notes';
    const sample = structuredClone(widget ?? doc.widgets.find(w => w.type === sampleType) ?? createWidget(sampleType, 'appearance-sample'));
    sample.id = 'appearance-preview'; sample.size = { width: Math.min(400, Math.max(260, sample.size.width)), height: Math.min(350, Math.max(250, sample.size.height)) };
    if (!widget) sample.title = widgetTypeLabels[sampleType];
    function mark(keys: Key[]) { setTouched(old => [...new Set([...old, ...keys])]); }
    function loadPreset(value: CardAppearance) { setDraft(structuredClone(value)); mark([...appearanceKeys]); setMessage(''); }
    function field(key: Key, value: unknown) { mark([key]); setDraft(old => value == null ? cleared(old, [key]) : { ...old, [key]: value }); setMessage(''); }
    function cancel() { const next = structuredClone(live ?? emptyAppearance()); setBase(next); setDraft(next); setTouched([]); setError(''); setMessage('Changes cancelled. Saved appearance kept.'); onCancel?.(); }
    function save() {
        if (disabled || !dirty) return;
        const invalid = Array.from(editor.current?.querySelectorAll<HTMLInputElement>('input[type="number"]') ?? []).find(input => !input.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
        const value = structuredClone(draft); setSaving(true); setError(''); setMessage('');
        const action = batch ? { type: 'appearanceBatch' as const, targets: batchBase, patch: Object.fromEntries(touched.map(key => [key, draft[key] ?? null])) as Partial<CardAppearance> } : { type: 'appearance' as const, widgetId: widget?.id, widgetType: type, expected: base, value };
        void dashboardStore.dispatch(action).then(() => { setBase(value); setTouched([]); setMessage('Appearance saved.'); onSaved?.(); }).catch(e => setError(e.message + ' Your draft is still here.')).finally(() => setSaving(false));
    }
    return <div ref={editor} className="appearance-controls">
        {batch && <p className="appearance-help">Editing {batchWidgets.length} selected widgets. Mixed values stay unchanged unless you edit them.</p>}
        {advanced && <PresetControls draft={draft} onLoad={loadPreset}/>}
        {chooseTarget && <label className="appearance-target">Customize scope<select aria-label="Customize scope" disabled={saving} value={selected} onChange={event => {
            if (dirty) { setError('Save or Cancel your changes before switching scope.'); return; }
            const id = event.target.value;
            const next = id.startsWith('type:') ? doc.typeAppearance?.[id.slice(5) as WidgetType] ?? emptyAppearance() : id ? doc.widgets.find(w => w.id === id)?.appearance : doc.appearance;
            if (!next) return;
            setSelected(id); setBase(structuredClone(next)); setDraft(structuredClone(next)); setError(''); setMessage('');
        }}><option value="">Global defaults · all widget types</option>{advanced && <optgroup label="Widget-type defaults">{WIDGET_TYPES.map(t => <option value={`type:${t}`} key={t}>{widgetTypeLabels[t]}</option>)}</optgroup>}<optgroup label="Individual widgets">{doc.widgets.map(w => <option value={w.id} key={w.id}>{w.title || 'Untitled'} · {widgetTypeLabels[w.type]}</option>)}</optgroup></select></label>}
        <p className="appearance-help">Theme → Global defaults → Widget-type defaults → Individual widget. Only explicit overrides are saved. Preview changes below, then Save or Cancel.</p>
        {!live && <p role="alert">This widget was removed. Close this editor or select another scope.</p>}
        {!batch && widget && <label className="appearance-inherit"><input type="checkbox" aria-label="Pin position and size" checked={widget.pinned} disabled={disabled || pinBusy} onChange={event => {
            const value = event.target.checked;
            setPinBusy(true); setError('');
            void dashboardStore.dispatch({ type: 'pin', widgetId: widget.id, expected: widget.pinned, value }).catch(e => setError(e.message)).finally(() => setPinBusy(false));
        }}/>Pin position and size <small>Saved immediately. Unpin an off-screen card here before using Recover widgets.</small></label>}
        <div className="appearance-preview-area" aria-label="Live appearance preview"><div className="appearance-preview-caption">Live preview · {widgetTypeLabels[sampleType]}{!widget && ' inheriting these defaults'}</div><div className="appearance-preview-window" style={{ minHeight: sample.size.height + 24 }}><WidgetFrame widget={sample} narrow zoom={1} preview appearanceOverride={resolution.value}><WidgetContent widget={sample}/></WidgetFrame></div><p className="appearance-help">Paper, photo and clock skins stay intact until you override their appearance. System fonts work offline. Opacity is kept high enough for readable text; reduced transparency uses an opaque surface.</p></div>
        {(advanced ? fields : [{ name: 'Appearance', fields: fields[1].fields.filter(f => ['borderColor', 'backgroundColor', 'borderWidth', 'corners', 'shadow'].includes(f.key)) }]).map(section => <fieldset className="appearance-section-fields" key={section.name} disabled={disabled}><legend>{section.name}</legend><button type="button" className="appearance-section-reset" onClick={() => { mark(section.fields.map(f => f.key)); setDraft(old => cleared(old, section.fields.map(f => f.key))); setMessage(''); }}>Reset {section.name.toLowerCase()}</button><div className="appearance-field-grid">{section.fields.map(f => {
            const mixed = batch && !touched.includes(f.key) && batchSnapshots.some(value => value[f.key] !== batchSnapshots[0]?.[f.key]);
            const own = draft[f.key] != null;
            const value = resolution.value[f.key];
            const inheritedValue = inherited.value[f.key];
            const source = resolution.sources[f.key];
            const description = `${uid}-${f.key}-source`;
            const inheritLabel = `Use inherited value${inheritedValue != null ? ` (${inheritedValue}${f.unit ?? ''})` : ' (theme / skin)'}`;
            return <div className="appearance-field" key={f.key}><label htmlFor={`${uid}-${f.key}`}>{f.label}{f.unit && ` (${f.unit})`}</label>
                {f.options ? <select id={`${uid}-${f.key}`} aria-describedby={description} value={mixed ? '__mixed' : draft[f.key] ?? ''} onChange={e => field(f.key, e.target.value || null)}><option value="">{inheritLabel}</option>{mixed && <option value="__mixed" disabled>Mixed</option>}{f.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
                : f.min != null ? <><label className="appearance-inherit"><input type="checkbox" aria-label={`Use inherited value for ${f.label.toLowerCase()}`} checked={!own && !mixed} onChange={e => field(f.key, e.target.checked ? null : value ?? baseline[f.key])}/>{inheritLabel}</label><input id={`${uid}-${f.key}`} aria-describedby={description} type="number" min={f.min} max={f.max} step={f.step} required disabled={!own && !mixed} value={value ?? baseline[f.key]} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) field(f.key, e.target.valueAsNumber); }}/></>
                : <><label className="appearance-inherit"><input type="checkbox" aria-label={`Use inherited value for ${f.label.toLowerCase()}`} checked={!own} onChange={e => field(f.key, e.target.checked ? null : value ?? baseline[f.key])}/>{inheritLabel}</label><input id={`${uid}-${f.key}`} aria-describedby={description} type="color" disabled={!own} value={String(value ?? baseline[f.key])} onChange={e => field(f.key, e.target.value)}/></>}
                <small id={description}>{mixed ? 'Mixed · values differ across the selection. ' : ''}Source: {mixed ? 'Multiple values' : source}{value != null ? ` · ${value}${f.unit ?? ''}` : ' · theme / skin default'}{own && ' · override'}</small>
            </div>;
        })}</div></fieldset>)}
        {dirty && <p className="appearance-help" role="status">Unsaved appearance changes</p>}{error && <p className="local-error" role="alert">{error}</p>}{message && <p className="appearance-help" role="status">{message}</p>}
        <div className="appearance-actions"><button type="button" className="small" disabled={disabled} onClick={() => { const keys = advanced ? [...appearanceKeys] : Object.keys(emptyAppearance()) as Key[]; mark(keys); setDraft(old => cleared(old, keys)); setError(''); setMessage(''); }}>Clear all overrides</button><button type="button" className="small" disabled={saving} onClick={cancel}>Cancel</button><button type="button" onClick={save} className="primary" disabled={disabled || !dirty}>{saving ? 'Saving…' : 'Save appearance'}</button></div>
    </div>;
}
export function AppearanceSection() {
    const { advanced } = useWorkspaceTools();
    return <section className="appearance-section"><h2>Card customization</h2><button type="button" className="small advanced-customization-toggle" aria-pressed={advanced} aria-expanded={advanced} onClick={() => workspaceTools.update({ advanced: !advanced, selecting: false, selected: [], message: '' })}>{advanced ? 'Close Advanced Customization' : 'Advanced Customization'}</button><p className="appearance-help">{advanced ? 'Advanced tools are on for this session. Close them to return to basic controls; saved styles stay intact.' : 'Open Advanced Customization for text, surfaces, headers, presets, selection and layout tools.'}</p><AppearanceControls key={advanced ? 'advanced' : 'basic'} chooseTarget/></section>;
}
