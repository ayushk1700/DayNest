import { useState } from 'react';
import type { Widget, ClockStyle, NoteSkin } from '../state/model';
import { noteSkin } from '../state/model';
import { dashboardStore } from '../state/store';

export function WidgetSkinControls({ widget, customization = false }: { widget: Widget; customization?: boolean }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    if (widget.type !== 'clock' && widget.type !== 'notes') return null;
    const clock = widget.type === 'clock';
    return <div className={`skin-controls ${customization ? 'skin-customization' : ''}`}>
        <label>{clock ? 'Clock style' : 'Notes paper'}<select aria-label={clock ? 'Clock style' : 'Notes paper'} disabled={busy} value={clock ? widget.settings.style ?? 'simple' : noteSkin(widget.settings)} onChange={e => {
            setBusy(true); setError('');
            const action = widget.type === 'clock'
                ? { type: 'clockStyle' as const, widgetId: widget.id, expected: widget.settings.style ?? 'simple', value: e.target.value as ClockStyle }
                : { type: 'notesSkin' as const, widgetId: widget.id, expected: noteSkin(widget.settings), value: e.target.value as NoteSkin };
            void dashboardStore.dispatch(action).catch(e => setError(e.message)).finally(() => setBusy(false));
        }}>{clock ? <><option value="simple">Simple</option><option value="digital">Digital alarm clock</option><option value="analog">Rounded analog</option></> : <><option value="plain">Plain paper</option><option value="lined">Lined paper</option><option value="grid">Grid paper</option><option value="dotted">Dotted paper</option><option value="kraft">Kraft paper</option></>}</select></label>
        {customization && <small>Style changes save immediately.</small>}
        {error && <p className="local-error" role="alert">{error}</p>}
    </div>;
}
