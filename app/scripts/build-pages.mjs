import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {assetFiles} from './web-assets.mjs';
import {CARD_DESIGNS_APPROVED,TABLE_DESIGNS_APPROVED} from '../public/release-policy.js';
const preview=process.env.UNO_DESIGN_PREVIEW==='1',output=preview?'preview':'web';
await mkdir(output,{recursive:true});
await build({entryPoints:['public/game.js'],bundle:true,format:'esm',target:['es2022'],outfile:join(output,'app.js'),minify:true,legalComments:'eof',define:{__UNO_DESIGN_PREVIEW__:String(preview)}});
const css=await readFile('public/style.css','utf8')+'\n'+await readFile('public/polish.css','utf8');
await writeFile(join(output,'style.css'),css);
const hash=createHash('sha256').update(await readFile(join(output,'app.js'))).update(css).digest('hex').slice(0,12);
const html=(await readFile('public/index.html','utf8')).replace('<html lang="tr">',preview?'<html lang="tr" class="design-preview">':'<html lang="tr">').replace('./app.js','./app.js?v='+hash).replace('./style.css','./style.css?v='+hash);
await writeFile(join(output,'index.html'),html);
await copyFile('public/favicon.svg',join(output,'favicon.svg'));
for(const file of await assetFiles('public/assets',{includeCards:CARD_DESIGNS_APPROVED||preview,includeTables:TABLE_DESIGNS_APPROVED||preview})){const target=join(output,'assets',file);await mkdir(dirname(target),{recursive:true});await copyFile(join('public/assets',file),target);}
await writeFile(join(output,'.nojekyll'),'');
console.log((preview?'Design preview: ':'GitHub Pages: ')+output+'/');
