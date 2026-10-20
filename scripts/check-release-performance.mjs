import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { harness, assert, wait } from './browser-harness.mjs';
const require = createRequire(import.meta.url);
const { seedDashboard, cardDefaults } = require('../.test-build/state/model.js');
const { validateDashboard } = require('../.test-build/state/validation.js');
const h = await harness(), page = await h.context.newPage(), results = { scope: 'Headless Edge, local HTTP preview; diagnostic figures, not physical-device or NVDA certification', loads: [] };
try {
 await page.goto(h.url); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
 const clean = seedDashboard(), stress = seedDashboard(), note = clean.widgets.find(w => w.type === 'notes');
 stress.widgets = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(note), id: `stress-${i}`, title: `Notes ${i + 1}`, zIndex: i, position: { x: (i % 3) * 500, y: Math.floor(i / 3) * 400 + 100 }, content: { text: `Stress fixture ${i}\n` + 'A quiet place for a busy day. '.repeat(480) } }));
 validateDashboard(stress); results.documentBytes = Buffer.byteLength(JSON.stringify(stress)); results.widgets = stress.widgets.length;
 await page.evaluate(doc => localStorage.setItem('purrductivity.dashboard', JSON.stringify(doc)), stress);
 for (let i = 0; i < 3; i++) {
  const start = performance.now(); await page.reload(); await page.locator('[data-widget-id="stress-0"] textarea').waitFor();
  assert(await page.locator('[data-widget-id]').count() === 100, 'Stress dashboard lost widgets');
  results.loads.push(Math.round(performance.now() - start));
 }
 const text = page.locator('[data-widget-id="stress-0"] textarea'), start = performance.now();
 await text.fill('Stress edit persisted');
 await wait(() => page.evaluate(() => JSON.parse(localStorage.getItem('purrductivity.dashboard')).widgets[0].content.text === 'Stress edit persisted'), 'Stress edit not saved');
 results.editAndSaveMs = Math.round(performance.now() - start);
 results.jsHeapUsedBytes = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
 assert(results.loads.every(ms => ms < 10000), 'Stress dashboard exceeded 10-second diagnostic ceiling');
 await page.evaluate(doc => localStorage.setItem('purrductivity.dashboard', JSON.stringify(doc)), clean); await page.reload();
 await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
 await page.getByRole('button', { name: 'Open Settings', exact: true }).focus(); await page.keyboard.press('Enter');
 const dialog = page.getByRole('dialog', { name: 'Settings', exact: true }); await dialog.waitFor();
 for (let i = 0; i < 90; i++) { await page.keyboard.press('Tab'); assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Keyboard focus escaped Settings'); }
 await page.screenshot({ path: 'docs/screenshots/release-forced-colors.png' });
 await page.keyboard.press('Escape'); assert(await page.getByRole('button', { name: 'Open Settings', exact: true }).evaluate(el => el === document.activeElement), 'Focus did not return');
 await page.setViewportSize({ width: 640, height: 480 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Small-screen overflow');
 results.accessibility = { forcedColors: true, reducedMotion: true, keyboardModalCycle: 90, focusReturned: true, smallViewport: '640x480', nvda: 'Not executed', physicalTouch: 'Not executed' };
 await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' }); await page.setViewportSize({ width: 1920, height: 925 });
 await page.getByRole('button', { name: 'Add Widget', exact: true }).click(); await page.getByRole('dialog', { name: 'Add Widget', exact: true }).getByRole('button', { name: 'Image', exact: true }).click();
 const base64 = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1100; const c = canvas.getContext('2d'); const pixels = c.createImageData(1100, 1100); for (let i = 0; i < pixels.data.length; i += 65536) crypto.getRandomValues(pixels.data.subarray(i, i + 65536)); c.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png').split(',')[1]; });
 const buffer = Buffer.from(base64, 'base64'); assert(buffer.length < 5 * 1024 * 1024 && buffer.length > 4 * 1024 * 1024, 'Expected a near-limit image fixture');
 const image = page.locator('[data-widget-type="image"]');
 const imageFrame = page.locator('[data-widget-id]').filter({ has: page.locator('input[type="file"][accept*="image"]') }).last();
 const uploadStart = performance.now(); await imageFrame.locator('input[type=file]').setInputFiles({ name: 'release-large-image.png', mimeType: 'image/png', buffer });
 await wait(() => imageFrame.getByRole('img').evaluateAll(images => images.some(img => img.complete && img.naturalWidth === 1100)), 'Near-limit image did not render');
 results.image = { bytes: buffer.length, uploadAndRenderMs: Math.round(performance.now() - uploadStart) };
 await page.reload(); await wait(() => page.locator('img').evaluateAll(images => images.some(img => img.complete && img.naturalWidth === 1100)), 'Near-limit image did not survive reload');
 assert(!h.errors.length, h.errors.join('\n')); results.errors = h.errors;
 await mkdir('results', { recursive: true }); await writeFile('results/performance-accessibility.json', JSON.stringify(results, null, 2));
 console.log(JSON.stringify(results, null, 2));
} finally { await h.close(); }
