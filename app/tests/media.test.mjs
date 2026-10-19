import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPRESSIONS} from '../public/expressions.js';
import {RoomAuthority,EMOTES} from '../src/room.js';

test('all four seal stickers pass the room protocol and match the picker catalog',()=>{
  let time=10000;
  const room=new RoomAuthority('Masa','Umut',crypto.randomUUID(),{now:()=>time});
  const stickers=EXPRESSIONS.filter(item=>item.sticker);
  assert.deepEqual(stickers.map(item=>item.code),['seal','seal-tongue','seal-happy','seal-cry']);
  assert.deepEqual(new Set(EXPRESSIONS.map(item=>item.code)),new Set(EMOTES));
  for(const item of stickers){const message=room.message(0,{emote:item.code});assert.equal(message.text,item.code);assert.equal(message.emote,true);time+=700;}
});

test('the complete on-demand media set stays under 110 KB and every sticker under 10 KB',async()=>{
  let bytes=0;
  for(const item of EXPRESSIONS){
    assert.match(item.file,/\.webp$/);
    const data=await readFile(new URL('../public/assets/expressions/'+item.file,import.meta.url));
    assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(data.length<(item.sticker?10000:4000),item.file+' exceeded its budget');
    bytes+=data.length;
  }
  for(const type of ['slide','place'])for(let n=1;n<=3;n++){
    const data=await readFile(new URL(`../public/assets/audio/card-${type}-${n}.mp3`,import.meta.url));
    assert.ok(data.length<12000);
    bytes+=data.length;
  }
  assert.ok(bytes<110000,'Media budget exceeded: '+bytes);
});
