export interface WeatherDay { date: string; code: number; highC: number; lowC: number; }
export interface WeatherSnapshot {
    temperatureC: number;
    condition: string;
    observedAt: number;
    city: string;
    code?: number;
    timeZone?: string;
    daily?: WeatherDay[];
}
export interface WeatherProvider {
    id: string;
    label: string;
    current(city: string, signal: AbortSignal): Promise<unknown>;
}
const codes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm with hail',
};
export const weatherCondition = (code: number): string => codes[code] ?? 'Weather unavailable';
const number = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function dateInZone(time: number, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time);
    const part = (key: string) => parts.find(p => p.type === key)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
const locations = new Map<string, { latitude: number; longitude: number; city: string; at: number }>();
async function json(url: URL, signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw Error(response.status === 429 ? 'Weather service is busy. Please try again later.' : 'The weather service is unavailable. Try again shortly.');
    const text = await response.text();
    if (text.length > 1000000) throw Error('Invalid weather response.');
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid weather response.');
    return data as Record<string, unknown>;
}
export function parseForecast(raw: Record<string, unknown>, city: string): WeatherSnapshot {
    const current = raw.current as Record<string, unknown> | undefined;
    const daily = raw.daily as Record<string, unknown> | undefined;
    if (!current || !number(current.temperature_2m, -150, 100) || !number(current.time, 0, 8640000000000) || !Number.isInteger(current.weather_code) || !Object.hasOwn(codes, String(current.weather_code)) || typeof raw.timezone !== 'string') throw Error('Invalid weather response.');
    try { new Intl.DateTimeFormat('en', { timeZone: raw.timezone }); } catch { throw Error('Invalid weather timezone.'); }
    if (!daily || !['time', 'weather_code', 'temperature_2m_max', 'temperature_2m_min'].every(key => Array.isArray(daily[key]) && (daily[key] as unknown[]).length === 7)) throw Error('Invalid forecast response.');
    const dates = daily.time as unknown[], dayCodes = daily.weather_code as unknown[], highs = daily.temperature_2m_max as unknown[], lows = daily.temperature_2m_min as unknown[];
    const forecast = dates.map((time, i) => {
        if (!number(time, 0, 8640000000000) || !number(highs[i], -150, 100) || !number(lows[i], -150, 100) || (lows[i] as number) > (highs[i] as number) || !Number.isInteger(dayCodes[i]) || !Object.hasOwn(codes, String(dayCodes[i]))) throw Error('Invalid forecast response.');
        return { date: dateInZone(time * 1000, raw.timezone as string), code: dayCodes[i] as number, highC: highs[i] as number, lowC: lows[i] as number };
    });
    if (new Set(forecast.map(d => d.date)).size !== 7 || forecast.some((day, i) => i > 0 && Date.parse(day.date) - Date.parse(forecast[i - 1].date) !== 86400000)) throw Error('Invalid forecast dates.');
    return { temperatureC: current.temperature_2m, condition: weatherCondition(current.weather_code as number), observedAt: current.time * 1000, city, code: current.weather_code as number, timeZone: raw.timezone, daily: forecast };
}
export const configuredProvider: WeatherProvider = {
    id: 'open-meteo', label: 'Open-Meteo',
    async current(city, signal) {
        const key = city.toLocaleLowerCase();
        const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
        let place = locations.get(key);
        if (!place || Date.now() - place.at > 86400000) {
            const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
            url.search = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' }).toString();
            const result = await json(url, requestSignal);
            const first = Array.isArray(result.results) ? result.results[0] as Record<string, unknown> | undefined : undefined;
            if (!first) throw Error('City not found. Try a city and country, for example Paris, France.');
            if (!number(first.latitude, -90, 90) || !number(first.longitude, -180, 180) || typeof first.name !== 'string' || first.name.length > 200 || (first.country !== undefined && (typeof first.country !== 'string' || first.country.length > 200))) throw Error('Invalid city response.');
            place = { latitude: first.latitude, longitude: first.longitude, city: [first.name, first.country].filter(Boolean).join(', ').slice(0, 200), at: Date.now() };
            if (locations.size >= 20) locations.delete(locations.keys().next().value!);
            locations.set(key, place);
        }
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,weather_code', daily: 'weather_code,temperature_2m_max,temperature_2m_min', forecast_days: '7', timezone: 'auto', timeformat: 'unixtime' }).toString();
        return parseForecast(await json(url, requestSignal), place.city);
    },
};
const caches = new WeakMap<WeatherProvider, Map<string, { at: number; value: WeatherSnapshot }>>();
export async function requestWeather(provider: WeatherProvider | null, city: string, signal: AbortSignal, force = false): Promise<WeatherSnapshot> {
    if (!provider) throw Error('No weather provider configured.');
    if (!city.trim()) throw Error('Choose a city first.');
    if (signal.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    const cache = caches.get(provider) ?? new Map<string, { at: number; value: WeatherSnapshot }>();
    caches.set(provider, cache);
    const key = city.trim().toLocaleLowerCase();
    const stored = cache.get(key);
    if (!force && stored && Date.now() - stored.at < 900000) return structuredClone(stored.value);
    const raw = await provider.current(city.trim(), signal);
    if (signal.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    if (!raw || typeof raw !== 'object') throw Error('Invalid weather response.');
    const result = raw as Record<string, unknown>;
    if (!number(result.temperatureC, -150, 100) || typeof result.condition !== 'string' || result.condition.length > 120 || !number(result.observedAt, 0, 8640000000000000) || !Number.isSafeInteger(result.observedAt) || typeof result.city !== 'string' || result.city.length > 200) throw Error('Invalid weather response.');
    const value: WeatherSnapshot = { temperatureC: result.temperatureC, condition: result.condition, observedAt: result.observedAt, city: result.city };
    if (result.timeZone !== undefined) { if (typeof result.timeZone !== 'string') throw Error('Invalid weather response.'); try { new Intl.DateTimeFormat('en', { timeZone: result.timeZone }); } catch { throw Error('Invalid weather response.'); } value.timeZone = result.timeZone; }
    if (result.code !== undefined) { if (!Number.isInteger(result.code) || !Object.hasOwn(codes, String(result.code))) throw Error('Invalid weather response.'); value.code = result.code as number; }
    if (result.daily !== undefined) {
        if (!Array.isArray(result.daily) || result.daily.length !== 7) throw Error('Invalid forecast response.');
        value.daily = result.daily.map((day: WeatherDay) => {
            if (!day || typeof day.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day.date) || Number.isNaN(Date.parse(day.date)) || new Date(day.date).toISOString().slice(0, 10) !== day.date || !Number.isInteger(day.code) || !Object.hasOwn(codes, String(day.code)) || !number(day.highC, -150, 100) || !number(day.lowC, -150, 100) || day.lowC > day.highC) throw Error('Invalid forecast response.');
            return { date: day.date, code: day.code, highC: day.highC, lowC: day.lowC };
        });
        if (new Set(value.daily.map(d => d.date)).size !== 7 || value.daily.some((day, i) => i > 0 && Date.parse(day.date) - Date.parse(value.daily![i - 1].date) !== 86400000)) throw Error('Invalid forecast dates.');
    }
    if (cache.size >= 20) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
    return structuredClone(value);
}
