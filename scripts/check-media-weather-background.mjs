import { readFile } from 'node:fs/promises';
import { harness, assert, wait, documentOf } from './browser-harness.mjs';
import { mockWeather } from './weather-fixture.mjs';
const h = await harness();
const weatherService = await mockWeather(h.context);
const page = await h.context.newPage();
page.setDefaultTimeout(15000);
const button = name => page.getByRole('button', { name, exact: true });
const frame = id => page.locator(`[data-widget-id="${id}"]`);
const saved = fn => wait(async () => fn(await documentOf(page)), 'Expected persisted media/background/weather state');
async function add(name, type) {
    await button('Add Widget').click(); await page.getByRole('dialog', { name: 'Add Widget', exact: true }).getByRole('button', { name, exact: true }).click();
    await saved(d => d.widgets.some(w => w.type === type));
    return (await documentOf(page)).widgets.findLast(w => w.type === type).id;
}
async function menu(id) { const trigger = frame(id).locator('.more-actions'); await trigger.focus(); await trigger.press('ArrowDown'); }
async function openSettings() { if (!await page.getByRole('dialog', { name: 'Settings', exact: true }).count()) await button('Open Settings').click(); }
async function play(id) {
    await frame(id).locator('video').evaluate(async video => { video.muted = true; await video.play(); });
    await wait(async () => frame(id).locator('video').evaluate(video => video.currentTime > .1 && video.videoWidth > 0), 'Video bytes did not play');
    await frame(id).locator('video').evaluate(video => video.pause());
}
try {
    await page.goto(h.url); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
    const weatherId = await add('Weather', 'weather');
    assert(weatherService.calls.length === 0, 'Weather requested data without a city');
    await frame(weatherId).getByRole('textbox', { name: 'Weather city', exact: true }).fill('Pune');
    await saved(d => d.widgets.find(w => w.id === weatherId).content.city === 'Pune');
    await wait(async () => (await frame(weatherId).locator('.weather-temperature>span').textContent()) === '29', 'Live provider response was not rendered');
    assert(await frame(weatherId).locator('.weather-symbol').count() === 7, 'Forecast icons missing');
    assert(await frame(weatherId).locator('.forecast-temperatures').count() === 7, 'Forecast values missing');
    await frame(weatherId).getByRole('button', { name: 'Use Fahrenheit', exact: true }).click();
    await saved(d => d.widgets.find(w => w.id === weatherId).settings.units === 'fahrenheit');
    assert(await frame(weatherId).locator('.weather-temperature>span').textContent() === '84', 'Fahrenheit conversion failed');
    assert(weatherService.calls.length === 2, 'Unit change fetched weather again');
    weatherService.fail = true;
    await frame(weatherId).getByRole('button', { name: 'Refresh weather', exact: true }).click();
    await frame(weatherId).getByRole('alert').filter({ hasText: 'Showing the last update' }).waitFor();
    assert(await frame(weatherId).locator('.weather-temperature>span').textContent() === '84', 'Refresh error destroyed last readings');
    weatherService.fail = false;
    await frame(weatherId).getByRole('button', { name: 'Refresh weather', exact: true }).click();
    await wait(async () => !await frame(weatherId).getByRole('alert').count(), 'Weather did not recover');
    await frame(weatherId).getByRole('textbox', { name: 'Weather city', exact: true }).fill('BadCity');
    await frame(weatherId).getByRole('alert').filter({ hasText: 'City not found' }).waitFor();
    assert(await frame(weatherId).locator('.weather-temperature').getAttribute('aria-label') === 'Temperature unavailable', 'Invalid city showed previous city readings');
    await frame(weatherId).getByRole('textbox', { name: 'Weather city', exact: true }).fill('Pune');
    await wait(async () => await frame(weatherId).locator('.weather-temperature>span').textContent() === '84', 'City did not recover from cache');

    const image = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d'); const base = ctx.createLinearGradient(0, 0, 1280, 720);
        base.addColorStop(0, '#dcece5'); base.addColorStop(.55, '#f5e6c8'); base.addColorStop(1, '#c4e0e8'); ctx.fillStyle = base; ctx.fillRect(0, 0, 1280, 720);
        const glow = ctx.createRadialGradient(900, 260, 10, 900, 260, 500); glow.addColorStop(0, '#fff4c8'); glow.addColorStop(1, '#fff4c800'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 1280, 720);
        return canvas.toDataURL('image/png').split(',')[1];
    });
    await openSettings();
    await page.getByLabel('Dashboard background file', { exact: true }).setInputFiles({ name: 'soft-background.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    await page.getByText('Unsaved background changes', { exact: true }).waitFor();
    await page.getByRole('slider', { name: 'Dashboard background softness', exact: true }).fill('45');
    await button('Save background').click(); await saved(d => d.background.assetId && d.background.dim === 45);
    const originalBackground = (await documentOf(page)).background.assetId;
    await page.locator('.background-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/screenshots/dashboard-background-settings.png' });
    await page.keyboard.press('Escape');
    await wait(async () => await page.locator('.dashboard-backdrop').count() === 1, 'Background did not apply');
    await button('Undo').click(); await saved(d => d.background.assetId === null);
    await button('Redo').click(); await saved(d => d.background.assetId === originalBackground);

    const videoId = await add('Video', 'video');
    const clip = (await readFile('.test-build/browser-fixture.webm')).toString('base64');
    await frame(videoId).locator('input[type=file]').setInputFiles({ name: 'moving-memory.webm', mimeType: 'video/webm', buffer: Buffer.from(clip, 'base64') });
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('purrductivity.dashboard')).widgets.find(w => w.id === id)?.content.assetId || document.querySelector(`[data-widget-id="${id}"] [role=alert]`)?.textContent, videoId, { timeout: 16000 });
    assert((await documentOf(page)).widgets.find(w => w.id === videoId).content.assetId, 'Video upload failed: ' + await frame(videoId).textContent());
    const originalVideo = (await documentOf(page)).widgets.find(w => w.id === videoId).content.assetId;
    await frame(videoId).getByRole('textbox', { name: 'Video caption', exact: true }).fill('A slow afternoon');
    await saved(d => d.widgets.find(w => w.id === videoId).content.caption === 'A slow afternoon');
    await play(videoId);
    await frame(videoId).locator('input[type=file]').setInputFiles({ name: 'fake.mp4', mimeType: 'video/mp4', buffer: Buffer.from('<script>not a video</script>') });
    await frame(videoId).getByRole('alert').filter({ hasText: 'real MP4 or WebM' }).waitFor();
    assert((await documentOf(page)).widgets.find(w => w.id === videoId).content.assetId === originalVideo, 'Invalid upload replaced video');
    await page.reload(); await frame(videoId).locator('video').waitFor(); await play(videoId);
    assert((await documentOf(page)).background.assetId === originalBackground, 'Reload lost background');
    await menu(videoId); await button('Pin Video').click(); await saved(d => d.widgets.find(w => w.id === videoId).pinned);
    await frame(videoId).locator('.pin-tape').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await frame(videoId).locator('.pin-tape').evaluate(el => getComputedStyle(el).animationName) === 'none', 'Tape ignored reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openSettings();
    const downloadPromise = page.waitForEvent('download'); await button('Export JSON').click(); const download = await downloadPromise;
    const raw = await readFile(await download.path()), backup = JSON.parse(raw.toString());
    assert(backup.dashboard.schemaVersion === 4 && backup.images.length === 2, 'Backup omitted video/background');
    assert(backup.images.some(asset => asset.type === 'video/webm') && backup.images.some(asset => asset.id === originalBackground), 'Backup media references missing');
    await page.getByLabel('Import dashboard backup file', { exact: true }).setInputFiles({ name: 'media-backup.json', mimeType: 'application/json', buffer: raw });
    await page.getByRole('dialog', { name: 'Import backup', exact: true }).waitFor(); await button('Back up and replace').click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await saved(d => d.background.assetId !== originalBackground && d.widgets.find(w => w.id === videoId).content.assetId !== originalVideo);
    await play(videoId);
    await openSettings(); await button('Reset Dashboard').click(); await button('Back up and reset').click();
    await saved(d => d.widgets.length === 4 && d.background.assetId === null);
    await openSettings(); await button('Restore previous dashboard').click(); await button('Back up and replace').click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await frame(videoId).locator('video').waitFor(); await play(videoId);
    await wait(async () => await page.locator('.dashboard-backdrop').count() === 1, 'Recovery lost background image');
    await page.evaluate(({ weatherId, videoId }) => {
        const d = JSON.parse(localStorage.getItem('purrductivity.dashboard'));
        d.widgets = d.widgets.filter(w => [weatherId, videoId, 'sticky-initial', 'notes-initial'].includes(w.id));
        Object.assign(d.widgets.find(w => w.id === weatherId), { position: { x: 55, y: 110 }, size: { width: 640, height: 440 }, pinned: true });
        Object.assign(d.widgets.find(w => w.id === videoId), { position: { x: 760, y: 110 }, size: { width: 360, height: 400 } });
        Object.assign(d.widgets.find(w => w.id === 'sticky-initial'), { position: { x: 1190, y: 110 }, size: { width: 250, height: 250 }, pinned: true, content: { text: 'A little reminder…\nMake room for a slower afternoon.' } });
        Object.assign(d.widgets.find(w => w.id === 'notes-initial'), { position: { x: 1190, y: 425 }, size: { width: 470, height: 310 }, pinned: true, title: 'Room for good ideas', content: { text: 'Your photos, clips and background stay on this device.\n\nA quiet place to gather the day.' } });
        localStorage.setItem('purrductivity.dashboard', JSON.stringify(d));
    }, { weatherId, videoId });
    await page.reload(); await frame(videoId).locator('video').waitFor(); await wait(async () => await frame(weatherId).locator('.weather-symbol').count() === 7, 'Forecast missing after recovery');
    await frame(videoId).locator('video').evaluate(video => { video.currentTime = .4; });
    await page.locator('.toolbar').click({ position: { x: 2, y: 2 } });
    await page.screenshot({ path: 'docs/screenshots/media-weather-background-dashboard.png' });
    const tapeBox = await frame(videoId).locator('.pin-tape').boundingBox(), cardBox = await frame(videoId).boundingBox();
    assert(tapeBox.x < cardBox.x + cardBox.width / 4 && tapeBox.y < cardBox.y + 10, 'Tape is not at upper-left');
    assert(await page.locator('.workspace-viewport').evaluate(el => getComputedStyle(el).scrollbarWidth) === 'none', 'Canvas retained a scrollbar');
    await page.setViewportSize({ width: 390, height: 844 }); await frame(videoId).scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow media layout overflowed');
    await frame(videoId).screenshot({ path: 'docs/screenshots/video-widget-narrow.png' });
    await menu(videoId); const popup = await page.locator('.card-action-menu:not([hidden])').boundingBox();
    assert(popup.x >= 0 && popup.x + popup.width <= 390, 'Media menu escaped viewport');
    await page.keyboard.press('Escape');
    assert(!h.errors.length, h.errors.join('\n'));
    console.log('Passed media/background/live-weather browser checks: real video decode/play/reload, invalid upload preservation, caption, top-left tape/reduced motion, local background save/history/reload, portable media backup/import/reset/recovery, forecast and units, offline refresh preservation, invalid city, narrow layout and menu. Weather network responses were controlled fixtures.');
} finally { await h.close(); }
