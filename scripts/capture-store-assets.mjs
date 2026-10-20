import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { harness, assert } from './browser-harness.mjs';
const require = createRequire(import.meta.url);
const { seedDashboard } = require('../.test-build/state/model.js');
const { applyAction } = require('../.test-build/state/actions.js');
const h = await harness(), page = await h.context.newPage();
try {
 await page.setViewportSize({ width: 1280, height: 800 }); await page.goto(h.url); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
 let doc = seedDashboard();
 doc = applyAction(doc, { type: 'createWidget', kind: 'clock', id: 'demo-clock', view: { width: 1280, height: 800, top: 84 } });
 const positions = {
  todo: { position: { x: 38, y: 110 }, size: { width: 340, height: 510 }, title: 'A little progress' },
  notes: { position: { x: 410, y: 110 }, size: { width: 440, height: 345 }, title: 'Room for good ideas' },
  pomodoro: { position: { x: 880, y: 110 }, size: { width: 340, height: 260 }, title: 'One thing at a time' },
  sticky: { position: { x: 900, y: 430 }, size: { width: 300, height: 245 }, title: 'A gentle reminder' },
  clock: { position: { x: 410, y: 500 }, size: { width: 440, height: 180 }, title: 'Make time for you' },
 };
 for (const w of doc.widgets) Object.assign(w, positions[w.type]);
 doc.widgets.find(w => w.type === 'todo').content.tasks = [{ id: 'demo-1', text: 'Make a little space for the day', completed: true }, { id: 'demo-2', text: 'Focus on the next small thing', completed: false }, { id: 'demo-3', text: 'Take a walk, without your phone', completed: false }];
 const notes = doc.widgets.find(w => w.type === 'notes'); notes.content.text = 'Today, at my own pace.\n\nA place for the idea you do not want to lose,\nthe list you keep in your head,\nand a little room to begin again.\n\nLess rushing. More doing.'; notes.settings = { ruled: false, skin: 'plain' };
 doc.widgets.find(w => w.type === 'sticky').content.text = 'Small steps count.\n\nSo do the pauses in between.';
 await mkdir('store-assets', { recursive: true });
 for (const [theme, name] of [['Warm Earth', '01-your-day'], ['Midnight', '02-after-hours'], ['Matcha', '03-make-it-yours']]) {
  doc.theme = theme; await page.evaluate(d => localStorage.setItem('purrductivity.dashboard', JSON.stringify(d)), doc); await page.reload(); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor(); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `store-assets/${name}.png` });
 }
 assert(!h.errors.length, h.errors.join('\n'));
 console.log('Captured three actual-product screenshots at 1280x800. All content is illustrative demo data in an isolated profile.');
} finally { await h.close(); }
