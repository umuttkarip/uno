import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {APPEARANCE_POLICY,TABLE_DESIGNS_APPROVED,CARD_DESIGNS_APPROVED} from '../public/release-policy.js';
import {mountAppearance} from '../public/appearance.js';
import {getDeckTheme,setDeckTheme} from '../public/card-themes.js';
import {assetFiles} from '../scripts/web-assets.mjs';

test('the owner-approved card and table designs are enabled in the normal release',()=>{
  assert.equal(TABLE_DESIGNS_APPROVED,true);assert.equal(CARD_DESIGNS_APPROVED,true);assert.deepEqual(APPEARANCE_POLICY,{tables:true,cards:true});
});
test('the approved release exposes the picker and keeps classic green as the first-use default',async t=>{
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),elements=new Map(),body={dataset:{},classList:{toggle(){}},style:{setProperty(){},removeProperty(){}}};
  const getElementById=id=>{if(!elements.has(id))elements.set(id,{hidden:true,addEventListener(){}});return elements.get(id);};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById,body,addEventListener(){}}});
  t.after(()=>{oldDocument?Object.defineProperty(globalThis,'document',oldDocument):Reflect.deleteProperty(globalThis,'document');setDeckTheme('classic');});
  setDeckTheme('kuromi');const appearance=mountAppearance({onDeckChange:()=>assert.fail('unexpected change'),onError:()=>assert.fail('unexpected error')});
  await appearance.ensureDeck();appearance.setBusy(true);assert.equal(getElementById('appearance-toggle').hidden,false);assert.equal(body.dataset.table,'green');assert.equal(getDeckTheme(),'classic');
});
test('approved deployment includes themed media while the optional asset filter remains available',async()=>{
  const root=fileURLToPath(new URL('../public/assets/',import.meta.url));
  const normal=(await assetFiles(root,{includeCards:false,includeTables:false})).map(f=>f.replaceAll('\\','/')),preview=(await assetFiles(root,{includeCards:true,includeTables:true})).map(f=>f.replaceAll('\\','/'));
  const released=(await assetFiles(root,{includeCards:CARD_DESIGNS_APPROVED,includeTables:TABLE_DESIGNS_APPROVED})).map(f=>f.replaceAll('\\','/'));assert.deepEqual(released,preview);
  assert.equal(normal.some(f=>f.startsWith('cards/')),false);assert.equal(preview.filter(f=>f.startsWith('cards/')).length,32);
  for(const theme of ['cats','seal','kuromi','adventure','minecraft']){assert.ok(preview.includes('cards/'+theme+'-special.webp'));assert.equal(normal.includes('cards/'+theme+'-special.webp'),false);}
  assert.ok(preview.includes('cards/kuromi-c.webp'));assert.equal(normal.includes('cards/kuromi-c.webp'),false);
  for(const sheet of ['c','d']){assert.ok(preview.includes('cards/adventure-'+sheet+'.webp'));assert.equal(normal.includes('cards/adventure-'+sheet+'.webp'),false);}
  for(const file of ['minecraft-art-e.webp','minecraft-back-cover.webp']){assert.ok(preview.includes('cards/'+file));assert.equal(normal.includes('cards/'+file),false);}
  for(const sheet of ['a','b','c','d','cover']){assert.ok(preview.includes('cards/minecraft-'+sheet+'.webp'));assert.equal(normal.includes('cards/minecraft-'+sheet+'.webp'),false);assert.ok(preview.includes('cards/minecraft-art-'+sheet+'.webp'));assert.equal(normal.includes('cards/minecraft-art-'+sheet+'.webp'),false);}
  assert.ok(normal.includes('audio/card-slide-1.mp3'));assert.ok(normal.includes('expressions/seal.webp'));
  assert.equal(normal.some(f=>f.startsWith('tables/')),false);assert.equal(preview.filter(f=>f.startsWith('tables/')).length,2);
  const cardsOnly=(await assetFiles(root,{includeCards:true,includeTables:false})).map(f=>f.replaceAll('\\','/'));assert.equal(cardsOnly.some(f=>f.startsWith('tables/')),false);assert.ok(cardsOnly.includes('cards/minecraft-d.webp'));
});
