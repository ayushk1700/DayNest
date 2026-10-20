import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, isAmbientNote } = require('../.test-build/state/model.js');
const { applyAction } = require('../.test-build/state/actions.js');
const { decodeDashboard, validateDashboard } = require('../.test-build/state/validation.js');
const { diff, reverse, applyPatches } = require('../.test-build/state/history.js');
const view = { width: 1200, height: 900 };
const create = d => applyAction(d, { type: 'createWidget', kind: 'sticky', workspace: 'ambient', id: 'ambient-note', view });

test('Ambient notes persist separately and edits, pins and deletion leave workspace notes unchanged', () => {
    const original = seedDashboard();
    const workspaceNote = original.widgets.find(w => w.type === 'sticky');
    let d = decodeDashboard(JSON.stringify(create(original)));
    assert.equal(d.widgets.filter(isAmbientNote).length, 1);
    const note = d.widgets.find(isAmbientNote);
    d = applyAction(d, { type: 'text', widgetId: note.id, expected: note.content.text, value: 'Focus only' });
    d = applyAction(d, { type: 'pin', widgetId: note.id, expected: false, value: true });
    assert.deepEqual(d.widgets.find(w => w.id === workspaceNote.id), workspaceNote);
    const beforeDelete = d;
    d = applyAction(d, { type: 'deleteWidget', widgetId: note.id, expected: d.widgets.find(isAmbientNote) });
    assert.equal(d.widgets.some(isAmbientNote), false);
    d = applyPatches(d, reverse(diff(beforeDelete, d)));
    assert.equal(d.widgets.find(isAmbientNote).content.text, 'Focus only');
    assert.equal(d.widgets.find(isAmbientNote).pinned, true);
});

test('Workspace arrangement and recovery preserve Ambient positions', () => {
    let d = create(seedDashboard());
    const note = d.widgets.find(isAmbientNote);
    d = applyAction(d, { type: 'layout', widgetId: note.id, expected: { position: note.position, size: note.size }, value: { position: { x: 500, y: 600 }, size: note.size } });
    const saved = structuredClone(d.widgets.find(isAmbientNote));
    d = applyAction(d, { type: 'arrange', expected: d.widgets.map(w => ({ id: w.id, layout: { position: w.position, size: w.size } })), view });
    d = applyAction(d, { type: 'recoverLayout', view });
    assert.deepEqual(d.widgets.find(isAmbientNote), saved);
});

test('Note workspace validation rejects unsupported scopes', () => {
    const d = create(seedDashboard());
    d.widgets.find(isAmbientNote).settings.workspace = 'unknown';
    assert.throws(() => validateDashboard(d));
    assert.throws(() => applyAction(seedDashboard(), { type: 'createWidget', kind: 'clock', workspace: 'ambient', id: 'bad', view }));
});
