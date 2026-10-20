import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require('playwright');
const directory = await mkdtemp(join(tmpdir(), 'daynest-release-'));
const errors = [], observations = [];
const wait = async (fn, message) => { for (let n = 0; n < 150; n++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error(message); };
const check = (ok, message) => { if (!ok) throw Error(message); };
async function launch() {
 const context = await chromium.launchPersistentContext(directory, { headless: true, executablePath: process.env.EDGE_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${resolve('dist')}`, `--load-extension=${resolve('dist')}`], viewport: { width: 1280, height: 800 } });
 context.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
 context.on('weberror', error => errors.push(error.error().message));
 const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
 return { context, worker, id: new URL(worker.url()).host };
}
let active = await launch();
async function read() { return active.worker.evaluate(async () => JSON.parse((await chrome.storage.local.get('purrductivity.dashboard'))['purrductivity.dashboard'])); }
async function set(doc) { await active.worker.evaluate(async doc => { await navigator.locks.request('purrductivity-document', () => chrome.storage.local.set({ 'purrductivity.dashboard': JSON.stringify(doc) })); }, doc); }
try {
 for (let restart = 0; restart < 2; restart++) {
  const page = await active.context.newPage(); await page.goto('edge://newtab');
  await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
  check(await page.title() === 'DayNest', 'Tab title differs');
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  check(icon.startsWith('data:image/png;base64,'), 'Favicon not embedded');
  check(await page.evaluate(async () => { const image = new Image(); image.src = document.querySelector('link[rel="icon"]').href; await image.decode(); return image.naturalWidth === 32 && image.naturalHeight === 32; }), 'Tab icon image cannot decode');
  // Query the browser's own tab metadata, not only the page DOM.
  await wait(async () => active.worker.evaluate(async () => (await chrome.tabs.query({})).some(tab => tab.title === 'DayNest' && tab.favIconUrl?.startsWith('data:image/png;base64,'))), 'Edge tab metadata does not expose the sunflower favicon');
  observations.push({ restart, title: await page.title(), faviconDecoded: true, browserTabFavicon: true });
  if (!restart) {
   const notes = page.getByRole('textbox', { name: 'Notes text', exact: true }); await notes.fill('DayNest release restart verification');
   await wait(async () => (await read()).widgets.some(w => w.type === 'notes' && w.content.text === 'DayNest release restart verification'), 'Notes did not persist');
   const valid = await read(), invalid = structuredClone(valid); invalid.background.dim = 'invalid'; await set(invalid);
   await page.getByRole('alert').filter({ hasText: 'dashboard could not be loaded' }).waitFor();
   await wait(async () => active.worker.evaluate(async () => !(await chrome.alarms.getAll()).some(a => a.name === 'purrductivity-next')), 'Invalid data left alarms active');
   check(JSON.stringify(await read()) === JSON.stringify(invalid), 'Invalid data was overwritten');
   await set(valid); await page.getByRole('button', { name: 'Retry storage', exact: true }).click(); await notes.waitFor();
   await active.context.close(); active = await launch();
  } else {
   check((await read()).widgets.some(w => w.type === 'notes' && w.content.text === 'DayNest release restart verification'), 'Restart lost notes');
   await page.screenshot({ path: 'docs/screenshots/release-installed-dashboard.png' });
  }
 }
 check(errors.length === 0, `Browser errors: ${errors.join('\n')}`);
 await mkdir('results', { recursive: true }); await writeFile('results/installed-release.json', JSON.stringify({ browser: await active.context.browser()?.version(), observations, errors, scope: 'Isolated Edge profile; physical user tab bar not observed' }, null, 2));
 console.log('PASS: Edge tab metadata exposes the decoded sunflower, title and saved notes survive restart, invalid data remains intact, alarms pause, recovery resumes, no browser console errors.');
} finally { await active.context.close(); }
