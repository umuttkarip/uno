import {readdir} from 'node:fs/promises';
import {join,extname} from 'node:path';

export async function assetFiles(root,{includeCards=true,includeTables=true}={},prefix=''){
  const files=[];
  for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
    const relative=join(prefix,entry.name);
    if(entry.isDirectory()){if(!prefix&&(entry.name==='cards'&&!includeCards||entry.name==='tables'&&!includeTables))continue;files.push(...await assetFiles(root,{includeCards,includeTables},relative));}
    else if(entry.isFile()&&['.webp','.mp3','.txt','.md'].includes(extname(entry.name).toLowerCase()))files.push(relative);
  }
  return files;
}
