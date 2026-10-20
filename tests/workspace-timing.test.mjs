import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {seedDashboard}=require('../.test-build/state/model.js');
const {applyAction,ConflictError}=require('../.test-build/state/actions.js');
const {Repository}=require('../.test-build/persistence/repository.js');
const {gestureLayout,arrangeLayout,recoveredLayout,availablePosition}=require('../.test-build/dashboard/layout.js');
const {remainingMs,reconcileDue,completedToday,localDate}=require('../.test-build/timing/time.js');
const {runBackground,ALARM_NAME}=require('../.test-build/extension/runner.js');
function memory(doc=seedDashboard()) {let raw=JSON.stringify(doc),queue=Promise.resolve();const adapter={read:async()=>raw,write:async value=>{raw=value;},backup:async()=>{},subscribe:()=>()=>{},exclusive:fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};return {repo:new Repository(adapter),raw:()=>JSON.parse(raw)};}
const timerAction=(d,command)=>({type:'timer',widgetId:'pomodoro-initial',expected:d.widgets.find(w=>w.type==='pomodoro').content,command,sessionId:'session-one',timeZone:'Asia/Calcutta'});
function running(now=Date.now()){const d=seedDashboard();return applyAction(d,timerAction(d,'start'),now);}
function apiMock({allowed=true,level='granted',fail=false}={}){const sent=[],alarms=[],clears=[];return {sent,alarms,clears,api:{permissions:{contains:async()=>allowed},notifications:{getPermissionLevel:async()=>level,create:async(id,options)=>{sent.push({id,options});if(fail)throw Error('OS rejected');return id;}},runtime:{getURL:path=>`chrome-extension://test/${path}`},alarms:{create:async(name,info)=>{alarms.push({name,...info});},clear:async name=>{clears.push(name);return true;}}}};}
test('drag coordinate conversion has no initial jump at 50, 100 and 150 percent',()=>{
 const start={position:{x:58,y:84},size:{width:356,height:486}};
 for(const zoom of [.5,1,1.5]){assert.deepEqual(gestureLayout(start,'move',0,0,zoom,'todo'),start);const next=gestureLayout(start,'move',120,60,zoom,'todo');assert.equal(next.position.x,58+120/zoom);assert.equal(next.position.y,84+60/zoom);assert.deepEqual(next.size,start.size);}
 assert.equal(start.position.x,58);
});
test('resize respects per-widget minima and zoom; movement cannot go negative',()=>{
 const start={position:{x:0,y:0},size:{width:469,height:375}};assert.deepEqual(gestureLayout(start,'resize',100,50,.5,'notes').size,{width:669,height:475});assert.deepEqual(gestureLayout(start,'resize',-999,-999,1,'notes').size,{width:320,height:260});assert.deepEqual(gestureLayout(start,'move',-10,-20,1,'notes').position,{x:0,y:0});assert.throws(()=>gestureLayout(start,'move',1,1,0,'notes'));
});
test('layout commit merges unrelated content but rejects a stale geometry change',()=>{
 let d=seedDashboard();const original=d.widgets[1];d=applyAction(d,{type:'text',widgetId:original.id,expected:original.content.text,value:'Keep this edit'});
 const action={type:'layout',widgetId:original.id,expected:{position:original.position,size:original.size},value:{position:{x:600,y:140},size:original.size}};
 d=applyAction(d,action);assert.equal(d.widgets[1].content.text,'Keep this edit');assert.throws(()=>applyAction(d,action),ConflictError);
});
test('arrange wraps without overlap, recovery restores headers, and placement stays visible',()=>{
 const d=seedDashboard(),view={width:1200,height:800,top:84};const layouts=arrangeLayout(d.widgets,view);
 for(let i=0;i<layouts.length;i++)for(let j=i+1;j<layouts.length;j++){const a=layouts[i],b=layouts[j];assert.ok(a.position.x+a.size.width<=b.position.x||b.position.x+b.size.width<=a.position.x||a.position.y+a.size.height<=b.position.y||b.position.y+b.size.height<=a.position.y);}
 const off={...d.widgets[1],position:{x:90000,y:90000}};const recovered=recoveredLayout(off,view);assert.ok(recovered.position.x<view.width&&recovered.position.y<view.height);assert.deepEqual(off.position,{x:90000,y:90000});const p=availablePosition([],{width:300,height:300},view);assert.ok(p.x>=0&&p.y>=84&&p.x+300<view.width&&p.y+300<view.height);
});
test('new core widgets get independent IDs, defaults and visible positions',()=>{
 let d=seedDashboard();for(const kind of ['todo','notes','sticky','pomodoro','reminder'])d=applyAction(d,{type:'createWidget',kind,id:`new-${kind}`,view:{width:1800,height:900,top:84}});assert.equal(d.widgets.length,9);assert.equal(new Set(d.widgets.map(w=>w.id)).size,9);assert.ok(d.widgets.slice(4).every(w=>w.position.x<1800&&w.position.y<900));
});
test('pause/resume uses timestamps and preserves remaining time; reset keeps completion history',()=>{
 let d=running(1000);let t=d.widgets[2].content;assert.equal(t.deadline,1501000);assert.equal(remainingMs(t,11000),1490000);
 d=applyAction(d,timerAction(d,'pause'),11000);t=d.widgets[2].content;assert.equal(t.status,'paused');assert.equal(remainingMs(t,999999),1490000);assert.equal(t.deadline,null);
 d=applyAction(d,timerAction(d,'resume'),20000);assert.equal(d.widgets[2].content.deadline,1510000);
 d=applyAction(d,timerAction(d,'reset'),21000);assert.equal(d.widgets[2].content.status,'idle');assert.equal(d.widgets[2].content.remainingMs,1500000);
});
test('late completion is recorded once at its deadline, not at wake time',()=>{
 const d=running(1000);assert.equal(reconcileDue(d,1501000+86400000),true);const t=d.widgets[2].content;assert.equal(t.status,'finished');assert.equal(t.completedSessions.length,1);assert.equal(t.completedSessions[0].finishedAt,1501000);assert.equal(reconcileDue(d,1501000+172800000),false);assert.equal(t.completedSessions.length,1);
});
test('break completion does not add a work record; daily totals use local calendar dates',()=>{
 let d=running(1000);reconcileDue(d,1501000);d=applyAction(d,timerAction(d,'next'),1501001);assert.equal(d.widgets[2].content.phase,'break');reconcileDue(d,999999999);assert.equal(d.widgets[2].content.completedSessions.length,1);
 const t=d.widgets[2].content;t.completedSessions=[{id:'before-midnight',finishedAt:Date.parse('2026-10-17T18:29:00Z'),timeZone:'Asia/Calcutta'},{id:'after-midnight',finishedAt:Date.parse('2026-10-17T18:31:00Z'),timeZone:'Asia/Calcutta'}];assert.equal(localDate(Date.parse('2026-10-17T18:31:00Z'),'Asia/Calcutta'),'2026-10-18');assert.equal(completedToday(t,Date.parse('2026-10-17T19:00:00Z'),'Asia/Calcutta'),1);
});
test('two background deliveries complete one session and send one notification',async()=>{
 const base=Date.now()-2000000;const {repo,raw}=memory(running(base));const mock=apiMock();await Promise.all([runBackground(repo,mock.api),runBackground(repo,mock.api)]);assert.equal(raw().widgets[2].content.completedSessions.length,1);assert.equal(raw().widgets[2].content.delivery,'delivered');assert.equal(mock.sent.length,1);await runBackground(repo,mock.api);assert.equal(mock.sent.length,1);
});
test('notification permission absence, OS denial and delivery errors do not stop completion',async()=>{
 for(const options of [{allowed:false},{level:'denied'},{fail:true}]){const {repo,raw}=memory(running(Date.now()-2000000));const mock=apiMock(options);await runBackground(repo,mock.api);assert.equal(raw().widgets[2].content.status,'finished');assert.equal(raw().widgets[2].content.completedSessions.length,1);assert.equal(raw().widgets[2].content.delivery,options.fail?'failed':'unavailable');await runBackground(repo,mock.api);assert.equal(mock.sent.length,options.fail?1:0);}
});
test('a persisted interrupted notification claim is not retried',async()=>{
 const {repo,raw}=memory(running(Date.now()-2000000));await repo.reconcile(Date.now());await repo.claimEvent('timer:pomodoro-initial:session-one',Date.now());const mock=apiMock();await runBackground(repo,mock.api);assert.equal(mock.sent.length,0);assert.equal(raw().widgets[2].content.delivery,'claimed');
});
test('future deadlines schedule one alarm; overdue reminders are delivered once',async()=>{
 const now=Date.now();let d=applyAction(seedDashboard(),{type:'createWidget',kind:'reminder',id:'reminders',view:{width:1600,height:900}});const reminder={id:'r-one',eventId:'event-one',message:'Remember the cat',dueAt:now+60000,timeZone:'Asia/Calcutta',delivery:'pending'};
 d=applyAction(d,{type:'upsertReminder',widgetId:'reminders',expected:null,value:reminder});const {repo,raw}=memory(d);const mock=apiMock();await runBackground(repo,mock.api,now);assert.equal(mock.alarms.at(-1).name,ALARM_NAME);assert.equal(mock.alarms.at(-1).when,now+60000);
 await runBackground(repo,mock.api,now+60001);await runBackground(repo,mock.api,now+60002);assert.equal(mock.sent.length,1);assert.equal(raw().widgets.find(w=>w.id==='reminders').content.reminders[0].delivery,'delivered');
});
test('a fresh installation with no dashboard quietly clears its alarm without seeding',async()=>{
 let queue=Promise.resolve();const adapter={read:async()=>undefined,write:async()=>{throw Error('Must not seed');},backup:async()=>{},subscribe:()=>()=>{},exclusive:fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};const mock=apiMock();await runBackground(new Repository(adapter),mock.api);assert.deepEqual(mock.clears,[ALARM_NAME]);
});

test('invalid saved data pauses background alarms without writes, claims or notifications; valid updates resume',async()=>{
 let raw=JSON.stringify({...seedDashboard(),background:{assetId:null,fit:'cover',dim:'invalid'}});
 const original=raw;let writes=0;
 const adapter={read:async()=>raw,write:async value=>{writes++;raw=value;},backup:async()=>{throw Error('Must not replace recovery data');},subscribe:()=>()=>{},exclusive:fn=>fn()};
 const repo=new Repository(adapter),mock=apiMock();
 await runBackground(repo,mock.api);await runBackground(repo,mock.api);
 assert.equal(raw,original);assert.equal(writes,0);assert.equal(mock.sent.length,0);assert.equal(mock.alarms.length,0);assert.deepEqual(mock.clears,[ALARM_NAME,ALARM_NAME]);
 const now=Date.now();raw=JSON.stringify(running(now));
 await runBackground(repo,mock.api,now);
 assert.equal(mock.alarms.length,1);assert.equal(mock.alarms[0].name,ALARM_NAME);
});

test('background storage failures still surface instead of being mistaken for invalid data',async()=>{
 const mock=apiMock();const failure=Error('Storage unavailable');
 await assert.rejects(runBackground({reconcile:async()=>{throw failure;}},mock.api),error=>error===failure);
 assert.equal(mock.clears.length,0);
});
test('a reminder with notifications disabled is reconciled without an OS alert',async()=>{
 let d=applyAction(seedDashboard(),{type:'createWidget',kind:'reminder',id:'quiet',view:{width:1600,height:900}});d.widgets.find(w=>w.id==='quiet').settings.notify=false;d=applyAction(d,{type:'upsertReminder',widgetId:'quiet',expected:null,value:{id:'quiet-reminder',eventId:'quiet-event',message:'In-app only',dueAt:0,timeZone:'UTC',delivery:'pending'}});const {repo,raw}=memory(d);const mock=apiMock();await runBackground(repo,mock.api);assert.equal(mock.sent.length,0);assert.equal(raw().widgets.find(w=>w.id==='quiet').content.reminders[0].delivery,'unavailable');
});
