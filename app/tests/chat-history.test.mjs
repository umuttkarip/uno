import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatHistory,CHAT_LIMIT,chatHistoryKey} from '../src/chat-history.js';
import {RoomAuthority} from '../src/room.js';
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('room chat survives local reload and leave, deduplicates sync, and stays isolated by room and player',()=>{
  const storage=memory(),history=new ChatHistory('Masa','Umut',storage),message={id:'a',name:'Sude',text:'<b>merhaba</b>',at:100,emote:false};
  history.merge([message,message]);const restored=new ChatHistory(' masa ','Umut',storage);assert.deepEqual(restored.items,[{...message,system:false}]);assert.deepEqual(restored.merge([message]),[]);
  assert.deepEqual(new ChatHistory('Başka','Umut',storage).items,[]);assert.deepEqual(new ChatHistory('Masa','Sude',storage).items,[]);
  assert.notEqual(chatHistoryKey('Masa','A'),chatHistoryKey('Masa','B'));
});
test('chat sorts delayed history, bounds storage and continues in memory when storage is unavailable',()=>{
  const history=new ChatHistory('Masa','A',{getItem(){throw Error('blocked');},setItem(){throw Error('full');}});
  history.merge(Array.from({length:CHAT_LIMIT+2},(_,i)=>({id:String(i),name:'A',text:'x',at:i})).reverse());
  assert.equal(history.items.length,CHAT_LIMIT);assert.equal(history.items[0].at,2);assert.equal(history.ids.size,CHAT_LIMIT);
  assert.deepEqual(history.merge([null,{id:'bad'},history.items[0]]),[]);
});
test('authority chat checkpoint restores text, sticker and named departure events outside the card state',()=>{
  let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{mode:'group',now:()=>now});room.join('B',crypto.randomUUID());room.join('C',crypto.randomUUID());
  room.message(0,{text:'merhaba'});now+=700;room.message(0,{emote:'bmo-cheer'});room.leave(1);
  const saved=structuredClone(room.checkpoint()),restored=new RoomAuthority('Masa','A',room.state.players[0].token,{saved,now:()=>now});
  assert.equal(restored.messages.length,3);assert.equal(restored.messages[1].text,'bmo-cheer');assert.equal(restored.messages[2].text,'B masadan ayrıldı.');assert.equal(restored.state.messages,undefined);
});
