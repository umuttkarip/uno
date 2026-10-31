import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatHistory,CHAT_LIMIT,chatHistoryKey} from '../src/chat-history.js';
import {RoomAuthority} from '../src/room.js';
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('chat reload requires the same room instance and secret participant token, never a matching display name',()=>{
  const storage=memory(),history=new ChatHistory(storage),message={id:'a',name:'Sude',text:'<b>merhaba</b>',at:100,emote:false};history.bind('instance-1','private-token');
  history.merge([message,message]);const restored=new ChatHistory(storage);restored.bind('instance-1','private-token');assert.deepEqual(restored.items,[{...message,system:false}]);assert.deepEqual(restored.merge([message]),[]);
  const outsider=new ChatHistory(storage);outsider.bind('instance-1','new-token');assert.deepEqual(outsider.items,[]);
  restored.bind('instance-2','private-token');assert.deepEqual(restored.items,[]);assert.notEqual(chatHistoryKey('instance-1','A'),chatHistoryKey('instance-1','B'));
});
test('room closure clears its local messages and legacy name-based archives are never opened',()=>{
  const storage=memory();storage.setItem('uno-chat-v1:["masa","umut"]',JSON.stringify([{id:'old',name:'Umut',text:'private',at:1}]));
  const history=new ChatHistory(storage);history.bind('room','token');assert.deepEqual(history.items,[]);history.merge([{id:'one',name:'Umut',text:'hello',at:1}]);
  const key=history.key;history.clear();assert.equal(storage.getItem(key),null);assert.deepEqual(history.items,[]);history.bind('room','token');assert.deepEqual(history.items,[]);
});
test('chat sorts delayed history, bounds storage and continues in memory when storage is unavailable',()=>{
  const history=new ChatHistory({getItem(){throw Error('blocked');},setItem(){throw Error('full');}});history.bind('room','token');
  history.merge(Array.from({length:CHAT_LIMIT+2},(_,i)=>({id:String(i),name:'A',text:'x',at:i})).reverse());
  assert.equal(history.items.length,CHAT_LIMIT);assert.equal(history.items[0].at,2);assert.equal(history.ids.size,CHAT_LIMIT);
  assert.deepEqual(history.merge([null,{id:'bad'},history.items[0]]),[]);
});
test('authority chat checkpoint restores text, sticker and named departure events outside the card state',()=>{
  let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{mode:'group',now:()=>now});room.join('B',crypto.randomUUID());room.join('C',crypto.randomUUID());
  room.message(0,{text:'merhaba'});now+=700;room.message(0,{emote:'bmo-cheer'});room.leave(1);
  const saved=structuredClone(room.checkpoint()),restored=new RoomAuthority('Masa','A',room.state.players[0].token,{saved,now:()=>now});
  assert.equal(restored.messages.length,3);assert.equal(restored.messages[1].text,'bmo-cheer');assert.equal(restored.messages[2].text,'B masadan ayrıldı.');assert.equal(restored.state.messages,undefined);
  assert.equal(restored.chatId,room.chatId);assert.notEqual(new RoomAuthority('Masa','A',crypto.randomUUID()).chatId,room.chatId);
});
test('a fresh lobby participant never receives conversation from before their arrival, while reconnecting preserves the current shared history',()=>{
  let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{mode:'group',now:()=>now}),b=crypto.randomUUID();room.join('B',b);
  const old=room.message(0,{text:'A ile B arasında'});assert.equal(room.messages.length,1);const id=room.chatId;room.join('C',crypto.randomUUID());assert.deepEqual(room.messages,[]);assert.equal(room.chatId,id);
  now+=700;room.message(0,{text:'Herkese merhaba'});room.join('B',b);assert.equal(room.messages.length,1);assert.equal(room.messages.some(m=>m.id===old.id),false);
});
