import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {APPEARANCE_POLICY,TABLE_DESIGNS_APPROVED,CARD_DESIGNS_APPROVED} from '../public/release-policy.js';
import {mountAppearance} from '../public/appearance.js';
import {getDeckTheme,setDeckTheme} from '../public/card-themes.js';
import {assetFiles} from '../scripts/web-assets.mjs';

test('table and card designs require separate explicit approval before a normal release',()=>{
  assert.equal(TABLE_DESIGNS_APPROVED,false);assert.equal(CARD_DESIGNS_APPROVED,false);assert.deepEqual(APPEARANCE_POLICY,{tables:false,cards:false});
});
test('an unapproved release ignores saved theme choices, hides the picker and loads no artwork',async t=>{
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),toggle={hidden:false};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>{assert.equal(id,'appearance-toggle');return toggle;}}});
  t.after(()=>{oldDocument?Object.defineProperty(globalThis,'document',oldDocument):Reflect.deleteProperty(globalThis,'document');setDeckTheme('classic');});
  setDeckTheme('kuromi');const appearance=mountAppearance({onDeckChange:()=>assert.fail('unexpected change'),onError:()=>assert.fail('unexpected error')});
  await appearance.ensureDeck();appearance.setBusy(true);assert.equal(toggle.hidden,true);assert.equal(getDeckTheme(),'classic');
});
test('normal deployment excludes card atlases and covers while the design preview includes them',async()=>{
  const root=fileURLToPath(new URL('../public/assets/',import.meta.url));
  const normal=(await assetFiles(root,{includeCards:false})).map(f=>f.replaceAll('\\','/')),preview=(await assetFiles(root,{includeCards:true})).map(f=>f.replaceAll('\\','/'));
  assert.equal(normal.some(f=>f.startsWith('cards/')),false);assert.equal(preview.filter(f=>f.startsWith('cards/')).length,12);
  assert.ok(normal.includes('audio/card-slide-1.mp3'));assert.ok(normal.includes('expressions/seal.webp'));
});
