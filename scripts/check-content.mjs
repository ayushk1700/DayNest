import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE??import.meta.url);
const {chromium}=require('playwright');
const root=resolve('dist');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const file=path===root?resolve(root,'index.html'):path;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/index.html`;
const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_EXECUTABLE??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1920,height:925}});
const a=await context.newPage(),b=await context.newPage();const errors=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('dialog',dialog=>dialog.accept());}
function check(ok,message){if(!ok)throw Error(message);}
const wait=async(fn,message)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error(message);};
const doc=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('purrductivity.dashboard')));
const saved=async(p,predicate)=>wait(async()=>predicate(await doc(p)),'Saved data condition timed out');
try {
 await a.goto(url);await a.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();await b.goto(url);await b.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();
 await a.getByRole('textbox',{name:'New task',exact:true}).fill('Ship with keyboard');await a.getByRole('textbox',{name:'New task',exact:true}).press('Enter');
 await b.getByRole('checkbox',{name:'Complete Ship with keyboard',exact:true}).waitFor();await b.getByRole('checkbox',{name:'Complete Ship with keyboard',exact:true}).press('Space');
 await saved(a,d=>d.widgets[0].content.tasks.some(t=>t.text==='Ship with keyboard'&&t.completed));
 await a.getByRole('button',{name:'Edit task: Ship with keyboard',exact:true}).focus();await a.getByRole('button',{name:'Edit task: Ship with keyboard',exact:true}).click();
 await a.getByRole('textbox',{name:'Edit task',exact:true}).fill('Edited task\nSecond line');await saved(a,d=>d.widgets[0].content.tasks.some(t=>t.text==='Edited task\nSecond line'));
 const hostile='<img src=x onerror="window.executed=true">\nPlain text stays plain.';
 await a.getByRole('textbox',{name:'Notes text',exact:true}).fill(hostile);await saved(a,d=>d.widgets[1].content.text===hostile);
 await a.getByRole('textbox',{name:'Sticky note text',exact:true}).fill('A multiline\nsticky note');await saved(a,d=>d.widgets[3].content.text==='A multiline\nsticky note');
 await a.getByRole('button',{name:'Card menu for Notes (titles are changeable)',exact:true}).focus();await a.keyboard.press('ArrowDown');await a.getByRole('button',{name:'Rename Notes (titles are changeable)',exact:true}).focus();await a.getByRole('button',{name:'Rename Notes (titles are changeable)',exact:true}).click();await a.getByRole('textbox',{name:'Title for notes',exact:true}).fill('My notebook');await saved(a,d=>d.widgets[1].title==='My notebook');
 await a.reload();await a.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();check(await a.getByRole('textbox',{name:'Notes text',exact:true}).inputValue()===hostile,'Notes reload');check(await a.getByRole('textbox',{name:'Sticky note text',exact:true}).inputValue()==='A multiline\nsticky note','Sticky reload');check(await a.evaluate(()=>!window.executed),'Markup executed');
 // Both input events in one script tick ensure neither debounce can save first.
 await Promise.all([a.getByRole('textbox',{name:'Notes text',exact:true}).fill('Draft A'),b.getByRole('textbox',{name:'Notes text',exact:true}).fill('Draft B')]);
 await wait(async()=>await a.getByText('The saved content changed. Your change was not applied. Your draft is still here.',{exact:true}).count()+await b.getByText('The saved content changed. Your change was not applied. Your draft is still here.',{exact:true}).count()>0,'Missing conflict warning');
 const loser=await a.getByText('The saved content changed. Your change was not applied. Your draft is still here.',{exact:true}).count()?a:b;
 await loser.screenshot({path:'docs/screenshots/stage-4-conflict.png'});
 const draft=await loser.getByRole('textbox',{name:'Notes text',exact:true}).inputValue();check(['Draft A','Draft B'].includes(draft),'Draft lost');
 await loser.getByRole('button',{name:'Save my draft instead',exact:true}).click();await saved(a,d=>d.widgets[1].content.text===draft);
 await wait(async()=>await a.getByRole('textbox',{name:'Notes text',exact:true}).inputValue()===await b.getByRole('textbox',{name:'Notes text',exact:true}).inputValue(),'Tabs failed to converge');
 await a.getByRole('button',{name:'Clear all tasks',exact:true}).click();await a.getByRole('button',{name:'Cancel',exact:true}).click();check((await doc(a)).widgets[0].content.tasks.length===2,'Reset cancel changed tasks');
 await a.getByRole('button',{name:'Clear all tasks',exact:true}).click();await a.getByRole('button',{name:'Delete all tasks',exact:true}).click();await a.getByText('A fresh start. Add your first task above.',{exact:true}).waitFor();
 await a.getByRole('textbox',{name:'New task',exact:true}).fill('Delete this task'); await a.getByRole('textbox',{name:'New task',exact:true}).press('Enter'); await a.getByRole('checkbox',{name:'Complete Delete this task',exact:true}).waitFor(); await a.getByRole('button',{name:'Delete task: Delete this task',exact:true}).focus(); await a.getByRole('button',{name:'Delete task: Delete this task',exact:true}).click(); await saved(a,d=>d.widgets[0].content.tasks.length===0);
 await a.getByRole('textbox',{name:'Notes text',exact:true}).fill('');await saved(a,d=>d.widgets[1].content.text==='');
 await a.getByRole('textbox',{name:'Sticky note text',exact:true}).fill('');await saved(a,d=>d.widgets[3].content.text==='');await a.reload();await a.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();check((await doc(a)).widgets[0].content.tasks.length===0,'Empty todo reseeded');
 await a.getByRole('textbox',{name:'Notes text',exact:true}).fill('Long line '.repeat(500)+'\nLast line');await saved(a,d=>d.widgets[1].content.text.startsWith('Long line '));
 await mkdir('docs/screenshots',{recursive:true});await a.screenshot({path:'docs/screenshots/stage-4-long-content.png'});
 await a.setViewportSize({width:390,height:844});check(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow horizontal overflow');await a.screenshot({path:'docs/screenshots/stage-4-narrow.png',fullPage:true});
 // A failed storage write preserves the saved version and the editable local draft.
 const beforeFailure=(await doc(a)).widgets[1].content.text;
 await a.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='purrductivity.dashboard')throw new DOMException('Test quota exceeded','QuotaExceededError');return window.originalSetItem.call(this,key,value);};});
 await a.getByRole('textbox',{name:'Notes text',exact:true}).fill('Kept through storage failure');
 await a.getByRole('heading',{name:'Your dashboard could not be loaded or saved',exact:true}).waitFor();
 check((await doc(a)).widgets[1].content.text===beforeFailure,'Failed write overwrote storage');
 check(await a.getByRole('textbox',{name:'Notes text',exact:true}).inputValue()==='Kept through storage failure','Failed write lost draft');
 await a.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
 await a.getByRole('button',{name:'Retry storage',exact:true}).click();
 await a.getByRole('button',{name:'Save my draft instead',exact:true}).click();await saved(a,d=>d.widgets[1].content.text==='Kept through storage failure');
 // Corruption is retained until confirmed backup + recovery.
 await a.evaluate(()=>localStorage.setItem('purrductivity.dashboard','{broken'));await a.reload();await a.getByRole('heading',{name:'Your dashboard could not be loaded or saved',exact:true}).waitFor();check(await a.evaluate(()=>localStorage.getItem('purrductivity.dashboard'))==='{broken','Invalid data overwritten');await a.screenshot({path:'docs/screenshots/stage-3-recovery.png'});await a.getByRole('button',{name:'Back up and restore samples',exact:true}).click();await a.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();check(await a.evaluate(()=>JSON.parse(localStorage.getItem('purrductivity.recovery')).raw)==='{broken','Recovery backup missing');
 await a.setViewportSize({width:1920,height:925});await a.screenshot({path:'docs/screenshots/stage-4-dashboard.png'});
 // Deleting in one tab must not drop a dirty draft in another tab.
 await b.getByRole('textbox',{name:'Notes text',exact:true}).waitFor();
 await b.clock.install(); await b.clock.pauseAt(new Date());
 await a.getByRole('button',{name:'Card menu for Notes (titles are changeable)',exact:true}).focus();await a.keyboard.press('ArrowDown');await a.getByRole('button',{name:'Delete Notes (titles are changeable)',exact:true}).focus();await a.getByRole('button',{name:'Delete Notes (titles are changeable)',exact:true}).click();
 await a.keyboard.press('Shift+Tab'); check(await a.evaluate(()=>document.activeElement?.textContent)==='Delete widget','Confirmation backward focus trap'); await a.keyboard.press('Tab'); check(await a.evaluate(()=>document.activeElement?.textContent)==='Cancel','Confirmation forward focus trap');
 await b.getByRole('textbox',{name:'Notes text',exact:true}).fill('Keep this orphaned draft');
 await a.getByRole('button',{name:'Delete widget',exact:true}).click();
 await b.getByRole('heading',{name:'Unsaved drafts kept on this page',exact:true}).waitFor();
 check(await b.getByText('Keep this orphaned draft',{exact:true}).count()>0,'Orphaned draft lost');
 await b.getByRole('button',{name:'Discard draft',exact:true}).click();
 check(errors.length===0,errors.join('\n'));console.log('Passed browser checks: two tabs, task keyboard add/edit/toggle/clear, rename, plain text, notes/sticky autosave and reload, empty/long content, same-field conflict and explicit resolution, narrow layout, corrupt-data backup/recovery.');
} finally {await browser.close();server.close();}





