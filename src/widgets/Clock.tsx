import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Widget } from '../state/model';
import { dashboardStore } from '../state/store';
import { useNow } from '../timing/hooks';
import { WidgetSkinControls } from './WidgetSkinControls';
import { clockPresentation } from './clockPresentation';

// Seven-segment numerals stay sharp at every card size, without a remote font.
const segments = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abfgcd'];
const paths = [
    'M8 3H32L36 7L32 11H8L4 7Z', 'M33 12L37 8L39 12V33L35 37L31 33Z',
    'M35 41L39 45V66L35 70L31 66V45Z', 'M8 67H30L34 71L30 75H8L4 71Z',
    'M3 41L7 45V66L3 70L0 66V45Z', 'M3 8L7 12V33L3 37L0 33V12Z',
    'M8 35H30L34 39L30 43H8L4 39Z',
];
function Digits({ value }: { value: string }) {
    return <svg className="lcd-digits" viewBox={`0 0 ${value.length * 47 - 8} 78`} aria-hidden="true">{Array.from(value).map((n, i) => <g key={i} transform={`translate(${i * 47} 0) skewX(-3)`}>{paths.map((d, j) => <path key={j} d={d} opacity={segments[Number(n)].includes('abcdefg'[j]) ? 1 : .065}/>)}</g>)}</svg>;
}
export function Clock({ widget, header }: { widget: Extract<Widget, { type: 'clock' }>; header: ReactNode }) {
    const now = useNow(), date = new Date(now), parts = clockPresentation(now, widget.settings.hour24);
    const style = widget.settings.style ?? 'simple';
    const [error, setError] = useState(''), [hour24, setHour24] = useState(widget.settings.hour24), [busy, setBusy] = useState(false);
    useEffect(() => { if (!busy) setHour24(widget.settings.hour24); }, [busy, widget.settings.hour24]);
    const spoken = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !hour24 }).format(now);
    return <section className={`widget clock-card clock-${style}`} aria-label={widget.title || 'Clock'}>{header}
        <time className="clock-face" dateTime={date.toISOString()} role="timer" aria-label="Local time"><span className="visually-hidden">{spoken}</span>
            {style === 'simple' ? <div aria-hidden="true"><div className="clock-time">{spoken}</div><p className="clock-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(now)}</p></div>
            : style === 'digital' ? <div className="digital-case" aria-hidden="true"><span className="clock-knob"/><span className="clock-side-key"/><div className="clock-lcd"><div className="lcd-top"><span>LOCAL TIME</span><span>{parts.period || '24H'}</span></div><div className="lcd-main"><Digits value={parts.hours}/><span className="lcd-colon">:</span><Digits value={parts.minutes}/></div><div className="lcd-day">{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(now)}</div><div className="lcd-bottom"><span>{String(date.getDate()).padStart(2, '0')} / {String(date.getMonth() + 1).padStart(2, '0')}</span><span className="lcd-seconds"><Digits value={parts.seconds}/></span></div></div></div>
            : <div className="analog-case" aria-hidden="true"><svg className="analog-dial" viewBox="0 0 240 210"><g className="dial-ticks"><path d="M120 17v8M120 185v8M19 105h8M213 105h8"/></g><g transform={`rotate(${parts.hourAngle} 120 105)`}><path className="hour-hand" d="M120 110V53"/></g><g transform={`rotate(${parts.minuteAngle} 120 105)`}><path className="minute-hand" d="M120 114V29"/></g><g transform={`rotate(${parts.secondAngle} 120 105)`}><path className="second-hand" d="M120 124V30"/></g><circle className="clock-hub" cx="120" cy="105" r="11"/><circle className="hub-light" cx="117" cy="102" r="3"/></svg></div>}
        </time>
        <div className="clock-options"><WidgetSkinControls widget={widget}/><label className="clock-format"><input type="checkbox" checked={hour24} disabled={busy} onChange={e => {
            const value = e.target.checked; setHour24(value); setBusy(true); setError('');
            void dashboardStore.dispatch({ type: 'clockFormat', widgetId: widget.id, expected: widget.settings.hour24, value }).catch(e => { setHour24(widget.settings.hour24); setError(e.message); }).finally(() => setBusy(false));
        }}/>24-hour clock</label></div>{error && <p className="local-error" role="alert">{error}</p>}
    </section>;
}
