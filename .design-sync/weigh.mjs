// Measures each component module's app-source closure and which heavy runtime
// packages it reaches. Referenced from ORISO-Frontend#1155. Run from the repo root:
//   node .design-sync/weigh.mjs   -> .design-sync/.cache/weights.json

import {build} from '../.ds-sync/node_modules/esbuild/lib/main.js';
import {readFileSync,writeFileSync} from 'node:fs';
const HEAVY=['matrix-js-sdk','@matrix-org/matrix-sdk-crypto-wasm','matrix-widget-api','draft-js','markdown-draft-js','emoji-picker-react','tone','standardized-audio-context','lottie-react','lottie-web','@tiptap/core','@tiptap/react','@tiptap/starter-kit','prosemirror-view','@vector-im/compound-web','react-joyride'];
const svgStub={name:'svg-stub',setup(b){b.onLoad({filter:/\.svg$/},()=>({contents:'export const ReactComponent=()=>null;export default "";',loader:'js'}))}};
const entry=readFileSync('.design-sync/ds-entry.ts','utf8');
const mods=[...new Set([...entry.matchAll(/from '(\.[^']+)'/g)].map(m=>m[1]))];
const out={};
for(const m of mods){
  try{
    const r=await build({stdin:{contents:`export * from ${JSON.stringify(m)};`,resolveDir:'.design-sync',loader:'ts'},
      bundle:true,write:false,format:'esm',platform:'browser',target:'es2020',packages:'external',metafile:true,logLevel:'silent',plugins:[svgStub],
      resolveExtensions:['.mjs','.js','.mts','.ts','.jsx','.tsx','.json','.scss','.css','.sass'],
      loader:{'.scss':'empty','.sass':'empty','.css':'empty','.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.gif':'dataurl','.webp':'dataurl','.ico':'dataurl','.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.mp3':'dataurl','.wav':'dataurl'},
      define:{'process.env':'{}'}});
    const o=Object.values(r.metafile.outputs)[0];
    const ext=new Set();
    for(const i of o.imports||[]) if(i.external) ext.add(i.path.split('/').slice(0,i.path.startsWith('@')?2:1).join('/'));
    out[m]={bytes:o.bytes,heavy:HEAVY.filter(h=>ext.has(h)||ext.has(h.split('/')[0]))};
  }catch(e){ out[m]={error:String(e).slice(0,120)}; }
}
writeFileSync('.design-sync/.cache/weights.json',JSON.stringify(out,null,1));
const rows=Object.entries(out).filter(([,v])=>!v.error);
console.log('measured',rows.length,'of',mods.length,'modules');
const heavy=rows.filter(([,v])=>v.heavy.length);
console.log('modules pulling heavy runtime deps:',heavy.length);
console.log('\nTOP 15 BY OWN APP-SOURCE WEIGHT:');
rows.sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,15).forEach(([k,v])=>console.log(String((v.bytes/1024).toFixed(0)).padStart(6),'KB ',k.replace('./../',''),v.heavy.length?'  <- '+v.heavy.join(','):''));
