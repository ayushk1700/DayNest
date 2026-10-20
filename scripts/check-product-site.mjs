import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE ?? import.meta.url), { chromium } = require('playwright');
const url = process.env.DAYNEST_SITE_URL ?? 'http://127.0.0.1:4177/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], failed = [], widths = [];
page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
const check = (ok, message) => { if (!ok) throw Error(message); };
try {
 await page.goto(url); await page.locator('#product-preview').waitFor();
 await mkdir('artifacts/release-2026-10-20/site', { recursive: true });
 await page.screenshot({ path: 'artifacts/release-2026-10-20/site/desktop.png', fullPage: true });
 for (const [name, file] of [['Midnight', '02-after-hours.png'], ['Matcha', '03-make-it-yours.png'], ['Warm Earth', '01-your-day.png']]) {
  await page.getByRole('button', { name, exact: true }).click(); check(await page.locator('#product-preview').getAttribute('src') === `assets/${file}`, 'Theme preview failed');
  check(await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed') === 'true', 'Theme selection not accessible');
  await page.locator('#product-preview').evaluate(img => img.decode());
 }
 await page.getByText('Can I install DayNest today?', { exact: true }).click(); check(await page.locator('details').first().getAttribute('open') !== null, 'FAQ does not open');
 for (const width of [390, 640, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Site overflow at ${width}`); widths.push(width); }
 await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'artifacts/release-2026-10-20/site/mobile.png', fullPage: true });
 for (const file of ['privacy.html', 'support.html']) {
  await page.goto(new URL(file, url).href); check(await page.locator('h1').count() === 1, `Missing ${file} heading`); check(await page.getByRole('link', { name: /aayush31500@outlook.com|Email DayNest support/ }).count() > 0, `Missing support contact on ${file}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${file} mobile overflow`);
  await page.screenshot({ path: `artifacts/release-2026-10-20/site/${file.replace('.html', '')}.png`, fullPage: true });
 }
 check(!errors.length && !failed.length, JSON.stringify({ errors, failed }));
 const result = { url, widths, themeSwitch: true, faq: true, privacyAndSupport: true, errors, failed }; await writeFile('artifacts/release-2026-10-20/site/checks.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
