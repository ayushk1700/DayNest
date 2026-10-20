import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE ?? import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true, args:["--allow-file-access-from-files"], executablePath:process.env.EDGE_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
const page=await browser.newPage({viewport:{width:1920,height:925}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('docs/screenshots',{recursive:true});
await page.goto(pathToFileURL(resolve('dist/index.html')).href);await page.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();await page.screenshot({path:'docs/screenshots/dashboard.png'});
await page.getByRole('button',{name:'Open Settings',exact:true}).click();
await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor();
await page.screenshot({path:'docs/screenshots/settings.png'});
if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Close Settings')throw Error('Settings initial focus');
await page.keyboard.press('Tab');
if(!await page.getByRole('dialog',{name:'Settings',exact:true}).evaluate(el=>el.contains(document.activeElement)))throw Error('Settings focus escaped');
await page.keyboard.press('Escape');
if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Open Settings')throw Error('Settings focus return');
await page.getByRole('button',{name:'Add Widget',exact:true}).click();await page.screenshot({path:'docs/screenshots/widget-picker.png'});
await page.keyboard.press('Escape');
if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Add Widget')throw Error('Picker focus return');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/narrow.png',fullPage:true});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Narrow horizontal overflow');
await page.getByRole('button',{name:'Open Settings',exact:true}).click();await page.screenshot({path:'docs/screenshots/narrow-settings.png',fullPage:true});
const bounds=await page.getByRole('dialog',{name:'Settings',exact:true}).boundingBox();
if(!bounds||bounds.x<0||bounds.x+bounds.width>390)throw Error('Narrow settings clipped');
await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Add Widget',exact:true}).click();
await page.screenshot({path:'docs/screenshots/narrow-picker.png'});
await page.locator('.picker-dismiss').click({position:{x:2,y:2}});
if(await page.getByRole('dialog').count())throw Error('Outside dismissal failed');
if(errors.length)throw Error(errors.join('\n'));
console.log('Passed: overlays open, focus containment/return, Escape, narrow overflow and no page errors. Screenshots saved at 1920x925 and 390x844.');await browser.close();




