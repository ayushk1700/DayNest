import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, emptyAppearance } = require('../.test-build/state/model.js');
const { resolveAppearance, widgetAppearance, appearanceKeys, cardVariables, fontStacks, readableSurface, compositeColor, contrast } = require('../.test-build/ui/cardAppearance.js');
const { applyAction, ConflictError } = require('../.test-build/state/actions.js');
const { History, diff, reverse, applyPatches } = require('../.test-build/state/history.js');
const { decodeDashboard, validateDashboard } = require('../.test-build/state/validation.js');
const { parseBackup, exportBackup } = require('../.test-build/persistence/backup.js');
const { Repository } = require('../.test-build/persistence/repository.js');
const style = overrides => ({ ...emptyAppearance(), ...overrides });
const values = {
    borderColor: ['#112233', '#334455', '#556677'], backgroundColor: ['#ffffff', '#eeddcc', '#aabbcc'],
    borderWidth: ['thin', 'medium', 'thick'], corners: ['square', 'rounded', 'soft'], shadow: ['none', 'soft', 'lifted'],
    fontFamily: ['sans', 'serif', 'mono'], textSize: [12, 16, 20], headingWeight: ['regular', 'medium', 'bold'], lineSpacing: [1.1, 1.5, 2],
    surface: ['solid', 'glass', 'solid'], backgroundOpacity: [100, 90, 80], backgroundBlur: [0, 12, 24], padding: ['compact', 'comfortable', 'spacious'],
    titleVisibility: ['visible', 'hidden', 'visible'], titleAlignment: ['left', 'center', 'right'], controlsVisibility: ['always', 'hover', 'always'],
};

test('every appearance property resolves and clears through all four inheritance layers', () => {
    assert.deepEqual(Object.keys(values), [...appearanceKeys]);
    for (const [key, [globalValue, typeValue, localValue]] of Object.entries(values)) {
        const global = style({ [key]: globalValue }), type = style({ [key]: typeValue }), local = style({ [key]: localValue });
        let resolved = resolveAppearance(global, type, local);
        assert.equal(resolved.value[key], localValue); assert.equal(resolved.sources[key], 'Individual widget');
        resolved = resolveAppearance(global, type, emptyAppearance());
        assert.equal(resolved.value[key], typeValue); assert.equal(resolved.sources[key], 'Widget-type defaults');
        resolved = resolveAppearance(global, emptyAppearance(), emptyAppearance());
        assert.equal(resolved.value[key], globalValue); assert.equal(resolved.sources[key], 'Global defaults');
        assert.equal(resolveAppearance(emptyAppearance()).sources[key], 'Theme');
        assert.equal(global[key], globalValue, 'resolver mutated input');
    }
});

test('global updates reach inheriting widgets and type/individual changes affect only their scope', () => {
    let d = seedDashboard();
    d = applyAction(d, { type: 'appearance', expected: d.appearance, value: style({ textSize: 16, padding: 'compact' }) });
    d = applyAction(d, { type: 'appearance', widgetType: 'notes', expected: emptyAppearance(), value: style({ textSize: 20 }) });
    d = applyAction(d, { type: 'appearance', widgetId: 'notes-initial', expected: emptyAppearance(), value: style({ lineSpacing: 2 }) });
    assert.equal(widgetAppearance(d, d.widgets[0]).textSize, 16);
    assert.equal(widgetAppearance(d, d.widgets[1]).textSize, 20);
    assert.equal(widgetAppearance(d, d.widgets[1]).lineSpacing, 2);
    d = applyAction(d, { type: 'appearance', expected: d.appearance, value: style({ textSize: 18, padding: 'spacious' }) });
    assert.equal(widgetAppearance(d, d.widgets[0]).textSize, 18);
    assert.equal(widgetAppearance(d, d.widgets[1]).textSize, 20);
    assert.equal(widgetAppearance(d, d.widgets[1]).padding, 'spacious');
    assert.equal(d.widgets[1].appearance.textSize, undefined, 'inherited values were materialized');
    const cleared = applyAction(d, { type: 'appearance', widgetType: 'notes', expected: d.typeAppearance.notes, value: emptyAppearance() });
    assert.equal(cleared.typeAppearance, undefined);
    assert.equal(widgetAppearance(cleared, cleared.widgets[1]).textSize, 18);
});

test('a multi-property Save at any scope is one undoable action; drafts never mutate saved state', () => {
    for (const target of [{}, { widgetType: 'notes' }, { widgetId: 'notes-initial' }]) {
        const before = seedDashboard(), raw = JSON.stringify(before), draft = style({ fontFamily: 'serif', surface: 'glass', backgroundOpacity: 90, padding: 'spacious', titleVisibility: 'hidden' });
        resolveAppearance(draft);
        assert.equal(JSON.stringify(before), raw, 'preview changed the document');
        const action = { type: 'appearance', ...target, expected: emptyAppearance(), value: draft };
        const after = applyAction(before, action), history = new History();
        history.record({ before, after }, action);
        assert.equal(history.undo.length, 1);
        const patches = diff(before, after), undone = applyPatches(after, reverse(patches));
        assert.deepEqual({ ...undone, revision: before.revision }, before);
        const redone = applyPatches(undone, patches);
        assert.deepEqual({ ...redone, revision: after.revision }, after);
    }
});

test('old documents/backups keep content, layouts, media, skins and existing appearance exactly', () => {
    const old = seedDashboard(); old.widgets[1].settings = { ruled: false, skin: 'kraft' };
    old.widgets[1].appearance = style({ backgroundColor: '#ddcdaa', shadow: 'lifted' });
    const raw = JSON.stringify(old), restored = decodeDashboard(raw);
    assert.deepEqual(restored, old); assert.equal(restored.typeAppearance, undefined);
    assert.deepEqual(parseBackup(raw).dashboard, old);
    assert.deepEqual(cardVariables(widgetAppearance(restored, restored.widgets[0])), {});
    assert.equal(cardVariables(widgetAppearance(restored, restored.widgets[1]))['--card-background'], '#ddcdaa');
    for (const version of [2, 3]) {
        const legacy = seedDashboard(); legacy.schemaVersion = version; delete legacy.background;
        if (version === 2) { delete legacy.appearance; for (const widget of legacy.widgets) { delete widget.appearance; delete widget.pinned; } }
        const migrated = parseBackup(JSON.stringify(legacy)).dashboard;
        assert.equal(migrated.schemaVersion, 4);
        assert.deepEqual(migrated.widgets.map(w => w.content), old.widgets.map(w => w.content));
    }
});

test('extended appearance survives repository persistence and portable backups', async () => {
    let raw = JSON.stringify(seedDashboard());
    const adapter = { exclusive: async fn => fn(), read: async () => raw, write: async value => { raw = value; }, subscribe: () => () => {} };
    const repository = new Repository(adapter);
    const value = style(Object.fromEntries(Object.entries(values).map(([key, entries]) => [key, entries[1]])));
    let d = await repository.commit({ type: 'appearance', widgetType: 'sticky', expected: emptyAppearance(), value });
    assert.deepEqual((await repository.load()).typeAppearance.sticky, value);
    assert.deepEqual(parseBackup(JSON.stringify(await exportBackup(d))).dashboard, d);
    assert.equal(JSON.stringify(d).includes('https://fonts'), false);
});

test('validation rejects unsupported keys, injected fonts, invalid ranges and scopes', () => {
    const bad = [ { fontFamily: 'url(https://evil.test/font)' }, { textSize: 9 }, { textSize: Infinity }, { lineSpacing: 0 }, { lineSpacing: '1.5' }, { headingWeight: 700 }, { surface: ['glass'] }, { backgroundOpacity: 101 }, { backgroundBlur: -1 }, { padding: 'huge' }, { titleVisibility: false }, { titleAlignment: 'justify' }, { controlsVisibility: 'never' }, { unknown: true }, { toString: 'bad' } ];
    for (const overrides of bad) {
        for (const scope of ['global', 'type', 'widget']) {
            const d = seedDashboard();
            if (scope === 'type') d.typeAppearance = { sticky: style(overrides) };
            else if (scope === 'widget') d.widgets[0].appearance = style(overrides);
            else d.appearance = style(overrides);
            assert.throws(() => validateDashboard(d), `${scope}: ${JSON.stringify(overrides)}`);
        }
    }
    const d = seedDashboard(); d.typeAppearance = { unsupported: emptyAppearance() };
    assert.throws(() => validateDashboard(d));
    assert.throws(() => applyAction(seedDashboard(), { type: 'appearance', widgetType: 'unsupported', expected: emptyAppearance(), value: emptyAppearance() }), ConflictError);
});

test('stale same-scope edits reject and unrelated type-scope saves merge', () => {
    const before = seedDashboard(), value = style({ fontFamily: 'mono' });
    const first = applyAction(before, { type: 'appearance', widgetType: 'sticky', expected: emptyAppearance(), value });
    assert.throws(() => applyAction(first, { type: 'appearance', widgetType: 'sticky', expected: emptyAppearance(), value }), ConflictError);
    const merged = applyAction(first, { type: 'appearance', widgetType: 'notes', expected: emptyAppearance(), value: style({ textSize: 18 }) });
    assert.deepEqual(merged.typeAppearance.sticky, value);
});

test('fonts and surface styles use offline CSS, and glass text stays readable over black or white backdrops', () => {
    assert.equal(Object.keys(fontStacks).length, 5);
    for (const fontFamily of Object.keys(fontStacks)) assert.equal(cardVariables(style({ fontFamily }))['--card-font'].includes('url('), false);
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
        const background = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        const { opacity, text } = readableSurface(background, 0);
        for (const backdrop of ['#ffffff', '#000000']) assert.ok(contrast(compositeColor(background, backdrop, opacity / 100), text) >= 4.5);
        const css = cardVariables(style({ surface: 'glass', backgroundColor: background, backgroundOpacity: 0, backgroundBlur: 12 }));
        assert.equal(css['--card-safe-opacity'], `${opacity}%`); assert.equal(css['--card-blur'], '12px');
    }
});
