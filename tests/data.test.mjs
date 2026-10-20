import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {seedDashboard,cardDefaults} = require('../.test-build/state/model.js');
const {validateDashboard,migrateDashboard,decodeDashboard} = require('../.test-build/state/validation.js');
const {applyAction,ConflictError} = require('../.test-build/state/actions.js');
const {Repository} = require('../.test-build/persistence/repository.js');
function legacySeed(){const d=seedDashboard();delete d.appearance;delete d.background;d.schemaVersion=1;for(const w of d.widgets){delete w.appearance;delete w.pinned;if(w.type==='pomodoro')w.content={phase:w.content.phase,remainingMs:w.content.remainingMs,completedSessions:w.content.completedSessions.map(r=>r.id)};if(w.type==='reminder')w.content={message:'',dueAt:null,timeZone:'UTC'};}return d;}
function memory(raw) {
 const state={raw,backup:undefined,writes:0,failWrite:false}; let queue=Promise.resolve();
 const adapter={read:async()=>state.raw,write:async value=>{if(state.failWrite)throw Error('Quota exceeded');state.raw=value;state.writes++;},backup:async value=>{state.backup=structuredClone(value);},subscribe:()=>()=>{},exclusive:fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};
 return {state,adapter};
}
test('validation rejects corrupt, duplicate, oversized and mismatched content without coercion',()=>{
 const good=seedDashboard();assert.deepEqual(validateDashboard(good),good);
 const cases=[d=>d.revision=-1,d=>d.revision=NaN,d=>d.widgets.push(d.widgets[0]),d=>d.widgets[0].content.tasks.push(d.widgets[0].content.tasks[0]),d=>d.widgets[0].content.tasks[0].completed='true',d=>d.widgets[1].content.text='x'.repeat(100001),d=>d.widgets[3].settings.color=['yellow'],d=>d.widgets[2].content.phase=['work'],d=>d.widgets[0].size.width=0,d=>d.widgets[0].type='executable',d=>d.extra='unexpected'];
 for(const change of cases){const d=structuredClone(good);change(d);assert.throws(()=>validateDashboard(d));}
 assert.throws(()=>decodeDashboard('{bad'));assert.throws(()=>validateDashboard({...good,schemaVersion:9}));
});
test('migration accepts only the defined v0 shape and does not mutate its source',()=>{
 const {revision,...old}=legacySeed();old.schemaVersion=0;
 const result=migrateDashboard(old);assert.equal(result.schemaVersion,4);assert.equal(result.revision,0);assert.equal(old.schemaVersion,0);
 assert.throws(()=>migrateDashboard({...old,extra:true}));
});
test('seed only when absent; saved empty layout remains empty',async()=>{
 const {adapter,state}=memory(undefined);const repo=new Repository(adapter);await Promise.all([repo.load(),repo.load()]);assert.equal(state.writes,1);
 const empty={...seedDashboard(),widgets:[]};state.raw=JSON.stringify(empty);assert.deepEqual(await repo.load(),empty);assert.equal(state.writes,1);
});
test('corrupt storage is retained; recovery creates a copy before replacement',async()=>{
 const {adapter,state}=memory('{invalid');const repo=new Repository(adapter);await assert.rejects(repo.load());assert.equal(state.raw,'{invalid');assert.equal(state.writes,0);
 await repo.recover('{invalid');assert.equal(state.backup,'{invalid');assert.equal(JSON.parse(state.raw).schemaVersion,4);
});
test('recovery detects concurrent changes and write failures do not destroy original data',async()=>{
 const {adapter,state}=memory('newer');const repo=new Repository(adapter);await assert.rejects(repo.recover('older'));assert.equal(state.backup,undefined);assert.equal(state.raw,'newer');
 state.failWrite=true;await assert.rejects(repo.recover('newer'));assert.equal(state.backup,'newer');assert.equal(state.raw,'newer');
});
test('simultaneous tabs serialize commits and merge independent fields',async()=>{
 const {adapter,state}=memory(JSON.stringify(seedDashboard()));const a=new Repository(adapter),b=new Repository(adapter);
 const [first,last]=await Promise.all([a.commit({type:'text',widgetId:'notes-initial',expected:seedDashboard().widgets[1].content.text,value:'From tab A'}),b.commit({type:'addTask',widgetId:'todo-initial',task:{id:'task-b',text:'From tab B',completed:false}})]);
 assert.equal(first.revision,1);assert.equal(last.revision,2);const saved=JSON.parse(state.raw);assert.equal(saved.widgets[1].content.text,'From tab A');assert.equal(saved.widgets[0].content.tasks.at(-1).text,'From tab B');
});
test('stale same-field edits and stale destructive actions cannot overwrite a newer version',async()=>{
 const {adapter,state}=memory(JSON.stringify(seedDashboard()));const a=new Repository(adapter),b=new Repository(adapter);const expected=seedDashboard().widgets[1].content.text;
 await a.commit({type:'text',widgetId:'notes-initial',expected,value:'newer'});
 await assert.rejects(b.commit({type:'text',widgetId:'notes-initial',expected,value:'stale'}),ConflictError);
 await assert.rejects(b.commit({type:'deleteWidget',widgetId:'notes-initial',expected:seedDashboard().widgets[1]}),ConflictError);
 const todo=seedDashboard().widgets[0];await a.commit({type:'addTask',widgetId:todo.id,task:{id:'new-task',text:'keep me',completed:false}});
 await assert.rejects(b.commit({type:'clearTasks',widgetId:todo.id,expected:todo.content.tasks}),ConflictError);
 assert.equal(JSON.parse(state.raw).widgets[1].content.text,'newer');
});
test('todo edits, completion, delete and widget rename retain data integrity',()=>{
 let d=seedDashboard();d=applyAction(d,{type:'editTask',widgetId:'todo-initial',taskId:'task-initial',expected:'Be happy',value:'<script>alert(1)</script>\nSecond line'});
 d=applyAction(d,{type:'toggleTask',widgetId:'todo-initial',taskId:'task-initial',expected:false,value:true});assert.equal(d.widgets[0].content.tasks[0].completed,true);
 assert.throws(()=>applyAction(d,{type:'editTask',widgetId:'todo-initial',taskId:'task-initial',expected:d.widgets[0].content.tasks[0].text,value:'  '}));
 d=applyAction(d,{type:'rename',widgetId:'notes-initial',expected:d.widgets[1].title,value:'My notes'});assert.equal(d.widgets[1].title,'My notes');
 d=applyAction(d,{type:'deleteTask',widgetId:'todo-initial',taskId:'task-initial',expected:d.widgets[0].content.tasks[0]});assert.equal(d.widgets[0].content.tasks.length,0);
});
test('image model stores asset IDs only and rejects binary/data URL content',()=>{
 const d=seedDashboard();d.widgets=[{...cardDefaults(),id:'image-one',type:'image',title:'Image',position:{x:0,y:0},size:{width:200,height:200},zIndex:0,settings:{fit:'contain'},content:{assetId:'asset-one',caption:'local image'}}];assert.deepEqual(validateDashboard(d),d);d.widgets[0].content.assetId='data:image/png;base64,AAAA';assert.throws(()=>validateDashboard(d));
});
test('failed commit keeps the previous revision and does not silently reseed missing data',async()=>{
 const raw=JSON.stringify(seedDashboard());const {adapter,state}=memory(raw);const repo=new Repository(adapter);state.failWrite=true;
 await assert.rejects(repo.commit({type:'text',widgetId:'notes-initial',expected:seedDashboard().widgets[1].content.text,value:'edit'}));assert.equal(state.raw,raw);
 state.raw=undefined;await assert.rejects(repo.commit({type:'rename',widgetId:'notes-initial',expected:'x',value:'y'}));assert.equal(state.raw,undefined);
});
test('extension adapter uses local storage and only forwards document change events',async()=>{
 const {createStorageAdapter,DOCUMENT_KEY,RECOVERY_KEY}=require('../.test-build/persistence/adapter.js');
 const originals=new Map(['location','chrome','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const values={};const handlers=new Set();const locks=[];
 try{
  Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'chrome-extension:'}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,fn)=>{locks.push(name);return fn();}}}});
  Object.defineProperty(globalThis,'chrome',{configurable:true,value:{storage:{local:{get:async key=>({[key]:values[key]}),set:async data=>{Object.assign(values,data);}},onChanged:{addListener:fn=>handlers.add(fn),removeListener:fn=>handlers.delete(fn)}}}});
  const adapter=createStorageAdapter();let updates=0;const unsubscribe=adapter.subscribe(()=>updates++);
  await adapter.exclusive(async()=>{await adapter.write('local data');assert.equal(await adapter.read(),'local data');});
  await adapter.backup('original');assert.equal(values[DOCUMENT_KEY],'local data');assert.equal(values[RECOVERY_KEY].raw,'original');assert.deepEqual(locks,['purrductivity-document']);
  for(const fn of handlers){fn({other:{}},'local');fn({[DOCUMENT_KEY]:{}},'sync');fn({[DOCUMENT_KEY]:{}},'local');}assert.equal(updates,1);unsubscribe();assert.equal(handlers.size,0);
 }finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
test('validated legacy data migrates once inside the write lock',async()=>{
 const {revision,...legacy}=legacySeed();legacy.schemaVersion=0;const {state,adapter}=memory(JSON.stringify(legacy));const repo=new Repository(adapter);
 const migrated=await repo.load();assert.equal(migrated.schemaVersion,4);assert.equal(state.writes,1);await repo.load();assert.equal(state.writes,1);
});
test('task-level independent edits merge; a stale deletion cannot remove changed content',async()=>{
 const {adapter}=memory(JSON.stringify(seedDashboard()));const repo=new Repository(adapter);const original=seedDashboard().widgets[0].content.tasks[0];
 await repo.commit({type:'editTask',widgetId:'todo-initial',taskId:original.id,expected:original.text,value:'Updated'});
 const result=await repo.commit({type:'toggleTask',widgetId:'todo-initial',taskId:original.id,expected:false,value:true});assert.deepEqual(result.widgets[0].content.tasks[0],{...original,text:'Updated',completed:true});
 await assert.rejects(repo.commit({type:'deleteTask',widgetId:'todo-initial',taskId:original.id,expected:original}),ConflictError);
});
test('legacy migration through the current schema preserves content/layout/preferences and normalizes dormant legacy timers',()=>{
 const old=legacySeed();old.zoom=.75;old.widgets[1].content.text='Keep my notes';old.widgets[2].content.remainingMs=0;old.widgets[2].content.completedSessions=['legacy-record'];
 const next=migrateDashboard(old);assert.equal(next.schemaVersion,4);assert.equal(next.zoom,.75);assert.deepEqual(next.widgets[1].position,old.widgets[1].position);assert.equal(next.widgets[1].content.text,'Keep my notes');assert.equal(next.widgets[2].content.status,'idle');assert.equal(next.widgets[2].content.remainingMs,1500000);assert.equal(next.widgets[2].content.completedSessions[0].finishedAt,0);assert.equal(old.schemaVersion,1);
});
