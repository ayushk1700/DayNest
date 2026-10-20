import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, noteSkin, NOTE_SKINS, CLOCK_STYLES } = require('../.test-build/state/model.js');
const { validateDashboard, decodeDashboard } = require('../.test-build/state/validation.js');
const { applyAction, ConflictError } = require('../.test-build/state/actions.js');
const { diff, reverse, applyPatches } = require('../.test-build/state/history.js');
const { parseBackup } = require('../.test-build/persistence/backup.js');
const { clockPresentation } = require('../.test-build/widgets/clockPresentation.js');
const create = kind => applyAction(seedDashboard(), { type: 'createWidget', kind, id: 'sample', view: { width: 1600, height: 900 } });
const last = d => d.widgets.at(-1);

test('clock faces use local time, 12/24-hour boundaries and accurate intermediate hand angles', () => {
    const midnight = new Date(2026, 9, 19, 0, 0, 0);
    assert.equal(clockPresentation(midnight, false).hours, '12');
    assert.equal(clockPresentation(midnight, false).period, 'AM');
    assert.equal(clockPresentation(midnight, true).hours, '00');
    const noon = clockPresentation(new Date(2026, 9, 19, 12, 30, 15), false);
    assert.equal(noon.period, 'PM'); assert.equal(noon.hourAngle, 15.125); assert.equal(noon.minuteAngle, 181.5); assert.equal(noon.secondAngle, 90);
    assert.equal(clockPresentation(new Date(2026, 9, 19, 23, 59, 59), true).hours, '23');
});

test('old clock and ruled notes settings remain valid without rewriting content', () => {
    const d = create('clock'); delete last(d).settings.style;
    assert.deepEqual(decodeDashboard(JSON.stringify(d)), d);
    assert.equal(noteSkin({ ruled: true }), 'lined'); assert.equal(noteSkin({ ruled: false }), 'plain');
    d.widgets.find(w => w.type === 'notes').settings.ruled = true;
    assert.deepEqual(validateDashboard(d), d);
});

test('all skins round-trip through history and portable backup without touching content or geometry', () => {
    for (const [kind, type, values] of [['clock', 'clockStyle', CLOCK_STYLES], ['notes', 'notesSkin', NOTE_SKINS]]) {
        let d = create(kind);
        for (const value of values) {
            const before = d, w = last(d), expected = kind === 'clock' ? w.settings.style ?? 'simple' : noteSkin(w.settings);
            d = applyAction(d, { type, widgetId: w.id, expected, value });
            assert.deepEqual(last(d).content, w.content); assert.deepEqual(last(d).position, w.position); assert.deepEqual(last(d).size, w.size);
            assert.deepEqual(decodeDashboard(JSON.stringify(d)), d);
            const patches = diff(before, d); assert.deepEqual(applyPatches(d, reverse(patches)).widgets, before.widgets);
            assert.deepEqual(applyPatches(before, patches).widgets, d.widgets);
            const backup = { format: 'purrductivity-backup', version: 1, exportedAt: new Date().toISOString(), dashboard: d, images: [] };
            assert.deepEqual(parseBackup(JSON.stringify(backup)).dashboard, d);
        }
    }
});

test('skin edits reject stale values while preserving unrelated concurrent edits', () => {
    let d = create('clock'); d = applyAction(d, { type: 'clockFormat', widgetId: 'sample', expected: false, value: true });
    d = applyAction(d, { type: 'clockStyle', widgetId: 'sample', expected: 'digital', value: 'analog' });
    assert.equal(last(d).settings.hour24, true);
    assert.throws(() => applyAction(d, { type: 'clockStyle', widgetId: 'sample', expected: 'digital', value: 'simple' }), ConflictError);
    let n = create('notes'); n = applyAction(n, { type: 'text', widgetId: 'sample', expected: '', value: 'Keep this draft\nand this line.' });
    n = applyAction(n, { type: 'notesSkin', widgetId: 'sample', expected: 'plain', value: 'lined' });
    assert.equal(last(n).content.text, 'Keep this draft\nand this line.'); assert.equal(last(n).settings.ruled, true);
    assert.throws(() => applyAction(n, { type: 'notesSkin', widgetId: 'sample', expected: 'plain', value: 'kraft' }), ConflictError);
});

test('skin validation rejects unknown or contradictory settings and wrong widget actions', () => {
    for (const [kind, settings] of [['clock', { hour24: false, style: 'remote' }], ['clock', { hour24: false, style: null }], ['notes', { ruled: true, skin: 'plain' }], ['notes', { ruled: false, skin: 'linen' }], ['notes', { ruled: false, skin: 'grid', url: 'remote' }]]) {
        const d = create(kind); last(d).settings = settings; assert.throws(() => validateDashboard(d));
    }
    assert.throws(() => applyAction(create('notes'), { type: 'clockStyle', widgetId: 'sample', expected: 'simple', value: 'analog' }), ConflictError);
});

test('calendar week preference preserves events and participates in conditional history', () => {
    let d = create('calendar'); const event = { id: 'event', date: '2026-12-25', title: 'A day to remember' };
    d = applyAction(d, { type: 'calendarUpsert', widgetId: 'sample', expected: null, value: event });
    const next = applyAction(d, { type: 'calendarWeekStart', widgetId: 'sample', expected: 0, value: 1 });
    assert.deepEqual(last(next).content.events, [event]);
    assert.deepEqual(applyPatches(next, reverse(diff(d, next))).widgets, d.widgets);
    assert.equal(last(decodeDashboard(JSON.stringify(next))).settings.weekStartsOn, 1);
    assert.throws(() => applyAction(next, { type: 'calendarWeekStart', widgetId: 'sample', expected: 0, value: 1 }), ConflictError);
    assert.throws(() => applyAction(next, { type: 'calendarWeekStart', widgetId: 'sample', expected: 1, value: 2 }));
});
