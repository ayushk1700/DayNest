import { useEffect, useState } from 'react';
import { dashboardStore } from '../state/store';
export function ZoomControl({ value }: {
    value: number;
}) {
    const [draft, setDraft] = useState(value), [base, setBase] = useState(value), [saving, setSaving] = useState(false), [error, setError] = useState('');
    const dirty = draft !== base;
    useEffect(() => { if (!dirty && !saving) {
        setBase(value);
        setDraft(value);
    } }, [value, dirty, saving]);
    useEffect(() => { if (!dirty || saving || error)
        return; const timer = setTimeout(() => { setSaving(true); void dashboardStore.dispatch({ type: 'zoom', expected: base, value: draft }).then(() => setBase(draft)).catch(e => setError(e.message)).finally(() => setSaving(false)); }, 180); return () => clearTimeout(timer); }, [draft, base, dirty, saving, error]);
    return <section className="zoom"><div><h2><label htmlFor="zoom">Zoom</label></h2><span>{Math.round(draft * 100)}%</span></div><input id="zoom" type="range" min="25" max="200" step="5" value={Math.round(draft * 100)} onChange={e => { setError(''); setDraft(Number(e.target.value) / 100); }}/>{saving && <p role="status">Saving zoom…</p>}{error && <p role="alert">{error}<button onClick={() => { setBase(value); setDraft(value); setError(''); }}>Use saved zoom</button></p>}<p className="settings-note">Narrow windows use a readable flowing layout without changing your desktop layout or zoom.</p></section>;
}
