import { harness, assert, wait, documentOf } from './browser-harness.mjs';
const h = await harness(), page = await h.context.newPage();
try {
    await page.goto(h.url); await page.getByRole('textbox', { name: 'Notes text', exact: true }).waitFor();
    const before = await documentOf(page);
    const enter = () => page.getByRole('button', { name: 'Enter fullscreen', exact: true });
    const exit = () => page.getByRole('button', { name: 'Exit fullscreen', exact: true });
    await enter().click();
    await wait(() => page.evaluate(() => document.fullscreenElement === document.documentElement), 'Fullscreen did not open');
    assert(await exit().getAttribute('aria-pressed') === 'true', 'Fullscreen button did not reflect browser state');
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    assert(await page.getByRole('dialog', { name: 'Settings', exact: true }).isVisible(), 'Settings missing in fullscreen');
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await exit().click();
    await wait(() => page.evaluate(() => !document.fullscreenElement), 'Fullscreen exit failed');
    await enter().focus(); await page.keyboard.press('Enter');
    await wait(() => page.evaluate(() => !!document.fullscreenElement), 'Keyboard fullscreen failed');
    // Browser-owned exits must update the toggle, including a native Escape exit.
    await page.evaluate(() => document.exitFullscreen());
    await enter().waitFor();
    assert(JSON.stringify(await documentOf(page)) === JSON.stringify(before), 'Fullscreen changed saved dashboard data');
    // Recover is still reachable, with its original layout behavior, in Settings.
    await page.evaluate(() => { const key = 'purrductivity.dashboard', d = JSON.parse(localStorage.getItem(key)); d.widgets.find(w => w.id === 'notes-initial').position = { x: 90000, y: 90000 }; localStorage.setItem(key, JSON.stringify(d)); });
    await page.reload(); await enter().waitFor();
    await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Recover widgets', exact: true }).click();
    await wait(async () => (await documentOf(page)).widgets.find(w => w.id === 'notes-initial').position.x < 1920, 'Settings recovery failed');
    // A rejected browser request reports an error and leaves an enabled retry.
    await page.evaluate(() => { document.documentElement.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
    await enter().click();
    await page.getByRole('alert').filter({ hasText: 'Fullscreen could not open' }).waitFor();
    assert(await enter().isEnabled(), 'Denied fullscreen left toggle disabled');
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await enter().isVisible(), 'Fullscreen missing in narrow layout');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow fullscreen toolbar overflow');
    assert(!h.errors.length, h.errors.join('\n'));
    console.log('Passed actual Edge fullscreen enter/exit, keyboard activation, browser exit synchronization, Settings visibility, data preservation, relocated Recover widgets, denied-request retry and narrow layout.');
} finally { await h.close(); }
