import { resolve } from 'node:path';
import { mockWeather } from './weather-fixture.mjs';
import { harness, assert, wait, documentOf } from './browser-harness.mjs';

const h = await harness();
await mockWeather(h.context);
const page = await h.context.newPage();
const requests = [];
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(h.url).origin && !['geocoding-api.open-meteo.com', 'api.open-meteo.com'].includes(new URL(request.url()).hostname)) requests.push(request.url()); });
const frame = id => page.locator(`[data-widget-id="${id}"]`);
const saved = fn => wait(async () => fn(await documentOf(page)), 'Expected saved dashboard state');
async function add(label, type) {
    await page.getByRole('button', { name: 'Add Widget', exact: true }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await saved(d => d.widgets.some(w => w.type === type));
    return (await documentOf(page)).widgets.findLast(w => w.type === type).id;
}
async function menu(id) {
    const button = frame(id).getByRole('button', { name: /^Card menu for / });
    await button.focus(); await button.press('ArrowDown');
}
try {
    await page.clock.install();
    await page.goto(h.url);
    await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
    const dateId = await add('Date', 'date');
    const weatherId = await add('Weather', 'weather');
    const weather = frame(weatherId);
    await weather.getByRole('textbox', { name: 'Weather city', exact: true }).fill('San Francisco');
    await saved(d => d.widgets.find(w => w.id === weatherId).content.city === 'San Francisco');
    await weather.getByRole('button', { name: 'Use Fahrenheit', exact: true }).click();
    await saved(d => d.widgets.find(w => w.id === weatherId).settings.units === 'fahrenheit');
    await wait(async () => await weather.locator('.weather-symbol').count() === 7, 'Forecast did not render');
    assert(await weather.locator('.weather-temperature').getAttribute('aria-label') === '84 degrees fahrenheit', 'Live temperature was not converted');
    assert(await weather.locator('.weather-week li').count() === 7, 'Week strip missing');
    assert(await weather.locator('.weather-week li[aria-current=date]').count() === 1, 'Today is not identified');

    const midnight = await page.evaluate(() => new Date(2026, 9, 20, 23, 59, 58).getTime());
    await page.clock.setSystemTime(new Date(midnight));
    await page.clock.fastForward(1100);
    await wait(async () => (await frame(dateId).locator('.date-number').textContent()) === '20th', 'Date did not follow device time');
    await page.clock.fastForward(2000);
    await wait(async () => (await frame(dateId).locator('.date-number').textContent()) === '21st', 'Date did not roll over at local midnight');
    assert(await frame(dateId).locator('.date-banner').getAttribute('datetime') === '2026-10-21', 'Date time semantics used UTC');
    await page.reload();
    await frame(dateId).locator('.date-banner').waitFor();
    assert((await documentOf(page)).widgets.find(w => w.id === weatherId).settings.units === 'fahrenheit', 'Weather units lost on reload');
    assert(await weather.getByRole('textbox', { name: 'Weather city', exact: true }).inputValue() === 'San Francisco', 'City lost on reload');

    const heading = frame(dateId).getByRole('group');
    const before = (await documentOf(page)).widgets.find(w => w.id === dateId);
    await heading.focus(); await heading.press('ArrowRight');
    await saved(d => d.widgets.find(w => w.id === dateId).position.x === before.position.x + 16);
    await menu(dateId);
    await page.getByRole('button', { name: 'Pin Date', exact: true }).click();
    await saved(d => d.widgets.find(w => w.id === dateId).pinned);
    await heading.focus(); await heading.press('ArrowRight');
    assert((await documentOf(page)).widgets.find(w => w.id === dateId).position.x === before.position.x + 16, 'Pinned date moved');
    await menu(dateId);
    await page.getByRole('button', { name: 'Unpin Date', exact: true }).click();
    await saved(d => !d.widgets.find(w => w.id === dateId).pinned);

    // Isolated capture fixtures; these writes never touch the user's extension origin.
    await page.evaluate(({ dateId, weatherId }) => {
        const d = JSON.parse(localStorage.getItem('purrductivity.dashboard'));
        d.widgets = d.widgets.filter(w => [dateId, weatherId].includes(w.id));
        Object.assign(d.widgets.find(w => w.id === weatherId), { position: { x: 45, y: 110 }, size: { width: 620, height: 410 } });
        Object.assign(d.widgets.find(w => w.id === dateId), { position: { x: 710, y: 110 }, size: { width: 900, height: 315 } });
        localStorage.setItem('purrductivity.dashboard', JSON.stringify(d));
    }, { dateId, weatherId });
    await page.reload(); await frame(dateId).locator('.date-banner').waitFor();
    await page.clock.setSystemTime(new Date(await page.evaluate(() => new Date(2026, 9, 20, 12).getTime())));
    await page.clock.fastForward(1100);
    await page.screenshot({ path: 'docs/screenshots/date-weather-dashboard.png' });
    for (const id of [dateId, weatherId]) {
        const content = frame(id).locator(id === dateId ? '.date-card' : '.weather-card');
        assert(await content.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1), `Desktop card content overflowed: ${id}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow page overflowed');
    await frame(dateId).scrollIntoViewIfNeeded();
    await frame(dateId).screenshot({ path: 'docs/screenshots/date-widget-narrow.png' });
    await frame(weatherId).scrollIntoViewIfNeeded();
    await frame(weatherId).screenshot({ path: 'docs/screenshots/weather-widget-narrow.png' });
    await menu(dateId);
    const menuBox = await page.locator('.card-action-menu:not([hidden])').boundingBox();
    assert(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 390, 'Date menu escaped narrow viewport');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1920, height: 925 });
    const imageId = await add('Image', 'image');
    await frame(imageId).locator('input[type=file]').setInputFiles(resolve('public/icons/icon-128.png'));
    await saved(d => !!d.widgets.find(w => w.id === imageId).content.assetId);
    await frame(imageId).getByRole('textbox', { name: 'Image caption', exact: true }).fill('A little moment');
    await saved(d => d.widgets.find(w => w.id === imageId).content.caption === 'A little moment');
    await frame(imageId).hover();
    await frame(imageId).getByRole('button', { name: 'Replace image', exact: true }).waitFor();
    await frame(imageId).screenshot({ path: 'docs/screenshots/polaroid-widget.png' });
    const stickyId = await add('Sticky Note', 'sticky');
    await frame(stickyId).getByRole('textbox', { name: 'Sticky note text', exact: true }).fill('A little reminder…');
    await saved(d => d.widgets.find(w => w.id === stickyId).content.text === 'A little reminder…');
    await frame(stickyId).screenshot({ path: 'docs/screenshots/curled-sticky-widget.png' });
    assert(!h.errors.length, h.errors.join('\n'));
    assert(!requests.length, 'Unexpected external requests: ' + requests.join('\n'));
    console.log('Passed date/weather browser checks: picker, local midnight rollover, persistence, city/units, live forecast fixtures, keyboard/pin, desktop/narrow layout/menu, image upload/caption hover controls, sticky editing and no external requests.');
} finally { await h.close(); }
