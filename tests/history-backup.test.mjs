import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {seedDashboard,THEMES,cardDefaults,canonicalTheme}=require('../.test-build/state/model.js');
const {decodeDashboard}=require('../.test-build/state/validation.js');
const {applyAction,ConflictError}=require('../.test-build/state/actions.js');
const {History,diff,reverse,applyPatches}=require('../.test-build/state/history.js');
const {Repository}=require('../.test-build/persistence/repository.js');
const {parseBackup}=require('../.test-build/persistence/backup.js');
const edit=(d,value)=>({type:'text',widgetId:'notes-initial',expected:d.widgets.find(w=>w.id==='notes-initial').content.text,value});
function memory(doc=seedDashboard()) { const state={raw:JSON.stringify(doc),backup:undefined,failBackup:false,failWrite:false};let queue=Promise.resolve();const adapter={read:async()=>state.raw,readBackup:async()=>state.backup,write:async raw=>{if(state.failWrite)throw Error('quota');state.raw=raw;},backup:async raw=>{if(state.failBackup)throw Error('backup failed');state.backup={raw};},subscribe:()=>()=>{},exclusive:fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};return {state,repo:new Repository(adapter)}; }
test('all twelve recommended themes persist via validated actions and reject an unknown theme',()=>{
 for(const theme of THEMES){const d=seedDashboard(),next=applyAction(d,{type:'theme',expected:d.theme,value:theme});assert.equal(next.theme,theme);assert.deepEqual(decodeDashboard(JSON.stringify(next)),next);assert.deepEqual(parseBackup(JSON.stringify({format:'purrductivity-backup',version:1,exportedAt:'2026-10-19T00:00:00.000Z',dashboard:next,images:[]})).dashboard,next);assert.deepEqual(applyPatches(next,reverse(diff(d,next))).widgets,d.widgets);}
 assert.throws(()=>applyAction(seedDashboard(),{type:'theme',expected:'Dark Mode',value:'Lavender'}),ConflictError);
 assert.throws(()=>applyAction(seedDashboard(),{type:'theme',expected:'Ocean Breeze',value:'bad'}));
});

test('legacy theme names remain valid in backups and undo while selecting their recommended aliases',()=>{
 for(const [legacy,canonical] of [['Dark Mode','Midnight'],['Sunset','Soft Sunset']]){
  const before=seedDashboard();before.theme=legacy;
  assert.equal(canonicalTheme(decodeDashboard(JSON.stringify(before)).theme),canonical);
  const backup={format:'purrductivity-backup',version:1,exportedAt:'2026-10-19T00:00:00.000Z',dashboard:before,images:[]};
  assert.deepEqual(parseBackup(JSON.stringify(backup)).dashboard,before);
  const next=applyAction(before,{type:'theme',expected:legacy,value:canonical});
  assert.equal(next.theme,canonical);assert.equal(before.theme,legacy);
  assert.equal(applyPatches(next,reverse(diff(before,next))).theme,legacy);
  assert.deepEqual(next.widgets,before.widgets);
 }
});
test('history groups typing, supports repeated undo/redo, and drops redo on a new edit',()=>{
 const h=new History();let d=seedDashboard();
 for(const [at,text] of [[100,'one'],[400,'two'],[800,'three']]){const a=edit(d,text),next=applyAction(d,a);h.record({before:d,after:next},a,at);d=next;}
 assert.equal(h.undo.length,1);
 const original=seedDashboard().widgets[1].content.text;
 for(let i=0;i<3;i++){
  let next=applyPatches(d,reverse(h.undo.at(-1).patches));h.complete('undo',{before:d,after:next});d=next;assert.equal(d.widgets[1].content.text,original);
  next=applyPatches(d,h.redo.at(-1).patches);h.complete('redo',{before:d,after:next});d=next;assert.equal(d.widgets[1].content.text,'three');
 }
 const next=applyPatches(d,reverse(h.undo.at(-1).patches));h.complete('undo',{before:d,after:next});const a=edit(next,'new branch'),last=applyAction(next,a);h.record({before:next,after:last},a,5000);assert.equal(h.redo.length,0);
});
test('history preserves unrelated tab edits and refuses to overwrite same-field changes atomically',()=>{
 const d=seedDashboard(),after=applyAction(d,edit(d,'my edit')),p=diff(d,after);
 let current=applyAction(after,{type:'addTask',widgetId:'todo-initial',task:{id:'other',text:'Other tab',completed:false}});
 const undone=applyPatches(current,reverse(p));assert.equal(undone.widgets[0].content.tasks.at(-1).text,'Other tab');
 current=applyAction(current,edit(current,'newer'));assert.throws(()=>applyPatches(current,reverse(p)),ConflictError);assert.equal(current.widgets[1].content.text,'newer');
 const multi=diff(d,{...after,zoom:.75});const bad=structuredClone(after);bad.zoom=1.5;assert.throws(()=>applyPatches(bad,reverse(multi)));assert.equal(bad.widgets[1].content.text,'my edit');
});
test('delete history restores widget content and layout without overwriting changed widgets',()=>{
 const d=seedDashboard(),w=d.widgets[1],after=applyAction(d,{type:'deleteWidget',widgetId:w.id,expected:w});
 const restored=applyPatches(after,reverse(diff(d,after)));assert.deepEqual(restored.widgets.find(x=>x.id===w.id),w);
 const newer=applyAction(d,edit(d,'Keep this'));assert.throws(()=>applyPatches(newer,diff(d,after)),ConflictError);
});
test('each drag has one history entry; live delivery, front selection and timer commands are not recorded',()=>{
 const h=new History(),d=seedDashboard();
 const a={type:'layout',widgetId:d.widgets[0].id,expected:{position:d.widgets[0].position,size:d.widgets[0].size},value:{position:{x:200,y:100},size:d.widgets[0].size}};
 const after=applyAction(d,a);h.record({before:d,after},a);assert.equal(h.undo.length,1);
 const front=applyAction(after,{type:'front',widgetId:'notes-initial'});h.record({before:after,after:front},{type:'front',widgetId:'notes-initial'});assert.equal(h.undo.length,1);
 const t=front.widgets.find(w=>w.type==='pomodoro');const action={type:'timer',widgetId:t.id,expected:t.content,command:'start',sessionId:'session',timeZone:'UTC'};const running=applyAction(front,action,1000);h.record({before:front,after:running},action);assert.equal(h.undo.length,1);
 const undone=applyPatches(running,reverse(h.undo[0].patches));assert.equal(undone.widgets.find(w=>w.type==='pomodoro').content.status,'running');
});
test('restoring deleted running timers pauses them and never replays pending notifications',()=>{
 let d=seedDashboard();const t=d.widgets[2];d=applyAction(d,{type:'timer',widgetId:t.id,expected:t.content,command:'start',sessionId:'session',timeZone:'UTC'},1000);
 const deleted=applyAction(d,{type:'deleteWidget',widgetId:t.id,expected:d.widgets[2]});const restored=applyPatches(deleted,reverse(diff(d,deleted)),5000).widgets.find(w=>w.id===t.id);assert.equal(restored.content.status,'paused');assert.equal(restored.content.deadline,null);assert.equal(restored.content.remainingMs,1496000);
});
test('history is bounded at 50 entries and timer settings undo keeps idle duration consistent',()=>{
 const h=new History();let d=seedDashboard();for(let i=0;i<70;i++){const a=edit(d,'entry '+i),next=applyAction(d,a);h.record({before:d,after:next},a,i*2000);d=next;}assert.equal(h.undo.length,50);
 d=seedDashboard();const w=d.widgets[2],a={type:'timerSettings',widgetId:w.id,expected:w.settings,value:{workMinutes:30,breakMinutes:6}},after=applyAction(d,a);const restored=applyPatches(after,reverse(diff(d,after)));assert.equal(restored.widgets[2].content.remainingMs,1500000);
});
test('replacement backs up first, increases revision, and detects stale previews',async()=>{
 const {state,repo}=memory(),expected=await repo.read();const next=seedDashboard();next.theme='Dark Mode';next.widgets=[];
 const replaced=await repo.replace(expected,next);assert.equal(replaced.revision,1);assert.equal(replaced.widgets.length,0);assert.deepEqual(await repo.previous(),expected);
 await assert.rejects(repo.replace(expected,next),ConflictError);assert.deepEqual(JSON.parse(state.backup.raw),expected);
 const original=JSON.parse(state.raw);state.failBackup=true;await assert.rejects(repo.replace(original,seedDashboard()));assert.deepEqual(JSON.parse(state.raw),original);
 state.failBackup=false;state.failWrite=true;await assert.rejects(repo.replace(original,seedDashboard()));assert.deepEqual(JSON.parse(state.raw),original);assert.deepEqual(JSON.parse(state.backup.raw),original);
});
test('history commits serialize with other tabs and failed writes preserve original content',async()=>{
 const {state,repo}=memory(),d=await repo.read(),change=await repo.change(edit(d,'change'));
 await repo.commit({type:'addTask',widgetId:'todo-initial',task:{id:'other',text:'other tab',completed:false}});
 await repo.history(reverse(diff(change.before,change.after)));assert.equal(JSON.parse(state.raw).widgets[0].content.tasks.at(-1).id,'other');
 state.failWrite=true;const raw=state.raw;await assert.rejects(repo.history(diff(d,change.after)));assert.equal(state.raw,raw);
});
test('portable backup validates image references, metadata, format/version/base64 and migrates bare legacy documents',()=>{
 const d=seedDashboard();assert.deepEqual(parseBackup(JSON.stringify(d)).dashboard,d);
 const base={format:'purrductivity-backup',version:1,exportedAt:'2026-10-18T00:00:00.000Z',dashboard:d,images:[]};assert.deepEqual(parseBackup(JSON.stringify(base)),base);
 for(const change of [b=>b.version=2,b=>b.extra=true,b=>b.format='other',b=>b.exportedAt='bad',b=>b.dashboard.schemaVersion=99,b=>b.images=[{}]]){const b=structuredClone(base);change(b);assert.throws(()=>parseBackup(JSON.stringify(b)));}
 const image={...cardDefaults(),id:'img',type:'image',title:'Image',position:{x:0,y:0},size:{width:300,height:300},zIndex:4,settings:{fit:'contain'},content:{assetId:'asset',caption:'Photo'}};base.dashboard.widgets.push(image);assert.throws(()=>parseBackup(JSON.stringify(base)));assert.throws(()=>parseBackup(JSON.stringify(base.dashboard)));
 const png={id:'asset',type:'image/png',width:1,height:1,data:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')};base.images=[png];assert.equal(parseBackup(JSON.stringify(base)).images.length,1);
 for(const change of [b=>b.images.push(png),b=>b.images[0].id='unreferenced',b=>b.images[0].type='image/svg+xml',b=>b.images[0].data='bad!',b=>b.images[0].width=12001,b=>b.images[0].height=0]){const b=structuredClone(base);change(b);assert.throws(()=>parseBackup(JSON.stringify(b)));}
});
