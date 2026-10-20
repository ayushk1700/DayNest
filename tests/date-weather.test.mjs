import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ordinalSuffix, dateBannerParts } = require('../.test-build/widgets/dates.js');
const { seedDashboard } = require('../.test-build/state/model.js');
const { validateDashboard, decodeDashboard, migrateDashboard } = require('../.test-build/state/validation.js');
const { applyAction, ConflictError } = require('../.test-build/state/actions.js');
const { History, reverse, applyPatches } = require('../.test-build/state/history.js');
const { parseBackup } = require('../.test-build/persistence/backup.js');

test('date suffixes handle every day, teen exceptions and invalid input', () => {
    for (let day = 1; day <= 31; day++) {
        const expected = [1, 21, 31].includes(day) ? 'st' : [2, 22].includes(day) ? 'nd' : [3, 23].includes(day) ? 'rd' : 'th';
        assert.equal(ordinalSuffix(day), expected);
    }
    for (const day of [0, 32, 1.5, NaN]) assert.throws(() => ordinalSuffix(day));
});

test('date banner follows local midnight, month/year rollover and leap days', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Asia/Kolkata';
    try {
        assert.deepEqual(dateBannerParts(Date.parse('2026-10-20T18:29:59Z')), { day: 20, suffix: 'th', month: 'October', key: '2026-10-20' });
        assert.equal(dateBannerParts(Date.parse('2026-10-20T18:30:00Z')).day, 21);
        assert.deepEqual(dateBannerParts(Date.parse('2026-12-31T18:30:00Z')), { day: 1, suffix: 'st', month: 'January', key: '2027-01-01' });
        assert.equal(dateBannerParts(Date.parse('2024-02-28T18:30:00Z')).key, '2024-02-29');
    } finally {
        if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
});

test('date widgets persist and round-trip through history/backup with strict empty data', () => {
    const before = seedDashboard();
    const action = { type: 'createWidget', kind: 'date', id: 'date-one', view: { width: 1600, height: 900 } };
    const after = applyAction(before, action);
    assert.equal(after.widgets.at(-1).type, 'date');
    assert.deepEqual(decodeDashboard(JSON.stringify(after)), after);
    const history = new History(); history.record({ before, after }, action);
    const undone = applyPatches(after, reverse(history.undo[0].patches));
    assert.equal(undone.widgets.some(w => w.type === 'date'), false);
    assert.equal(applyPatches(undone, history.undo[0].patches).widgets.at(-1).type, 'date');
    const backup = { format: 'purrductivity-backup', version: 1, exportedAt: new Date().toISOString(), dashboard: after, images: [] };
    assert.deepEqual(parseBackup(JSON.stringify(backup)).dashboard, after);
    for (const field of ['settings', 'content']) {
        const invalid = structuredClone(after); invalid.widgets.at(-1)[field] = { arbitrary: true };
        assert.throws(() => validateDashboard(invalid));
    }
    const old = structuredClone(after); old.schemaVersion = 2; delete old.appearance; delete old.background;
    old.widgets.forEach(w => { delete w.appearance; delete w.pinned; });
    assert.throws(() => migrateDashboard(old), 'Older formats must not silently accept a current-only widget');
});

test('weather units persist independently, reject stale or invalid edits and participate in history', () => {
    let before = applyAction(seedDashboard(), { type: 'createWidget', kind: 'weather', id: 'weather-one', view: { width: 1600, height: 900 } });
    const action = { type: 'weatherUnits', widgetId: 'weather-one', expected: 'celsius', value: 'fahrenheit' };
    const after = applyAction(before, action);
    const history = new History(); history.record({ before, after }, action);
    assert.equal(decodeDashboard(JSON.stringify(after)).widgets.at(-1).settings.units, 'fahrenheit');
    assert.equal(applyPatches(after, reverse(history.undo[0].patches)).widgets.at(-1).settings.units, 'celsius');
    assert.throws(() => applyAction(after, action), ConflictError);
    assert.throws(() => applyAction(before, { ...action, value: 'kelvin' }));
    assert.equal(before.widgets.at(-1).settings.units, 'celsius');
    const city = applyAction(after, { type: 'weatherCity', widgetId: 'weather-one', expected: '', value: 'Pune' });
    assert.equal(city.widgets.at(-1).settings.units, 'fahrenheit');
    assert.equal(city.widgets.at(-1).content.city, 'Pune');
});
