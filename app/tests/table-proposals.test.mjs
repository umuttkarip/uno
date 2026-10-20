import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PROPOSAL_THEMES} from '../scripts/table-proposals.mjs';
import {assetFiles} from '../scripts/web-assets.mjs';
import {TABLES} from '../public/appearance.js';
import {APPEARANCE_POLICY} from '../public/release-policy.js';

test('background proposals are separate review files and never become game choices without approval',async()=>{
  assert.deepEqual(PROPOSAL_THEMES,['cats','seal','kuromi','adventure','minecraft']);
  assert.deepEqual(TABLES.map(t=>t.id),['green','wine','navy','charcoal','mauve','rose','minecraft']);assert.deepEqual(APPEARANCE_POLICY,{tables:false,cards:false});
  const gameAssets=await assetFiles(new URL('../public/assets/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
  assert.equal(gameAssets.some(file=>file.includes('design-proposals')||file.includes('backgrounds')),false);
  for(const theme of PROPOSAL_THEMES){const data=await readFile(new URL('../design-proposals/backgrounds/'+theme+'.webp',import.meta.url));assert.equal(data.toString('ascii',8,12),'WEBP');}
});
