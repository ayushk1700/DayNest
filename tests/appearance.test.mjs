import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {seedDashboard,emptyAppearance}=require('../.test-build/state/model.js');
const {validateDashboard,migrateDashboard,decodeDashboard}=require('../.test-build/state/validation.js');
const {applyAction,ConflictError}=require('../.test-build/state/actions.js');
const {diff,reverse,applyPatches}=require('../.test-build/state/history.js');
const {cardVariables,effectiveAppearance,contrast}=require('../.test-build/ui/cardAppearance.js');
const {parseBackup}=require('../.test-build/persistence/backup.js');
const globalStyle={...emptyAppearance(),borderColor:'#9976c2',backgroundColor:'#f4edff',corners:'soft',borderWidth:'medium',shadow:'lifted'};
const layouts=d=>d.widgets.map(w=>({id:w.id,layout:{position:w.position,size:w.size}}));
test('v2 migration adds independent appearance/pin defaults without changing existing content or layout',()=>{
 const d=seedDashboard();d.schemaVersion=2;delete d.appearance;delete d.background;for(const w of d.widgets){delete w.appearance;delete w.pinned;}
 d.zoom=.75;d.widgets[1].content.text='Saved before customization';const raw=JSON.stringify(d),next=decodeDashboard(raw);
 assert.equal(next.schemaVersion,8);assert.equal(next.zoom,.75);assert.equal(next.widgets[1].content.text,d.widgets[1].content.text);assert.deepEqual(next.widgets[1].position,d.widgets[1].position);assert.deepEqual(next.appearance,emptyAppearance());assert.equal(next.widgets[1].pinned,false);assert.equal(JSON.stringify(d),raw);
 next.widgets[0].appearance.borderColor='#123456';assert.equal(next.widgets[1].appearance.borderColor,null);assert.equal(next.appearance.borderColor,null);
});
test('appearance validation rejects CSS injection, unknown fields, coerced enums and malformed pin state',()=>{
 for(const change of [d=>d.appearance.backgroundColor='url(https://example.com)',d=>d.appearance.borderColor='red',d=>d.appearance.corners=['soft'],d=>d.appearance.borderWidth=4,d=>d.appearance.shadow='glow',d=>d.widgets[0].pinned='true',d=>d.widgets[1].appearance.extra=true,d=>delete d.widgets[0].pinned]){const d=seedDashboard();change(d);assert.throws(()=>validateDashboard(d));}
});
test('global defaults and individual overrides merge per field, save independently and reject stale edits',()=>{
 let d=seedDashboard();d=applyAction(d,{type:'appearance',expected:d.appearance,value:globalStyle});
 const local={...emptyAppearance(),borderColor:'#a33c55'};d=applyAction(d,{type:'appearance',widgetId:'notes-initial',expected:d.widgets[1].appearance,value:local});
 const merged=effectiveAppearance(d.appearance,d.widgets[1].appearance);assert.equal(merged.borderColor,'#a33c55');assert.equal(merged.backgroundColor,'#f4edff');assert.equal(merged.corners,'soft');assert.equal(d.widgets[0].appearance.borderColor,null);
 assert.throws(()=>applyAction(d,{type:'appearance',widgetId:'notes-initial',expected:emptyAppearance(),value:emptyAppearance()}),ConflictError);
 const reset=applyAction(d,{type:'appearance',widgetId:'notes-initial',expected:local,value:emptyAppearance()});assert.deepEqual(effectiveAppearance(reset.appearance,reset.widgets[1].appearance),globalStyle);
});
test('pin blocks persisted moves/resizes and arrangement/recovery keeps pinned geometry',()=>{
 let d=seedDashboard();const before=structuredClone(d.widgets[0]);d=applyAction(d,{type:'pin',widgetId:before.id,expected:false,value:true});
 assert.throws(()=>applyAction(d,{type:'layout',widgetId:before.id,expected:{position:before.position,size:before.size},value:{position:{x:500,y:500},size:before.size}}),ConflictError);
 assert.throws(()=>applyAction(d,{type:'nudge',widgetId:before.id,dx:50,dy:0,resize:false}),ConflictError);
 d=applyAction(d,{type:'arrange',expected:layouts(d),view:{width:1200,height:900}});assert.deepEqual(d.widgets[0].position,before.position);assert.deepEqual(d.widgets[0].size,before.size);
 for(const w of d.widgets.slice(1)){assert.ok(!(w.position.x<before.position.x+before.size.width&&w.position.x+w.size.width>before.position.x&&w.position.y<before.position.y+before.size.height&&w.position.y+w.size.height>before.position.y),'Arrange overlapped a pin');}
 d.widgets[0].position={x:9000,y:9000};d=applyAction(d,{type:'recoverLayout',view:{width:1200,height:900}});assert.deepEqual(d.widgets[0].position,{x:9000,y:9000});d=applyAction(d,{type:'pin',widgetId:before.id,expected:true,value:false});d=applyAction(d,{type:'recoverLayout',view:{width:1200,height:900}});assert.ok(d.widgets[0].position.x<1200);
});
test('styles and pins are undoable, portable and cannot let old geometry history move a new pin',()=>{
 const before=seedDashboard();let styled=applyAction(before,{type:'appearance',expected:before.appearance,value:globalStyle});styled=applyAction(styled,{type:'pin',widgetId:'notes-initial',expected:false,value:true});
 const restored=applyPatches(styled,reverse(diff(before,styled)));assert.deepEqual(restored.appearance,before.appearance);assert.equal(restored.widgets[1].pinned,false);
 assert.deepEqual(parseBackup(JSON.stringify(styled)).dashboard,styled);
 let moved=applyAction(before,{type:'nudge',widgetId:'notes-initial',dx:50,dy:0,resize:false});const patches=diff(before,moved);moved=applyAction(moved,{type:'pin',widgetId:'notes-initial',expected:false,value:true});assert.throws(()=>applyPatches(moved,reverse(patches)),ConflictError);
});
test('custom backgrounds choose readable foreground, muted, accent and primary colors across the RGB grid',()=>{
 for(let r=0;r<=255;r+=51)for(let g=0;g<=255;g+=51)for(let b=0;b<=255;b+=51){const bg='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');const vars=cardVariables({...emptyAppearance(),backgroundColor:bg});for(const key of ['--card-text','--card-muted','--card-accent'])assert.ok(contrast(bg,vars[key])>=4.5,`${bg} ${key}`);assert.ok(contrast(vars['--card-accent'],vars['--card-on-accent'])>=4.5);}
});

