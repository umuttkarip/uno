import test from 'node:test';
import assert from 'node:assert/strict';
import {readStats,rememberPlayer,recordResult} from '../src/scores.js';
import {newRoom,newPlayer,startRound,view} from '../src/engine.js';
import {RoomAuthority} from '../src/room.js';
const memory=()=>{const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};};
function finished(name='Umut',winner=0){const s=newRoom('A',newPlayer(name,'a'));s.players.push(newPlayer('Sude','b'));startRound(s);s.phase='finished';s.winner=winner;return view(s,0);}

test('completed hands count once through repeated snapshots and refresh; a rematch counts again',()=>{
  const store=memory(),s=finished();assert.equal(recordResult(s,store),true);assert.equal(recordResult(structuredClone(s),store),false);
  assert.deepEqual(readStats('Umut',store),{name:'Umut',played:1,wins:1,losses:0});
  s.roundId=crypto.randomUUID();s.winner=1;assert.equal(recordResult(s,store),true);assert.deepEqual(readStats('Umut',store),{name:'Umut',played:2,wins:1,losses:1});
});
test('history belongs to the local player, crosses table names, and never restores a new table score',()=>{
  const store=memory(),s=finished('Umut',1);recordResult(s,store);assert.equal(readStats('Sude',store),null);
  s.name='B';s.roundId=crypto.randomUUID();recordResult(s,store);assert.equal(readStats('Umut',store).played,2);
  const room=new RoomAuthority('A','Umut',crypto.randomUUID());room.join('Sude',crypto.randomUUID());assert.deepEqual(room.state.players.map(p=>p.wins),[0,0]);
});
test('Turkish case, arbitrary names and separate local players remain safe and literal',()=>{
  const store=memory();for(const name of ['İ','__proto__','constructor','🐈 <3']){const s=finished(name);assert.equal(recordResult(s,store),true);assert.equal(readStats(name,store).wins,1);}
  assert.equal(readStats('i',store).name,'İ');rememberPlayer('🐈 <3',store);assert.equal(readStats('',store).name,'🐈 <3');
  const s=finished('A');recordResult(s,store);s.me=1;recordResult(s,store);assert.equal(readStats('A',store).wins,1);assert.equal(readStats('Sude',store).losses,1);
});
test('unfinished games, malformed snapshots and computer seats do not write results',()=>{
  const store=memory(),s=finished();s.phase='playing';assert.equal(recordResult(s,store),false);s.phase='finished';s.players[0].bot=true;assert.equal(recordResult(s,store),false);
  for(const invalid of [null,{}, {phase:'finished',roundId:'x',winner:0},{...s,winner:12},{...s,roundId:null}])assert.equal(recordResult(invalid,store),false);
  assert.equal(readStats('',store),null);
});
test('corrupt or unavailable browser storage does not stop the game',()=>{
  for(const payload of ['{','null','[]','{"players":true}','{"players":{"a":null}}']){const store=memory();store.setItem('uno-history-v1',payload);assert.doesNotThrow(()=>readStats('A',store));assert.doesNotThrow(()=>recordResult(finished('A'),store));}
  const store={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}};assert.equal(readStats('',store),null);assert.equal(recordResult(finished(),store),false);assert.doesNotThrow(()=>rememberPlayer('A',store));
});
