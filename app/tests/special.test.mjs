import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,newRoom,newPlayer,startRound,act,view,playable,needsColor,SPECIAL_VALUES,nextPlayer} from '../src/engine.js';
import {botCommand} from '../src/bot.js';
import {RoomAuthority,TURN_DURATION} from '../src/room.js';

function game(hands,{direction=1}={}){
  const s=newRoom('Özel',newPlayer('A',crypto.randomUUID()),{mode:'group',rules:'special'});
  for(let i=1;i<hands.length;i++)s.players.push(newPlayer(String(i),crypto.randomUUID()));
  startRound(s);const stock=deck('special');
  const take=key=>{const [color,value]=key.split(':'),i=stock.findIndex(c=>c.color===color&&c.value===value);assert.ok(i>=0,key);return stock.splice(i,1)[0];};
  for(let i=0;i<hands.length;i++)s.players[i].hand=hands[i].map(take);
  s.pile=[take('red:7')];s.deck=stock;s.color='red';s.turn=0;s.direction=direction;return s;
}
const ids=s=>[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)].map(c=>c.id).sort();
const play=(s,i,value,extra={})=>{const c=s.players[i].hand.find(c=>c.value===value);assert.ok(c,value);act(s,i,{type:'play',cardId:c.id,color:'blue',uno:true,...extra});return c;};
const unchanged=(s,fn)=>{const before=structuredClone(s);assert.throws(fn);assert.deepEqual(s,before);};

test('classic remains 108 cards; the optional special deck has 129 unique cards and seven extra types',()=>{
  assert.equal(deck().length,108);const cards=deck('special');assert.equal(cards.length,129);assert.equal(new Set(cards.map(c=>c.id)).size,129);
  assert.equal(cards.filter(c=>SPECIAL_VALUES.includes(c.value)).length,21);assert.equal(cards.filter(c=>c.value==='swap').length,1);
  for(const n of [2,3,4,5,6]){const s=game(Array.from({length:n},()=>[]));startRound(s);assert.ok(s.players.every(p=>p.hand.length===7));assert.match(s.pile[0].value,/^\d$/);assert.equal(ids(s).length,129);}
});

test('spy exposes exactly one tracked card only to its owner and expires on discard and new round',()=>{
  const s=game([['red:spy','blue:2'],['red:3']]);play(s,0,'spy',{target:1});
  const known=view(s,0).revealed;assert.equal(known.length,1);assert.equal(known[0].card.id,s.players[1].hand[0].id);assert.equal(view(s,1).revealed.length,0);
  assert.equal(view(s,0).insights,undefined);assert.equal(view(s,0).players[1].hand,undefined);
  assert.doesNotMatch(JSON.stringify(view(s,0)),new RegExp(s.players[1].token));
  play(s,1,'3');assert.deepEqual(view(s,0).revealed,[]);startRound(s);assert.deepEqual(s.insights,[]);
});

test('tracked cards follow gifts and swaps without exposing any other card or gifting identity publicly',()=>{
  const s=game([['red:spy','blue:2'],['red:gift','red:3','blue:4'],['wild:swap','green:2']]);
  const tracked=s.players[1].hand.find(c=>c.value==='3');s.insights=[{viewer:0,cardId:tracked.id}];s.turn=1;
  play(s,1,'gift',{target:2,giftId:tracked.id});assert.equal(view(s,0).revealed[0].player,2);assert.equal(s.lastMove.giftId,undefined);assert.equal(s.lastMove.giftCard,undefined);
  play(s,2,'swap',{target:1});assert.equal(view(s,0).revealed[0].player,1);assert.equal(view(s,2).revealed.length,0);assert.equal(view(s,0).revealed.length,1);
});

test('invalid target, self target and forged gift IDs leave all state untouched',()=>{
  for(const value of ['spy','swap','gift']){
    const s=game([[`${value==='swap'?'wild':'red'}:${value}`,'blue:2'],['red:3']]);
    for(const target of [undefined,-1,0,8,'1'])unchanged(s,()=>play(s,0,value,{target,giftId:'fake'}));
    if(value==='gift'){const own=s.players[0].hand[0];unchanged(s,()=>play(s,0,value,{target:1,giftId:own.id}));}
  }
});

test('bomb sets a 1–3 penalty without drawing before the victim responds, including a final bomb',()=>{
  for(const last of [false,true]){
    const s=game([last?['red:bomb']:['red:bomb','blue:2'],['wild:shield','red:3']]);const before=ids(s);play(s,0,'bomb');
    const amount=s.pendingDraw.count;assert.ok(amount>=1&&amount<=3);assert.equal(s.players[1].hand.length,2);assert.equal(s.phase,'playing');
    act(s,1,{type:'draw'});assert.equal(s.players[1].hand.length,2+amount);assert.equal(s.pendingDraw,null);assert.deepEqual(ids(s),before);if(last)assert.equal(s.winner,0);
  }
});

test('shield passes a stacked penalty unchanged; reflect sends it back to the attacker',()=>{
  const s=game([['red:draw2','blue:2'],['wild:wild4','blue:3'],['wild:shield','green:3'],['wild:reflect','yellow:3']]);
  play(s,0,'draw2');play(s,1,'wild4');const pending={...s.pendingDraw};
  assert.equal(needsColor(s.players[2].hand[0],s.pendingDraw),false);play(s,2,'shield');assert.deepEqual(s.pendingDraw,pending);assert.equal(s.turn,3);assert.equal(s.color,'blue');
  play(s,3,'reflect');assert.equal(s.turn,1);assert.deepEqual(s.pendingDraw,pending);act(s,1,{type:'draw'});assert.equal(s.players[1].hand.length,7);
});

test('two player shield returns the penalty and reflect never reflects to oneself',()=>{
  const s=game([['red:draw2','wild:reflect','blue:2'],['wild:shield','red:3']]);play(s,0,'draw2');play(s,1,'shield');assert.equal(s.turn,0);play(s,0,'reflect');assert.equal(s.turn,1);assert.equal(s.pendingDraw.count,2);
});

test('special defense is optional and ordinary drawing remains legal with playable special cards',()=>{
  const s=game([['red:draw2','blue:2'],['wild:shield','red:spy','green:2']]);play(s,0,'draw2');assert.ok(playable(s,1,s.players[1].hand[0]));act(s,1,{type:'draw'});assert.equal(s.players[1].hand.length,5);
  const a=game([['red:spy','wild:swap','green:2'],['blue:3']]);const n=a.players[0].hand.length;act(a,0,{type:'draw'});assert.equal(a.players[0].hand.length,n+1);
});

test('swap transfers entire remaining hands and a last swap simply ends the round',()=>{
  const s=game([['wild:swap','red:1','blue:2'],['green:3','yellow:4','blue:5','red:6']]),before=ids(s),other=s.players[1].hand.map(c=>c.id);
  play(s,0,'swap',{target:1});assert.deepEqual(s.players[0].hand.map(c=>c.id),other);assert.equal(s.players[1].hand.length,2);assert.deepEqual(ids(s),before);
  const final=game([['wild:swap'],['red:1']]);play(final,0,'swap');assert.equal(final.phase,'finished');assert.equal(final.winner,0);assert.equal(final.players[1].hand.length,1);
});

test('gift transfers the selected card and winning with a final gift keeps all cards conserved',()=>{
  const s=game([['red:gift','blue:2'],['green:3']]),before=ids(s),gift=s.players[0].hand[1];play(s,0,'gift',{target:1,giftId:gift.id});assert.ok(s.players[1].hand.some(c=>c.id===gift.id));assert.equal(s.winner,0);assert.deepEqual(ids(s),before);
});

for(const count of [2,3,6])for(const direction of [1,-1])test(`hand rotation preserves all cards and direction for ${count} players, direction ${direction}`,()=>{
  const hands=[['wild:rotate','red:1'],...Array.from({length:count-1},(_,i)=>[`${['yellow','green','blue','red','yellow'][i]}:2`])];
  const s=game(hands,{direction}),before=ids(s),remaining=s.players.map((p,i)=>p.hand.filter(c=>i!==0||c.value!=='rotate').map(c=>c.id));
  play(s,0,'rotate');for(let i=0;i<count;i++)assert.deepEqual(s.players[nextPlayer(s,i)].hand.map(c=>c.id),remaining[i]);assert.deepEqual(ids(s),before);
});

test('special penalty timeout takes the full bomb amount once, checkpoints preserve mode and private knowledge',()=>{
  let time=10000;const s=game([['red:bomb','blue:2'],['red:3']]);const authority=new RoomAuthority('','','',{now:()=>time,saved:{state:s,revision:0,lastActive:time}});
  authority.play(0,{type:'play',cardId:s.players[0].hand[0].id,uno:true},0);const amount=s.pendingDraw.count;
  const restored=new RoomAuthority('','','',{now:()=>time,saved:authority.checkpoint()});assert.equal(restored.state.rules,'special');time+=TURN_DURATION+1;restored.expireTurn();assert.equal(restored.state.players[1].hand.length,1+amount);assert.equal(restored.state.pendingDraw,null);assert.equal(restored.expireTurn(),false);
});

test('bots complete special games using only masked snapshots and never lose a card',()=>{
  for(const count of [2,3,6])for(let round=0;round<3;round++){
    const s=game(Array.from({length:count},()=>[]));startRound(s);const initial=ids(s);
    let steps=0;while(s.phase==='playing'&&steps++<12000){const i=s.turn,command=botCommand(view(s,i),i);assert.ok(command);act(s,i,command);assert.deepEqual(ids(s),initial);}
    assert.equal(s.phase,'finished');assert.equal(s.pendingDraw,null);assert.ok(s.players[s.winner].hand.length===0);
  }
});

test('legacy 130-card checkpoints finish unchanged and use the new rare-swap deck on the next round',()=>{
  const authority=new RoomAuthority('Legacy','A',crypto.randomUUID(),{rules:'special'});authority.join('B',crypto.randomUUID());
  authority.state.deck.push({id:'legacy-swap',color:'wild',value:'swap'});const before=ids(authority.state);assert.equal(before.length,130);
  const restored=new RoomAuthority('','','',{saved:structuredClone(authority.checkpoint())});assert.deepEqual(ids(restored.state),before);
  startRound(restored.state);assert.equal(ids(restored.state).length,129);assert.equal([...restored.state.deck,...restored.state.pile,...restored.state.players.flatMap(p=>p.hand)].filter(c=>c.value==='swap').length,1);
});
