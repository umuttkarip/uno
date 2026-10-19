import {build} from 'esbuild';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('site',{recursive:true});
await build({entryPoints:['public/game.js'],bundle:true,format:'esm',target:['es2022'],outfile:'site/app.js',minify:true,legalComments:'eof'});
for(const file of ['index.html','style.css','favicon.svg'])await copyFile('public/'+file,'site/'+file);
await writeFile('site/.nojekyll','');
console.log('GitHub Pages: site/');
