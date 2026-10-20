import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {DESIGN_PREVIEW,storageKey,TABLE_PEER_PREFIX} from '../src/environment.js';
import {recordResult,readStats} from '../src/scores.js';

test('normal release keeps history and preferences while fast games use v9 peer addresses',()=>{
  assert.equal(DESIGN_PREVIEW,false);assert.equal(TABLE_PEER_PREFIX,'umut-uno-v9-');
  for(const key of ['uno-solo-v1','uno-v9:masa','uno-look-v1','uno-history-v1'])assert.equal(storageKey(key),key);
});
test('the compiled design test cannot share saved games, history, preferences or rooms with production',async()=>{
  const built=await build({stdin:{contents:"export * from './src/environment.js';export * from './src/scores.js';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false,define:{__UNO_DESIGN_PREVIEW__:'true'}});
  const preview=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  assert.equal(preview.DESIGN_PREVIEW,true);assert.notEqual(preview.TABLE_PEER_PREFIX,TABLE_PEER_PREFIX);
  for(const key of ['uno-solo-v1','uno-v7:masa','uno-look-v1','uno-history-v1'])assert.notEqual(preview.storageKey(key),storageKey(key));
  const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
  const result={phase:'finished',roundId:'shared-example',winner:0,me:0,players:[{name:'A'},{name:'B'}]};
  recordResult(result,storage);preview.recordResult({...result,winner:1},storage);
  assert.deepEqual(readStats('A',storage),{name:'A',played:1,wins:1,losses:0});
  assert.deepEqual(preview.readStats('A',storage),{name:'A',played:1,wins:0,losses:1});
});
