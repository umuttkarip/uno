import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {writeDesignGallery} from './design-gallery.mjs';
import {assetFiles} from './web-assets.mjs';
import {writeTableProposals} from './table-proposals.mjs';

const result=spawnSync(process.execPath,['scripts/build-pages.mjs'],{stdio:'inherit',env:{...process.env,UNO_DESIGN_PREVIEW:'1'}});
if(result.status!==0)process.exit(result.status??1);
await writeDesignGallery('preview');
await writeTableProposals('preview');
const output='web/test';
await mkdir(output,{recursive:true});
for(const file of ['app.js','style.css','index.html','favicon.svg','.nojekyll','desteler.html'])await copyFile(join('preview',file),join(output,file));
const html=(await readFile(join(output,'index.html'),'utf8')).replace('<title>UNO</title>','<title>UNO · Test</title>');
await writeFile(join(output,'index.html'),html);
for(const file of await assetFiles('public/assets')){const target=join(output,'assets',file);await mkdir(dirname(target),{recursive:true});await copyFile(join('preview','assets',file),target);}
console.log('Design test site: '+output+'/');
await writeTableProposals(output);
