import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { dashboardStore } from '../state/store';
import { DraftField } from '../ui/DraftField';
import { IconButton } from '../ui/IconButton';
import { useNow } from '../timing/hooks';
import { addDays, dayKey, parseDay } from './dates';
import { configuredProvider, dateInZone, requestWeather, weatherCondition } from '../weather/provider';
import type { WeatherSnapshot } from '../weather/provider';
import { Icon, type Name as IconName } from '../ui/Icon';

function WeatherSymbol({ code }: { code: number }) {
    const snow = code >= 71 && code <= 77 || code === 85 || code === 86;
    const rain = code >= 51;
    const name: IconName = code >= 0 && code <= 1 ? 'sun' : snow ? 'snowflake' : rain ? 'rain' : 'weather';
    return <Icon name={name} className="weather-symbol"/>;
}
export function Weather({ widget, header }: { widget: Extract<Widget, { type: 'weather' }>; header: ReactNode }) {
    const [data, setData] = useState<WeatherSnapshot | null>(null), [error, setError] = useState('');
    const [loading, setLoading] = useState(false), [unitBusy, setUnitBusy] = useState(false);
    const [refresh, setRefresh] = useState({ key: 0, force: false });
    const previousCity = useRef(widget.content.city);
    const now = useNow();
    useEffect(() => {
        const update = () => { if (document.visibilityState === 'visible') setRefresh(old => ({ key: old.key + 1, force: false })); };
        const timer = setInterval(update, 900000);
        window.addEventListener('online', update); window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
        return () => { clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
    }, []);
    useEffect(() => {
        if (previousCity.current !== widget.content.city) setData(null);
        previousCity.current = widget.content.city;
        setError(''); setLoading(false);
        if (!widget.content.city.trim()) return;
        const controller = new AbortController();
        setLoading(true);
        void requestWeather(configuredProvider, widget.content.city, controller.signal, refresh.force).then(value => {
            if (!controller.signal.aborted) setData(value);
        }).catch(e => {
            if (!controller.signal.aborted) setError(e instanceof Error && !['TypeError', 'TimeoutError'].includes(e.name) ? e.message : 'Weather could not update. Check your connection and try Refresh.');
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [widget.content.city, refresh]);
    const fahrenheit = widget.settings.units === 'fahrenheit';
    const degrees = (value: number) => Math.round(fahrenheit ? value * 9 / 5 + 32 : value);
    const today = data?.timeZone ? dateInZone(now, data.timeZone) : dayKey(new Date(now));
    const forecast = data?.daily;
    const days = forecast ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i), code: -1, highC: 0, lowC: 0 }));
    const headline = data ? data.temperatureC >= 28 ? 'It’s hot.' : data.temperatureC >= 20 ? 'It’s warm.' : data.temperatureC >= 10 ? 'It’s cool.' : 'It’s cold.' : 'Your sky.';
    return <section className="widget weather-card" aria-label={widget.title || 'Weather'}>{header}<div className="weather-content">
        <div className="weather-city"><Icon name="location" className="weather-location"/><DraftField label="Weather city" maxLength={200} placeholder="City, country…" value={widget.content.city}
            onSave={(expected, value) => dashboardStore.dispatch({ type: 'weatherCity', widgetId: widget.id, expected, value })}/></div>
        <p className="weather-headline">{headline}</p>
        <div className="weather-description">
            {data ? <><p>{data.condition} · {data.city}</p><time dateTime={new Date(data.observedAt).toISOString()}>Updated {new Date(data.observedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{loading ? ' · Refreshing…' : ''}</time></>
                : loading ? <p role="status">Loading live weather…</p> : <p>{error ? 'Weather unavailable. Please try again.' : 'Enter a city to see live weather.'}</p>}
        </div>
        <div className="weather-reading"><div className="weather-temperature" aria-label={data ? `${degrees(data.temperatureC)} degrees ${widget.settings.units}` : 'Temperature unavailable'}>
            <span aria-hidden="true">{data ? degrees(data.temperatureC) : '—'}</span><sup aria-hidden="true">°{fahrenheit ? 'F' : 'C'}</sup>
        </div><div className="weather-units" role="group" aria-label="Temperature units">
            {(['celsius', 'fahrenheit'] as const).map(units => <button type="button" key={units} aria-label={units === 'celsius' ? 'Use Celsius' : 'Use Fahrenheit'} aria-pressed={widget.settings.units === units} disabled={unitBusy} onClick={() => {
                if (widget.settings.units === units) return;
                setUnitBusy(true); setError('');
                void dashboardStore.dispatch({ type: 'weatherUnits', widgetId: widget.id, expected: widget.settings.units, value: units }).catch(e => setError(e.message)).finally(() => setUnitBusy(false));
            }}>°{units === 'celsius' ? 'C' : 'F'}</button>)}
        </div></div>
        <div className="weather-week"><p className="weather-week-label">7-day forecast <span>{forecast ? 'High / low' : 'Unavailable'}</span></p>
            <ol aria-label={forecast ? 'Seven-day weather forecast' : 'Forecast unavailable'}>{days.map(day => <li key={day.date} aria-current={day.date === today ? 'date' : undefined}>
                {forecast ? <WeatherSymbol code={day.code}/> : <span className="forecast-mark" aria-hidden="true">—</span>}
                <time dateTime={day.date} aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(parseDay(day.date))}${forecast ? `, ${weatherCondition(day.code)}, high ${degrees(day.highC)}, low ${degrees(day.lowC)} degrees ${widget.settings.units}` : ', forecast unavailable'}`}>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(parseDay(day.date))}</time>
                {forecast && <span className="forecast-temperatures">{degrees(day.highC)}° <span>{degrees(day.lowC)}°</span></span>}
            </li>)}</ol>
        </div>
        {error && <p className="local-error" role="alert">{error}{data && ' Showing the last update.'}</p>}
        <div className="weather-source"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a>
            <IconButton icon="reset" label="Refresh weather" disabled={loading || !widget.content.city.trim()} onClick={() => setRefresh(old => ({ key: old.key + 1, force: true }))}/>
        </div>
        {!data && <p className="weather-privacy">Your entered city is sent to Open-Meteo. No GPS access.</p>}
    </div></section>;
}
