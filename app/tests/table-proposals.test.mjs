import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PROPOSAL_THEMES} from '../scripts/table-proposals.mjs';
import {assetFiles} from '../scripts/web-assets.mjs';
import {THEMED_TABLES,DECK_TABLES} from '../public/table-backgrounds.js';
import {TABLES} from '../public/appearance.js';
import {APPEARANCE_POLICY} from '../public/release-policy.js';

test('theme backgrounds share responsive assets while main design approval gates stay closed',async()=>{
  assert.deepEqual(PROPOSAL_THEMES,['cats','seal','kuromi','adventure','minecraft']);
  assert.deepEqual(TABLES.map(t=>t.id),['green','wine','navy','charcoal','mauve','rose',...PROPOSAL_THEMES]);assert.deepEqual(APPEARANCE_POLICY,{tables:false,cards:false});
  const gameAssets=await assetFiles(new URL('../public/assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
  assert.equal(gameAssets.some(file=>file.includes('design-proposals')||file.includes('backgrounds')),false);
  assert.equal(DECK_TABLES.classic,'green');for(const theme of THEMED_TABLES){assert.equal(DECK_TABLES[theme.id],theme.id);assert.notEqual(theme.wide,theme.portrait);for(const file of [theme.wide,theme.portrait]){const data=await readFile(new URL('../design-proposals/backgrounds/'+file,import.meta.url));assert.equal(data.toString('ascii',8,12),'WEBP');}}
});
