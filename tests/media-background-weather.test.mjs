import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, emptyBackground } = require('../.test-build/state/model.js');
const { migrateDashboard, validateDashboard } = require('../.test-build/state/validation.js');
const { applyAction, ConflictError } = require('../.test-build/state/actions.js');
const { diff, reverse, applyPatches } = require('../.test-build/state/history.js');
const { assetReferences, validateMediaHeader, MAX_VIDEO_BYTES } = require('../.test-build/assets/images.js');
const { parseBackup } = require('../.test-build/persistence/backup.js');
const { requestWeather, parseForecast, dateInZone, configuredProvider } = require('../.test-build/weather/provider.js');
const view = { width: 1600, height: 900 };

test('schema 3 migrates background defaults without mutating styles, dates, content or pins', () => {
    let old = applyAction(seedDashboard(), { type: 'createWidget', kind: 'date', id: 'date-test', view });
    old.schemaVersion = 3; delete old.background; old.widgets[0].pinned = true; old.widgets[0].appearance.borderColor = '#123456';
    const snapshot = structuredClone(old), next = migrateDashboard(old);
    assert.equal(next.schemaVersion,6); assert.deepEqual(next.background, emptyBackground());
    assert.deepEqual(next.widgets, old.widgets); assert.deepEqual(old, snapshot);
});
test('dashboard background is strict, conflict-safe, undoable and referenced for asset protection', () => {
    const before = seedDashboard(), value = { assetId: 'wallpaper', fit: 'cover', dim: 35 };
    const after = applyAction(before, { type: 'background', expected: before.background, value });
    assert(assetReferences(after).has('wallpaper'));
    assert.deepEqual(applyPatches(after, reverse(diff(before, after))).background, before.background);
    assert.throws(() => applyAction(after, { type: 'background', expected: before.background, value }), ConflictError);
    for (const change of [d => d.background.assetId = 'url(bad)', d => d.background.dim = 81, d => d.background.dim = 2.5, d => d.background.fit = 'stretch', d => d.background.extra = true]) {
        const invalid = structuredClone(after); change(invalid); assert.throws(() => validateDashboard(invalid));
    }
    assert.deepEqual(before.background, emptyBackground());
});
test('video cards keep local asset IDs, caption/fit history and strict upload boundaries', () => {
    let doc = applyAction(seedDashboard(), { type: 'createWidget', kind: 'video', id: 'clip', view });
    doc = applyAction(doc, { type: 'imageAsset', widgetId: 'clip', expected: null, value: 'clip-bytes' });
    doc = applyAction(doc, { type: 'imageCaption', widgetId: 'clip', expected: '', value: 'A moving memory' });
    const fitted = applyAction(doc, { type: 'imageFit', widgetId: 'clip', expected: 'contain', value: 'cover' });
    assert.equal(fitted.widgets.at(-1).content.caption, 'A moving memory'); assert(assetReferences(fitted).has('clip-bytes'));
    assert.equal(applyPatches(fitted, reverse(diff(doc, fitted))).widgets.at(-1).settings.fit, 'contain');
    const mp4 = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]);
    validateMediaHeader(mp4, 'video/mp4', 100); validateMediaHeader(webm, 'video/webm', MAX_VIDEO_BYTES);
    assert.throws(() => validateMediaHeader(mp4, 'video/webm', 100));
    assert.throws(() => validateMediaHeader(webm, 'video/webm', MAX_VIDEO_BYTES + 1));
    assert.throws(() => validateMediaHeader(new TextEncoder().encode('<script>'), 'video/mp4', 100));
});
test('portable backups include shared background/media references and reject format mismatches', () => {
    let doc = applyAction(seedDashboard(), { type: 'createWidget', kind: 'video', id: 'clip', view });
    doc.widgets.at(-1).content.assetId = 'video'; doc.background.assetId = 'paper';
    const backup = { format: 'purrductivity-backup', version: 1, exportedAt: new Date().toISOString(), dashboard: doc, images: [
        { id: 'video', type: 'video/webm', width: 100, height: 100, data: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).toString('base64') },
        { id: 'paper', type: 'image/png', width: 100, height: 100, data: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') },
    ] };
    assert.equal(parseBackup(JSON.stringify(backup)).images.length, 2);
    const wrong = structuredClone(backup); wrong.dashboard.background.assetId = 'video'; wrong.images.pop();
    assert.throws(() => parseBackup(JSON.stringify(wrong)));
    const missing = structuredClone(backup); missing.images.pop(); assert.throws(() => parseBackup(JSON.stringify(missing)));
});
function forecast() { return { timezone: 'Asia/Kolkata', current: { time: 1792492200, temperature_2m: 29, weather_code: 2 }, daily: {
    time: Array.from({ length: 7 }, (_, i) => 1792434600 + i * 86400), weather_code: [0,1,2,3,61,71,95], temperature_2m_max: [30,31,32,33,30,20,25], temperature_2m_min: [20,21,22,23,20,10,15],
} }; }
test('Open-Meteo parsing validates forecasts, conditions, units, dates and selected-city timezone', () => {
    const raw = forecast(), data = parseForecast(raw, 'Pune, India');
    assert.equal(data.temperatureC, 29); assert.equal(data.condition, 'Partly cloudy'); assert.equal(data.daily.length, 7);
    assert.equal(data.daily[0].date, dateInZone(raw.daily.time[0] * 1000, 'Asia/Kolkata'));
    assert.equal(dateInZone(Date.parse('2026-10-20T23:59:00Z'), 'Asia/Kolkata'), '2026-10-21');
    for (const change of [v => v.current.temperature_2m = NaN, v => v.current.weather_code = 999, v => v.timezone = 'bad/zone', v => v.daily.time[1] = v.daily.time[0], v => v.daily.temperature_2m_min[0] = 100, v => v.daily.weather_code.pop()]) {
        const bad = structuredClone(raw); change(bad); assert.throws(() => parseForecast(bad, 'Pune'));
    }
});
test('weather caching, forced refresh, cancellation and provider failures preserve genuine results', async () => {
    let calls = 0, fail = false;
    const provider = { id: 'test-cache', label: 'Test', current: async () => { calls++; if (fail) throw Error('offline'); return parseForecast(forecast(), 'Pune'); } };
    const signal = new AbortController().signal;
    const one = await requestWeather(provider, 'Pune', signal); one.daily[0].highC = -99;
    const two = await requestWeather(provider, 'Pune', signal); assert.equal(calls, 1); assert.notEqual(two.daily[0].highC, -99);
    await requestWeather(provider, 'Pune', signal, true); assert.equal(calls, 2);
    fail = true; await assert.rejects(requestWeather(provider, 'Pune', signal, true), /offline/);
    assert.equal((await requestWeather(provider, 'Pune', signal)).temperatureC, 29);
    const aborted = new AbortController(); aborted.abort(); await assert.rejects(requestWeather(provider, 'Pune', aborted.signal), /cancelled/);
});
test('configured weather provider uses only the two approved hosts and handles city and HTTP errors', async () => {
    const original = globalThis.fetch, calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push([url.toString(), options]);
        return new Response(JSON.stringify(url.hostname === 'geocoding-api.open-meteo.com' ? { results: [{ name: 'Testville', country: 'India', latitude: 18.5, longitude: 73.8 }] } : forecast()), { status: 200 });
    };
    try {
        const result = await requestWeather(configuredProvider, 'Unique city integration fixture', new AbortController().signal, true);
        assert.equal(result.city, 'Testville, India'); assert.equal(calls.length, 2);
        assert.deepEqual(calls.map(([url]) => new URL(url).hostname), ['geocoding-api.open-meteo.com', 'api.open-meteo.com']);
        assert(calls.every(([, opts]) => opts.credentials === 'omit' && opts.referrerPolicy === 'no-referrer'));
        globalThis.fetch = async () => new Response('{"results":[]}', { status: 200 });
        await assert.rejects(requestWeather(configuredProvider, 'No matching city fixture', new AbortController().signal, true), /City not found/);
        globalThis.fetch = async () => new Response('{}', { status: 429 });
        await assert.rejects(requestWeather(configuredProvider, 'Rate limit fixture', new AbortController().signal, true), /busy/);
    } finally { globalThis.fetch = original; }
});

