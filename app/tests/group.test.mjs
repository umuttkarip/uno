import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {RoomAuthority} from '../src/room.js';
import {newRoom,newPlayer,startRound,act,view,nextPlayer} from '../src/engine.js';
import {botCommand} from '../src/bot.js';
import {seating} from '../public/table-motion-multi.js';
import {controls,chosenColor,feedback} from '../public/table-state.js';
import {assetFiles} from '../scripts/web-assets.mjs';
import {EXPRESSIONS} from '../public/expressions.js';

const card=(color,value)=>({id:crypto.randomUUID(),color,value});
function group(n){const room=new RoomAuthority('Grup','A',crypto.randomUUID(),{mode:'group'});for(let i=1;i<n;i++)room.join(String.fromCharCode(65+i),crypto.randomUUID());return room;}
function playing(n){const room=group(n);if(room.state.phase==='waiting'){const revision=room.revision;for(let i=0;i<n;i++)room.play(i,{type:'ready',round:0},revision);}return room;}

for(let n=2;n<=6;n++)test(`${n} group players start only when all are ready, including concurrent approvals`,()=>{
  const room=group(n),revision=room.revision;assert.equal(room.state.capacity,6);assert.equal(room.state.phase,'waiting');
  for(let i=0;i<n;i++){room.play(i,{type:'ready',round:0},revision);assert.equal(room.state.phase,i===n-1?'playing':'waiting');}
  assert.deepEqual(room.state.players.map(p=>p.hand.length),Array(n).fill(7));assert.equal(room.state.deck.length,107-7*n);
  for(let me=0;me<n;me++){const snapshot=room.snapshot(me);assert.equal(snapshot.state.players.filter(p=>p.hand).length,1);assert.equal(snapshot.state.players[me].hand.length,7);}
});

test('a full lobby still needs ready approvals, one player cannot start, and a live hand cannot gain a new seat',()=>{
  const alone=group(1);alone.play(0,{type:'ready',round:0},alone.revision);assert.equal(alone.state.phase,'waiting');assert.throws(()=>alone.play(0,{type:'start'},alone.revision));
  const full=group(6);assert.equal(full.state.phase,'waiting');assert.deepEqual(full.state.players.map(p=>p.hand.length),Array(6).fill(0));assert.throws(()=>full.join('G',crypto.randomUUID()));
  const started=playing(3);assert.throws(()=>started.join('D',crypto.randomUUID()),/oyun başladı/);
  const player=started.state.players[1];assert.equal(started.join(player.name,player.token),1);
});

test('lobby reload preserves ready approvals and the next participant can start the same group',()=>{
  const room=group(2),token=room.state.players[0].token;room.play(0,{type:'ready',round:0},room.revision);
  const restored=new RoomAuthority('Grup','A',token,{saved:structuredClone(room.checkpoint())});restored.join('C',crypto.randomUUID());
  assert.equal(restored.state.players[0].ready,true);assert.equal(restored.state.phase,'waiting');const revision=restored.revision;
  restored.play(1,{type:'ready',round:0},revision);assert.equal(restored.state.phase,'waiting');restored.play(2,{type:'ready',round:0},revision);assert.equal(restored.state.phase,'playing');
});

test('a delayed ready command from an older hand is rejected even with a current revision',()=>{
  const room=playing(3);room.state.phase='finished';const before=structuredClone(room.state);assert.throws(()=>room.play(0,{type:'ready',round:0},room.revision));assert.deepEqual(room.state,before);
});

for(let n=2;n<=6;n++)test(`relative seating is unique and turn routing works with ${n} players`,()=>{
  const room=playing(n),s=room.state;
  for(let me=0;me<n;me++){const seats=seating(view(s,me));assert.equal(seats.length,n-1);assert.equal(new Set(seats.map(p=>p.seat)).size,n-1);assert.deepEqual(new Set(seats.map(p=>p.index)),new Set(s.players.map((p,i)=>i).filter(i=>i!==me)));}
  s.pile=[card('red','7')];s.color='red';const reverse=card('red','reverse');s.players[0].hand=[reverse,card('blue','9')];act(s,0,{type:'play',cardId:reverse.id,uno:true});assert.equal(s.direction,-1);assert.equal(s.turn,n===2?0:n-1);
  assert.equal(nextPlayer(s,n-1),n-2);
});

test('six players accumulate a penalty in order and unanimous rematches keep the win count',()=>{
  const room=playing(6),s=room.state;s.pile=[card('red','7')];s.color='red';
  for(let i=0;i<5;i++){const c=card(i%2?'wild':'red',i%2?'wild4':'draw2');if(i>1)c.value='wild4',c.color='wild';s.players[i].hand=[c];act(s,i,{type:'play',cardId:c.id,color:'green'});}
  assert.equal(s.pendingDraw.count,18);assert.equal(s.turn,5);const count=s.players[5].hand.length;act(s,5,{type:'draw'});assert.equal(s.players[5].hand.length,count+18);assert.equal(s.winner,0);assert.equal(s.players[0].wins,1);
  const round=s.round,revision=room.revision;for(let i=0;i<6;i++)room.play(i,{type:'ready',round},revision);assert.equal(s.round,round+1);assert.equal(s.players[0].wins,1);assert.equal(s.turn,1);
});

test('150 complete three-, five- and six-player games conserve every card and finish',()=>{
  for(const n of [3,5,6])for(let g=0;g<50;g++){
    const s=newRoom('Grup',newPlayer('A','a'),{mode:'group'});for(let i=1;i<n;i++)s.players.push(newPlayer('P'+i,'token'+i));startRound(s);
    let steps=0;while(s.phase==='playing'&&steps++<10000){act(s,s.turn,botCommand(view(s,s.turn),s.turn));const cards=[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);}
    assert.equal(s.phase,'finished');assert.equal(s.players[s.winner].hand.length,0);
  }
});

test('every playable special draw can be passed and the deck becomes a pass control instead of forcing play',()=>{
  for(const value of ['wild','wild4','reverse','skip','draw2']){
    const room=playing(2),s=room.state;s.pile=[card('red','7')];s.color='red';const drawn=card(value.startsWith('wild')?'wild':'red',value);s.deck.push(drawn);s.players[0].hand=[card('wild','wild4'),card('blue','3')];
    act(s,0,{type:'draw'});const snapshot=view(s,0),ui=controls(snapshot);assert.equal(s.drawnId,drawn.id);assert.equal(ui.canDraw,true);assert.equal(ui.drawCommand,'pass');assert.equal(ui.showPass,true);assert.equal(ui.drawLabel,'Pas geç');
    assert.deepEqual(snapshot.playable,[drawn.id]);act(s,0,{type:ui.drawCommand});assert.equal(s.turn,1);assert.equal(s.players[0].hand.length,3);assert.equal(s.pendingDraw,null);
  }
});

test('UNO is enabled only at one card and its declaration is visible to every opponent without replay on refresh',()=>{
  const room=playing(6),s=room.state;s.pile=[card('red','7')];s.color='red';const played=card('red','3');s.players[0].hand=[played,card('blue','9')];
  assert.equal(controls(view(s,0)).canUno,false);assert.throws(()=>act(s,0,{type:'uno'}));act(s,0,{type:'play',cardId:played.id});
  const previous=s.players.map((p,i)=>structuredClone(view(s,i)));assert.equal(controls(previous[0]).canUno,true);act(s,0,{type:'uno'});
  for(let me=0;me<6;me++){const next=view(s,me),events=feedback(previous[me],next);assert.equal(next.players[0].uno,true);assert.deepEqual(events,[{player:0,text:'UNO',uno:true}]);assert.deepEqual(feedback(next,structuredClone(next)),[]);assert.deepEqual(feedback(null,next),[]);}
  assert.equal(controls(view(s,0)).canUno,false);
});

test('UNO penalties produce a chat notice only for the affected player',()=>{
  const room=playing(6),s=room.state;s.pile=[card('red','7')];s.color='red';const played=card('red','3');s.players[0].hand=[played,card('blue','9')];act(s,0,{type:'play',cardId:played.id});const previous=s.players.map((p,i)=>structuredClone(view(s,i)));act(s,1,{type:'draw'});
  for(let me=0;me<6;me++){const events=feedback(previous[me],view(s,me));assert.equal(events.length,me===0?1:0);if(me===0)assert.equal(events[0].private,true);}
});

test('chosen joker colors stay explicit for both wild types and normal cards need no extra label',()=>{
  for(const value of ['wild','wild4'])for(const [color,label]of Object.entries({red:'Kırmızı',yellow:'Sarı',green:'Yeşil',blue:'Mavi'}))assert.deepEqual(chosenColor({top:card('wild',value),color}),{color,label});
  assert.equal(chosenColor({top:card('red','3'),color:'red'}),null);
});

test('the deployment asset selection includes all runtime media and licenses but no large originals',async()=>{
  const files=await assetFiles(fileURLToPath(new URL('../public/assets/',import.meta.url)));const normalized=files.map(f=>f.replaceAll('\\','/'));
  for(const item of EXPRESSIONS)assert.ok(normalized.includes('expressions/'+item.file));
  for(const type of ['slide','place'])for(let n=1;n<=3;n++)assert.ok(normalized.includes(`audio/card-${type}-${n}.mp3`));
  assert.ok(normalized.includes('ATTRIBUTION.md'));assert.ok(normalized.includes('audio/LICENSE-Kenney.txt'));assert.ok(normalized.includes('expressions/LICENSE-Microsoft.txt'));assert.equal(files.some(f=>/\.(wav|png)$/.test(f)),false);
});
