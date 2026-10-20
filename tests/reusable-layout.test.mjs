import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, emptyAppearance, defaultPresentation, defaultLayoutAssistance } = require('../.test-build/state/model.js');
const { applyAction, ConflictError } = require('../.test-build/state/actions.js');
const { validateDashboard, decodeDashboard } = require('../.test-build/state/validation.js');
const { diff, reverse, applyPatches, History } = require('../.test-build/state/history.js');
const { parseBackup } = require('../.test-build/persistence/backup.js');
const { gestureLayout, snapLayout, alignedLayouts, movementGuides, displayedSize } = require('../.test-build/dashboard/layout.js');
const style = values => ({ ...emptyAppearance(), ...values });
const targets = d => d.widgets.map(w => ({ id: w.id, expected: { position: w.position, size: w.size } }));
const untouched = d => d.widgets.map(({ appearance, presentation, ...w }) => w);

test('preset CRUD is portable and undoable; applied appearances are independent snapshots', () => {
    const original = seedDashboard(), preset = { id: 'my-preset', name: 'Quiet', appearance: style({ fontFamily: 'serif', padding: 'compact' }) };
    let d = applyAction(original, { type: 'presets', expected: [], value: [preset] });
    d = applyAction(d, { type: 'appearance', expected: d.appearance, value: preset.appearance });
    d = applyAction(d, { type: 'appearance', widgetType: 'notes', expected: emptyAppearance(), value: preset.appearance });
    d = applyAction(d, { type: 'appearanceBatch', targets: d.widgets.slice(0, 2).map(w => ({ id: w.id, expected: w.appearance })), patch: preset.appearance });
    const applied = structuredClone(d);
    d = applyAction(d, { type: 'presets', expected: d.presets, value: [{ ...preset, name: 'Renamed', appearance: style({ fontFamily: 'mono' }) }] });
    assert.deepEqual(d.appearance, applied.appearance); assert.deepEqual(d.typeAppearance, applied.typeAppearance); assert.deepEqual(d.widgets, applied.widgets);
    const beforeDelete = d;
    d = applyAction(d, { type: 'presets', expected: d.presets, value: [] });
    assert.equal(d.presets, undefined); assert.deepEqual(untouched(d), untouched(original));
    const undone = applyPatches(d, reverse(diff(beforeDelete, d)));
    assert.deepEqual(undone.presets, beforeDelete.presets);
    assert.deepEqual(parseBackup(JSON.stringify(undone)).dashboard, undone);
});

test('batch edits change only touched properties, merge unrelated edits, and undo as one action', () => {
    let before = seedDashboard(); before.widgets[0].appearance = style({ textSize: 12, fontFamily: 'mono' }); before.widgets[1].appearance = style({ textSize: 20, padding: 'spacious' });
    const captured = before.widgets.slice(0, 2).map(w => ({ id: w.id, expected: structuredClone(w.appearance) }));
    before = applyAction(before, { type: 'appearance', widgetId: before.widgets[1].id, expected: before.widgets[1].appearance, value: { ...before.widgets[1].appearance, shadow: 'lifted' } });
    const action = { type: 'appearanceBatch', targets: captured, patch: { corners: 'soft' } };
    const after = applyAction(before, action);
    assert.equal(after.widgets[0].appearance.textSize, 12); assert.equal(after.widgets[1].appearance.textSize, 20);
    assert.equal(after.widgets[1].appearance.shadow, 'lifted'); assert.equal(after.widgets[1].appearance.corners, 'soft');
    assert.deepEqual(untouched(after), untouched(before));
    const history = new History(); history.record({ before, after }, action); assert.equal(history.undo.length, 1);
    const undone = applyPatches(after, reverse(history.undo[0].patches)); assert.deepEqual(undone.widgets, before.widgets);
    assert.throws(() => applyAction(after, { type: 'appearanceBatch', targets: captured, patch: { corners: 'rounded' } }), ConflictError);
});

test('pasting a complete supported appearance snapshot changes no content, functional settings or geometry', () => {
    const before = seedDashboard(), snapshot = style({ fontFamily: 'sans', textSize: 16, headingWeight: 'bold', surface: 'glass', backgroundColor: '#ffffff', backgroundOpacity: 90, backgroundBlur: 8, padding: 'comfortable', lineSpacing: 1.5, titleVisibility: 'hidden', titleAlignment: 'center', controlsVisibility: 'always' });
    const after = applyAction(before, { type: 'appearanceBatch', targets: [{ id: before.widgets[2].id, expected: before.widgets[2].appearance }], patch: snapshot });
    assert.deepEqual(untouched(before), untouched(after)); assert.deepEqual(after.widgets[2].appearance, snapshot);
    snapshot.fontFamily = 'mono'; assert.equal(after.widgets[2].appearance.fontFamily, 'sans');
});

test('all alignments operate in canvas coordinates and preserve size/content', () => {
    const before = seedDashboard();
    for (const operation of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
        const after = applyAction(before, { type: 'align', targets: targets(before), operation });
        const horizontal = ['left', 'center', 'right'].includes(operation), axis = horizontal ? 'x' : 'y', dimension = horizontal ? 'width' : 'height';
        const factors = { left: 0, top: 0, center: .5, middle: .5, right: 1, bottom: 1 };
        const anchors = after.widgets.map(w => w.position[axis] + w.size[dimension] * factors[operation]);
        assert.ok(anchors.every(n => Math.abs(n - anchors[0]) < .001), operation);
        assert.deepEqual(after.widgets.map(w => [w.content, w.settings, w.size]), before.widgets.map(w => [w.content, w.settings, w.size]));
        assert.deepEqual(applyPatches(after, reverse(diff(before, after))).widgets, before.widgets);
    }
});

test('distribution creates equal gaps and leaves endpoint positions unchanged', () => {
    for (const operation of ['horizontal', 'vertical']) {
        const before = seedDashboard(), axis = operation === 'horizontal' ? 'x' : 'y', dimension = axis === 'x' ? 'width' : 'height';
        before.widgets.forEach((w, i) => { w.position[axis] = 100 + i * 900; });
        const after = applyAction(before, { type: 'align', targets: targets(before), operation });
        const gaps = after.widgets.slice(1).map((w, i) => w.position[axis] - after.widgets[i].position[axis] - after.widgets[i].size[dimension]);
        assert.ok(gaps.every(n => Math.abs(n - gaps[0]) < .001));
        assert.equal(after.widgets[0].position[axis], before.widgets[0].position[axis]); assert.equal(after.widgets.at(-1).position[axis], before.widgets.at(-1).position[axis]);
    }
});

test('pinned and stale selections fail atomically; small selections explain unavailable operations', () => {
    const d = seedDashboard(), raw = JSON.stringify(d); d.widgets[1].pinned = true;
    assert.throws(() => applyAction(d, { type: 'align', targets: targets(d), operation: 'left' }), /Unpin/);
    assert.throws(() => applyAction(d, { type: 'nudge', widgetId: d.widgets[1].id, dx: 16, dy: 0, resize: false }), ConflictError);
    d.widgets[1].pinned = false;
    assert.throws(() => applyAction(d, { type: 'align', targets: targets(d).slice(0, 1), operation: 'left' }), /two/);
    assert.throws(() => applyAction(d, { type: 'align', targets: targets(d).slice(0, 2), operation: 'horizontal' }), /three/);
    const stale = structuredClone(targets(d)); d.widgets[1].position.x++;
    assert.throws(() => applyAction(d, { type: 'align', targets: stale, operation: 'left' }), ConflictError);
    d.widgets[1].position.x--; assert.equal(JSON.stringify(d), raw);
});

test('grid snapping and guides respect 50%, 100% and 150% canvas zoom', () => {
    const start = { position: { x: 32, y: 64 }, size: { width: 320, height: 300 } };
    for (const zoom of [.5, 1, 1.5]) {
        const moved = gestureLayout(start, 'move', 47 * zoom, 31 * zoom, zoom, 'notes');
        assert.deepEqual(snapLayout(moved, 'move', 16, 'notes').position, { x: 80, y: 96 });
        const other = { ...seedDashboard().widgets[1], position: { x: 80, y: 96 }, size: start.size };
        assert.deepEqual(movementGuides({ ...moved, position: { x: 80, y: 96 } }, [other], zoom, { snap: true, gridSize: 16, guides: true }), { x: 400, y: 396 });
        assert.deepEqual(movementGuides(moved, [other], zoom, { snap: true, gridSize: 16, guides: false }), {});
    }
    let d = seedDashboard(); d = applyAction(d, { type: 'layoutAssistance', expected: defaultLayoutAssistance(), value: { snap: true, gridSize: 64, guides: true } });
    const nudged = applyAction(d, { type: 'nudge', widgetId: d.widgets[0].id, dx: 16, dy: 0, resize: false });
    assert.ok(nudged.widgets[0].position.x > d.widgets[0].position.x); assert.equal(nudged.widgets[0].position.x % 64, 0);
});

test('presentation modes and collapse round-trip without losing expanded dimensions', () => {
    const original = seedDashboard();
    for (const mode of ['full', 'compact', 'content-only']) {
        const action = { type: 'presentation', widgetId: original.widgets[1].id, expected: defaultPresentation(), value: { mode, collapsed: true } };
        const collapsed = applyAction(original, action), w = collapsed.widgets[1];
        assert.equal(displayedSize(w).height, 54); assert.deepEqual(w.size, original.widgets[1].size);
        const expanded = applyAction(collapsed, { ...action, expected: w.presentation, value: { mode, collapsed: false } });
        assert.deepEqual(displayedSize(expanded.widgets[1]), original.widgets[1].size);
        assert.deepEqual(untouched(expanded), untouched(original));
        assert.deepEqual(applyPatches(collapsed, reverse(diff(original, collapsed))).widgets, original.widgets);
        assert.deepEqual(decodeDashboard(JSON.stringify(collapsed)), collapsed);
    }
});

test('presets, presentation, layout preferences validate strictly; old backups remain unchanged', () => {
    const old = seedDashboard(); assert.deepEqual(parseBackup(JSON.stringify(old)).dashboard, old);
    for (const mutate of [d => d.presets = [{ id: 'x', name: 'x', appearance: emptyAppearance(), content: 'bad' }], d => d.presets = [{ id: 'x', name: 'same', appearance: emptyAppearance() }, { id: 'y', name: ' SAME ', appearance: emptyAppearance() }], d => d.layoutAssistance = { snap: true, gridSize: 0, guides: true }, d => d.layoutAssistance = { snap: 'yes', gridSize: 16, guides: true }, d => d.widgets[0].presentation = { mode: 'unknown', collapsed: false }, d => d.widgets[0].presentation = { mode: 'full', collapsed: 'yes' }]) {
        const d = seedDashboard(); mutate(d); assert.throws(() => validateDashboard(d));
    }
});
