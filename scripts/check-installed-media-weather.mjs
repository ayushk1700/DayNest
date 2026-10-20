import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require('playwright');
const directory = await mkdtemp(join(tmpdir(), 'purrductivity-media-edge-'));
const dist = resolve('dist');
const launch = () => chromium.launchPersistentContext(directory, { headless: true, executablePath: process.env.EDGE_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`], viewport: { width: 1920, height: 925 } });
let context = await launch(), worker;
const assert = (ok, message) => { if (!ok) throw Error(message); };
async function wait(fn, message) { for (let i = 0; i < 300; i++) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(message); }
let page;
const read = () => worker.evaluate(async () => JSON.parse((await chrome.storage.local.get('purrductivity.dashboard'))['purrductivity.dashboard']));
const frame = id => page.locator(`[data-widget-id="${id}"]`);
async function add(name, type) {
    await page.getByRole('button', { name: 'Add Widget', exact: true }).click(); await page.getByRole('dialog', { name: 'Add Widget', exact: true }).getByRole('button', { name, exact: true }).click();
    await wait(async () => (await read()).widgets.some(w => w.type === type), 'Installed widget not saved');
    return (await read()).widgets.findLast(w => w.type === type).id;
}
try {
    worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
    const id = new URL(worker.url()).host;
    page = await context.newPage(); await page.goto(`chrome-extension://${id}/index.html`);
    await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
    assert(await worker.evaluate(() => chrome.permissions.contains({ origins: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'] })), 'Exact weather host grants missing');
    const weatherId = await add('Weather', 'weather');
    await frame(weatherId).getByRole('textbox', { name: 'Weather city', exact: true }).fill('Pune, India');
    await wait(async () => (await frame(weatherId).locator('.weather-symbol').count()) === 7, 'Real installed-extension weather/forecast failed: ' + await frame(weatherId).textContent());
    const reading = await frame(weatherId).locator('.weather-temperature>span').textContent();
    assert(Number.isFinite(Number(reading)) && reading !== '—', 'Installed weather did not show genuine temperature');
    await frame(weatherId).screenshot({ path: 'docs/screenshots/live-weather-installed.png' });
    console.log('Installed Edge fetched genuine Open-Meteo current conditions and seven forecast days:', reading, 'C');
    const videoId = await add('Video', 'video');
    await frame(videoId).locator('input[type=file]').setInputFiles(resolve('.test-build/browser-fixture.webm'));
    await wait(async () => !!(await read()).widgets.find(w => w.id === videoId).content.assetId, 'Installed video upload failed');
    const videoAsset = (await read()).widgets.find(w => w.id === videoId).content.assetId;
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await page.getByLabel('Dashboard background file', { exact: true }).setInputFiles(resolve('public/icons/icon-128.png'));
    await page.getByText('Unsaved background changes', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save background', exact: true }).click();
    await wait(async () => !!(await read()).background.assetId, 'Installed background upload failed');
    const backgroundAsset = (await read()).background.assetId;
    await context.close(); context = await launch();
    worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
    await context.setOffline(true); page = await context.newPage(); await page.goto(`chrome-extension://${id}/index.html`);
    await frame(videoId).locator('video').waitFor();
    await frame(videoId).locator('video').evaluate(async video => { video.muted = true; await video.play(); });
    await wait(() => frame(videoId).locator('video').evaluate(video => video.currentTime > .1 && video.videoWidth > 0), 'Installed offline video did not play');
    await frame(videoId).locator('video').evaluate(video => video.pause());
    await page.locator('.dashboard-backdrop').waitFor();
    const doc = await read(); assert(doc.background.assetId === backgroundAsset && doc.widgets.find(w => w.id === videoId).content.assetId === videoAsset, 'Restart changed local media references');
    console.log('Passed installed extension host/CSP/live weather and offline profile-restart video/background persistence.');
} finally { await context.close(); }
