import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {assetFiles} from './web-assets.mjs';
const output='web';
await mkdir(output,{recursive:true});
await build({entryPoints:['public/game.js'],bundle:true,format:'esm',target:['es2022'],outfile:join(output,'app.js'),minify:true,legalComments:'eof'});
const css=await readFile('public/style.css','utf8')+'\n'+await readFile('public/polish.css','utf8');
await writeFile(join(output,'style.css'),css);
const hash=createHash('sha256').update(await readFile(join(output,'app.js'))).update(css).digest('hex').slice(0,12);
const html=(await readFile('public/index.html','utf8')).replace('./app.js','./app.js?v='+hash).replace('./style.css','./style.css?v='+hash);
await writeFile(join(output,'index.html'),html);
await copyFile('public/favicon.svg',join(output,'favicon.svg'));
for(const file of await assetFiles('public/assets')){const target=join(output,'assets',file);await mkdir(dirname(target),{recursive:true});await copyFile(join('public/assets',file),target);}
await writeFile(join(output,'.nojekyll'),'');
console.log('GitHub Pages: '+output+'/');
