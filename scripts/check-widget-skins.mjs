import { harness, assert, wait, documentOf } from './browser-harness.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { seedDashboard, emptyAppearance } = require('../.test-build/state/model.js');
const { createWidget } = require('../.test-build/dashboard/layout.js');
const { validateDashboard } = require('../.test-build/state/validation.js');
const h = await harness(), page = await h.context.newPage();
const saved = fn => wait(async () => fn(await documentOf(page)), 'Skin setting did not save');
const frame = id => page.locator(`[data-widget-id="${id}"]`);
async function add(name, kind) {
    await page.getByRole('button', { name: 'Add Widget', exact: true }).click();
    await page.getByRole('dialog', { name: 'Add Widget', exact: true }).getByRole('button', { name, exact: true }).click();
    await saved(d => d.widgets.some(w => w.type === kind));
    return (await documentOf(page)).widgets.filter(w => w.type === kind).at(-1).id;
}
async function show(id) { await frame(id).getByRole('group').focus(); }
try {
    await page.clock.install({ time: new Date(2026, 11, 20, 17, 44, 0) });
    await page.goto(h.url); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
    const clock = await add('Clock', 'clock');
    await frame(clock).locator('.digital-case').waitFor();
    assert(await frame(clock).getByRole('timer', { name: 'Local time' }).innerText().then(s => s.includes('44')), 'Digital clock time inaccessible');
    await page.clock.setSystemTime(new Date(2026, 11, 20, 17, 44, 0));
    await page.clock.fastForward(1100);
    await wait(async () => await frame(clock).locator('.lcd-seconds svg path[opacity="1"]').count() === 8, 'Digital seconds did not tick to 01');
    await frame(clock).getByRole('combobox', { name: 'Clock style', exact: true }).selectOption('analog');
    await saved(d => d.widgets.find(w => w.id === clock).settings.style === 'analog');
    await frame(clock).getByRole('checkbox', { name: '24-hour clock', exact: true }).check();
    await saved(d => d.widgets.find(w => w.id === clock).settings.hour24);
    const before = await frame(clock).locator('.second-hand').evaluate(e => e.parentElement.getAttribute('transform'));
    await page.clock.fastForward(2000);
    assert(before !== await frame(clock).locator('.second-hand').evaluate(e => e.parentElement.getAttribute('transform')), 'Analog hands did not tick');
    const notes = 'notes-initial'; await show(notes);
    await frame(notes).getByRole('textbox', { name: 'Notes text', exact: true }).fill('A little room for ideas.\nKeep the words, change the paper.');
    await page.clock.fastForward(1500);
    await saved(d => d.widgets.find(w => w.id === notes).content.text.startsWith('A little room'));
    for (const skin of ['lined', 'grid', 'dotted', 'kraft', 'plain']) {
        await frame(notes).getByRole('combobox', { name: 'Notes paper', exact: true }).selectOption(skin);
        await saved(d => d.widgets.find(w => w.id === notes).settings.skin === skin);
        assert(await frame(notes).getByRole('textbox', { name: 'Notes text', exact: true }).inputValue() === 'A little room for ideas.\nKeep the words, change the paper.', 'Paper switch lost text');
    }
    const calendar = await add('Calendar', 'calendar');
    for (const [date, title] of [['2026-12-25', 'Christmas Day'], ['2026-12-31', 'New Year Party']]) {
        await frame(calendar).getByRole('button', { name: 'Add event', exact: true }).click();
        await page.getByLabel('Event title', { exact: true }).fill(title);
        await page.getByLabel('Event date', { exact: true }).fill(date);
        await page.getByRole('button', { name: 'Save event', exact: true }).click();
        await saved(d => d.widgets.find(w => w.id === calendar).content.events.some(e => e.title === title));
    }
    await frame(calendar).getByRole('combobox', { name: 'Calendar week starts', exact: true }).selectOption('1');
    await saved(d => d.widgets.find(w => w.id === calendar).settings.weekStartsOn === 1);
    assert(await frame(calendar).locator('th').first().innerText() === 'Mo', 'Week header did not update');
    await frame(calendar).getByRole('button', { name: '2027-01-01', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert(await frame(calendar).getByRole('button', { name: '2027-01-02', exact: true }).getAttribute('aria-pressed') === 'true', 'Calendar keyboard rollover failed');
    await page.reload(); await frame(clock).locator('.analog-case').waitFor();
    assert((await documentOf(page)).widgets.find(w => w.id === clock).settings.hour24, 'Clock format lost on reload');
    assert((await documentOf(page)).widgets.find(w => w.id === calendar).content.events.length === 2, 'Calendar events lost on reload');
    await show(notes); await frame(notes).getByRole('button', { name: /Card menu for/ }).click();
    await page.getByRole('button', { name: 'Customize Notes (titles are changeable)', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize card', exact: true });
    const paperControl = dialog.locator('.skin-customization').getByRole('combobox', { name: 'Notes paper', exact: true });
    assert(await paperControl.evaluate(el => !el.closest('[inert]')), 'Customize paper control is inside an inert preview');
    await paperControl.selectOption('lined');
    await saved(d => d.widgets.find(w => w.id === notes).settings.skin === 'lined');
    await dialog.getByRole('button', { name: 'Close card customization', exact: true }).click();
    // An isolated reference layout for visual review; no production sample events are seeded.
    const doc = seedDashboard(); doc.widgets = [];
    const place = (kind, id, title, x, y, width, height) => {
        const w = createWidget(kind, id); Object.assign(w, { title, position: { x, y }, size: { width, height }, zIndex: doc.widgets.length }); doc.widgets.push(w); return w;
    };
    place('clock', 'digital-preview', 'Digital clock', 55, 115, 310, 310);
    const analog = place('clock', 'analog-preview', 'Analog clock', 410, 115, 310, 310); analog.settings.style = 'analog';
    const cal = place('calendar', 'calendar-preview', 'Calendar', 780, 105, 405, 535);
    cal.content.events = [{ id: 'christmas', date: '2026-12-25', title: 'Christmas Day' }, { id: 'party', date: '2026-12-31', title: 'New Year Party' }];
    for (const [i, skin] of ['plain', 'lined', 'grid', 'dotted', 'kraft'].entries()) {
        const w = place('notes', `paper-${skin}`, `${skin[0].toUpperCase() + skin.slice(1)} paper`, 55 + i * 355, 690, 325, 300);
        w.settings = { ruled: skin === 'lined', skin }; w.content.text = 'A little room for ideas.\n\nMake something lovely today.\nOne small step at a time.';
    }
    const simple = place('clock', 'simple-preview', 'Simple clock', 1255, 150, 360, 235); simple.settings.style = 'simple'; simple.settings.hour24 = true;
    const custom = place('notes', 'custom-paper', 'Your color, your paper', 1255, 425, 360, 215); custom.settings = { ruled: false, skin: 'dotted' }; custom.content.text = 'Paper skins work with your\ncard colors, too.'; custom.appearance = { ...emptyAppearance(), backgroundColor: '#243c43', borderColor: '#9dbbb5' };
    validateDashboard(doc);
    await page.evaluate(doc => localStorage.setItem('purrductivity.dashboard', JSON.stringify(doc)), doc);
    await page.setViewportSize({ width: 1920, height: 1120 });
    await page.reload(); await frame('calendar-preview').waitFor();
    await page.screenshot({ path: 'docs/screenshots/clock-paper-calendar-desktop.png', fullPage: true });
    await frame('digital-preview').screenshot({ path: 'docs/screenshots/clock-digital.png' });
    await frame('analog-preview').screenshot({ path: 'docs/screenshots/clock-analog.png' });
    await frame('calendar-preview').screenshot({ path: 'docs/screenshots/calendar-studio.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow page overflow');
    for (const id of ['digital-preview', 'analog-preview', 'calendar-preview', 'paper-lined', 'custom-paper']) {
        await frame(id).scrollIntoViewIfNeeded();
        assert(await frame(id).evaluate(el => el.querySelector('.widget').scrollWidth <= el.querySelector('.widget').clientWidth + 1), `Narrow card overflow: ${id}`);
    }
    await frame('calendar-preview').screenshot({ path: 'docs/screenshots/calendar-studio-narrow.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await frame('calendar-preview').locator('[data-day]').first().evaluate(el => getComputedStyle(el).transitionDuration) === '0s', 'Reduced motion ignored');
    await page.setViewportSize({ width: 1920, height: 925 });
    const compact = structuredClone(doc); compact.widgets = compact.widgets.slice(0, 3);
    compact.widgets[0].size = { width: 240, height: 180 }; compact.widgets[1].size = { width: 240, height: 180 }; compact.widgets[2].size = { width: 320, height: 320 };
    await page.evaluate(doc => localStorage.setItem('purrductivity.dashboard', JSON.stringify(doc)), compact);
    await page.reload(); await frame('digital-preview').waitFor();
    for (const id of ['digital-preview', 'analog-preview']) {
        const metrics = await frame(id).evaluate(el => { const card = el.querySelector('.widget'), face = el.querySelector('.clock-face').getBoundingClientRect(), options = el.querySelector('.clock-options').getBoundingClientRect(), digits = el.querySelector('.lcd-main'); return { width: card.scrollWidth - card.clientWidth, height: card.scrollHeight - card.clientHeight, overlap: face.bottom - options.top, digits: digits?.getBoundingClientRect().height ?? 0 }; });
        assert(metrics.width <= 1 && metrics.height <= 1 && metrics.overlap <= 0, `Compact clock overflow: ${id}: ${JSON.stringify(metrics)}`);
        if (id === 'digital-preview') assert(metrics.digits >= 25, `Compact digital clock unreadable: ${JSON.stringify(metrics)}`);
    }
    await frame('digital-preview').screenshot({ path: 'docs/screenshots/clock-digital-compact.png' });
    await frame('calendar-preview').getByRole('button', { name: 'Add event', exact: true }).click();
    await page.getByRole('dialog', { name: 'New calendar event', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
    assert(!h.errors.length, h.errors.join('\n'));
    console.log('Passed clock faces/live ticks/12-24h/reload, all Notes skins/text preservation/customization, calendar event creation/week starts/keyboard/reload, desktop/narrow sizing and reduced-motion checks.');
} finally { await h.close(); }
