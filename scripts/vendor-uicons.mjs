// Build-time acquisition only. The extension never contacts these URLs.
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://unpkg.com/@flaticon/flaticon-uicons@3.3.1/';
async function get(path){const r=await fetch(base+path);if(!r.ok)throw Error(`Download failed: ${r.status}`);return r;}
const css=await(await get('css/regular/rounded.css')).text();
const choices={customize:['palette','paint-brush'],pin:['thumbtack','thumbtack-angle','pin'],plus:['plus'],close:['cross-small','cross'],reset:['rotate-left','refresh'],settings:['settings'],feedback:['comment-alt','comment'],undo:['undo'],redo:['redo'],clock:['clock'],habit:['target'],timer:['stopwatch'],reminder:['bell'],notes:['document'],todo:['checkbox'],weather:['cloud'],calendar:['calendar'],image:['picture'],sticky:['note-sticky','document'],play:['play'],download:['download'],upload:['upload'],check:['check'],trash:['trash'],pencil:['pencil'],layout:['layout-fluid','layout'],pause:['pause'],left:['angle-left'],right:['angle-right'],up:['angle-up'],down:['angle-down'],arrange:['apps'],recover:['expand'],broom:['broom'],music:['music','music-alt'],external:['arrow-up-right-from-square','external-link-alt','external-link'],expand:['expand'],compress:['compress'],history:['time-past','history','clock-rotate-left'],equalizer:['settings-sliders','sliders-h','sliders'],graph:['chart-network','diagram-project','chart-simple'],sun:['sun'],snowflake:['snowflake'],rain:['cloud-rain','cloud-drizzle'],cup:['mug-hot','coffee','mug'],bars:['chart-histogram','chart-bar','bars-progress'],link:['link'],search:['search'],cursor:['cursor'],hand:['hand-pointer','hand'],lock:['lock'],more:['menu-dots-vertical','menu-dots'],location:['marker','map-marker','location-dot']};
const glyphs={};
for(const [key,names] of Object.entries(choices)){
 let match;for(const name of names){match=css.match(new RegExp('\\.fi-rr-'+name+':before\\{content:"\\\\([a-f0-9]+)"\\}'));if(match)break;}
 if(!match)throw Error('Missing icon '+key);glyphs[key]=parseInt(match[1],16);
}
const fontPath=css.match(/src:url\(\.\.\/([^)]*\.woff2)\)/)?.[1];if(!fontPath)throw Error('Missing font');
const font=await(await get('css/'+fontPath)).arrayBuffer();
const license=await(await get('LICENSE')).text();
await mkdir('src/ui/vendor',{recursive:true});await mkdir('public/licenses',{recursive:true});
await writeFile('src/ui/vendor/uicons-regular-rounded.woff2',new Uint8Array(font));
await writeFile('src/ui/vendor/uicons.ts','// Flaticon Uicons 3.3.1, regular rounded. See public/licenses/flaticon.txt.\nexport const glyphs = '+JSON.stringify(glyphs,null,2)+' as const;\n');
await writeFile('public/licenses/flaticon.txt',license);
console.log(`Bundled ${Object.keys(glyphs).length} icon mappings and one local font (${font.byteLength} bytes).`);
