import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {seedDashboard,defaultWellbeingSettings,emptyAppearance}=require('../.test-build/state/model.js');
const {validateDashboard,migrateDashboard}=require('../.test-build/state/validation.js');
const {applyAction,ConflictError}=require('../.test-build/state/actions.js');
const {createWidget}=require('../.test-build/dashboard/layout.js');
const {diff,reverse,applyPatches}=require('../.test-build/state/history.js');
const {parseBackup,exportBackup}=require('../.test-build/persistence/backup.js');
const {Repository}=require('../.test-build/persistence/repository.js');
const {wellbeingSummary}=require('../.test-build/widgets/wellbeingSummary.js');
const view={width:1600,height:900,top:84};
const graph={nodes:[{id:'idea-a',title:'First thought',body:'Keep this text',position:{x:-20,y:50}},{id:'idea-b',title:'Next thought',body:'<b>Plain text</b>',position:{x:300,y:120}}],connections:[{id:'thread-a',from:'idea-a',to:'idea-b'}]};
function withCards(){let d=seedDashboard();for(const kind of ['scratchpad','wellbeing'])d=applyAction(d,{type:'createWidget',kind,id:`test-${kind}`,view});d.widgets.find(w=>w.type==='scratchpad').content=structuredClone(graph);return validateDashboard(d);}
function memory(raw){const state={raw,writes:0,backup:null};let queue=Promise.resolve();const adapter={read:async()=>state.raw,write:async value=>{state.raw=value;state.writes++;},backup:async value=>{state.backup={raw:value};},readBackup:async()=>state.backup,subscribe:()=>()=>{},exclusive:fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;}};return {repo:new Repository(adapter),state};}

test('v4 migration preserves every saved widget, media ID, running timer and layout without adding cards',async()=>{
 let old=applyAction(seedDashboard(),{type:'timer',widgetId:'pomodoro-initial',expected:seedDashboard().widgets[2].content,command:'start',sessionId:'live-session',timeZone:'Asia/Calcutta'},1000);
 old.widgets.push(createWidget('image','photo'));old.widgets.at(-1).content.assetId='saved-image';old.background.assetId='background-image';old.schemaVersion=4;
 const original=structuredClone(old),{repo,state}=memory(JSON.stringify(old));
 const current=await repo.load();assert.equal(current.schemaVersion,6);assert.equal(current.widgets.length,5);assert.deepEqual(current.widgets,old.widgets);assert.deepEqual(current.background,old.background);assert.deepEqual(old,original);assert.equal(current.wellbeingSettings,undefined);assert.equal(state.writes,1);await repo.load();assert.equal(state.writes,1);
});
test('future documents are retained with an update-required error, never seeded over',async()=>{
 const raw=JSON.stringify({...seedDashboard(),schemaVersion:7}),{repo,state}=memory(raw);
 await assert.rejects(repo.load(),/newer DayNest version/);assert.equal(state.raw,raw);assert.equal(state.writes,0);
});
test('both widget defaults, graph data and new type appearances validate independently',()=>{
 const d=withCards();assert.deepEqual(createWidget('scratchpad','other').content,{nodes:[],connections:[]});assert.deepEqual(d.wellbeingSettings,defaultWellbeingSettings());
 const next=applyAction(d,{type:'appearance',widgetType:'scratchpad',expected:emptyAppearance(),value:{...emptyAppearance(),borderColor:'#52725a'}});assert.equal(next.typeAppearance.scratchpad.borderColor,'#52725a');assert.deepEqual(next.widgets.find(w=>w.type==='scratchpad').content,graph);
 const legacy=structuredClone(d);legacy.schemaVersion=4;assert.throws(()=>migrateDashboard(legacy));
});
test('graph validation rejects dangling, duplicate, cyclic self, coerced and oversized graph data',()=>{
 const cases=[c=>c.connections[0].to='missing',c=>c.connections[0].to='idea-a',c=>c.connections.push({id:'reverse',from:'idea-b',to:'idea-a'}),c=>c.nodes.push(c.nodes[0]),c=>c.nodes[0].position.x=Infinity,c=>c.nodes[0].title='',c=>c.nodes[0].body=42,c=>c.nodes[0].body='x'.repeat(4001),c=>c.nodes[0].extra=true,c=>c.nodes=Array.from({length:201},(_,i)=>({...c.nodes[0],id:`node-${i}`})),c=>c.connections=Array.from({length:401},(_,i)=>({id:`edge-${i}`,from:'idea-a',to:'idea-b'}))];
 for(const change of cases){const d=withCards();change(d.widgets.find(w=>w.type==='scratchpad').content);assert.throws(()=>validateDashboard(d));}
 const d=withCards();d.widgets.find(w=>w.type==='wellbeing').content.hours=99;assert.throws(()=>validateDashboard(d));
});
test('new cards participate in creation/delete undo, backup export/import and recovery without losing graph content',async()=>{
 const before=seedDashboard(),created=applyAction(before,{type:'createWidget',kind:'wellbeing',id:'new-wellbeing',view});
 const undone=applyPatches(created,reverse(diff(before,created)));assert.deepEqual(undone.widgets,before.widgets);assert.deepEqual(undone.wellbeingSettings,defaultWellbeingSettings());
 const d=withCards(),widget=d.widgets.find(w=>w.type==='scratchpad'),deleted=applyAction(d,{type:'deleteWidget',widgetId:widget.id,expected:widget});
 const restored=applyPatches(deleted,reverse(diff(d,deleted)));assert.deepEqual(restored.widgets.find(w=>w.id===widget.id).content,graph);
 const portable=await exportBackup(d);assert.deepEqual(parseBackup(JSON.stringify(portable)).dashboard,d);
 const {repo}=memory(JSON.stringify(d));await repo.recover(JSON.stringify(d));assert.deepEqual(await repo.previous(),d);
});
test('shared wellbeing preferences are validated, conflict-safe and undoable without recording events',()=>{
 const d=withCards(),settings={...d.wellbeingSettings,retentionDays:30};const updated=applyAction(d,{type:'wellbeingSettings',expected:d.wellbeingSettings,value:settings});
 assert.deepEqual(updated.widgets,d.widgets);assert.equal(updated.wellbeingSettings.recordingEnabled,false);assert.deepEqual(applyPatches(updated,reverse(diff(d,updated))).wellbeingSettings,settings);
 assert.throws(()=>applyAction(updated,{type:'wellbeingSettings',expected:d.wellbeingSettings,value:settings}),ConflictError);
 for(const value of [{...settings,retentionDays:365},{...settings,recordingEnabled:'yes'},{...settings,startedAt:-1},{...settings,extra:true}])assert.throws(()=>applyAction(d,{type:'wellbeingSettings',expected:d.wellbeingSettings,value}));
});
test('new widget edits in separate tabs merge through the repository without touching the other card',async()=>{
 const d=withCards(),{repo,state}=memory(JSON.stringify(d));
 await Promise.all([repo.commit({type:'rename',widgetId:'test-scratchpad',expected:'Scratchpad',value:'Ideas'}),repo.commit({type:'rename',widgetId:'test-wellbeing',expected:'Wellbeing',value:'My week'})]);
 const saved=JSON.parse(state.raw);assert.equal(saved.widgets.find(w=>w.id==='test-scratchpad').title,'Ideas');assert.equal(saved.widgets.find(w=>w.id==='test-wellbeing').title,'My week');assert.deepEqual(saved.widgets.find(w=>w.type==='scratchpad').content,graph);
});
test('wellbeing summary uses only existing dated records and never fabricates hours or break totals',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),d=seedDashboard(),timer=d.widgets.find(w=>w.type==='pomodoro');
 timer.content.completedSessions=[{id:'yesterday',finishedAt:Date.parse('2026-10-19T23:30:00Z'),timeZone:'UTC'},{id:'old',finishedAt:0,timeZone:'UTC'},{id:'future',finishedAt:now+86400000,timeZone:'UTC'}];
 const habit=createWidget('habit','h');habit.content.habits=[{id:'water',name:'Water',dates:['2026-10-14','2026-10-20']}];d.widgets.push(habit);const original=structuredClone(d);
 const summary=wellbeingSummary(d,now,'Asia/Calcutta');assert.equal(summary.sessions,1);assert.equal(summary.habits,2);assert.equal(summary.days.at(-1).sessions,1);assert.equal(summary.days[0].date,'2026-10-14');assert.equal('hours' in summary,false);assert.equal('breaks' in summary,false);assert.deepEqual(d,original);
});

