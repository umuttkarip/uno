import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,newPlayer,startRound,act,playable,view} from '../src/engine.js';
import {RoomAuthority,TURN_DURATION} from '../src/room.js';
import {planTransition} from '../public/table-motion.js';

const c=(color,value)=>({id:crypto.randomUUID(),color,value});
function game(a,b){const s=newRoom('Masa',newPlayer('A','host'));s.players.push(newPlayer('B','guest'));startRound(s);s.color='red';s.pile=[c('red','7')];s.players[0].hand=a;s.players[1].hand=b;return s;}
const play=(s,index,card,color='blue',extra={})=>act(s,index,{type:'play',cardId:card.id,color,uno:true,...extra});
const unchanged=(s,action)=>{const before=structuredClone(s);assert.throws(action);assert.deepEqual(s,before);};

test('+2 can be answered with +4 even if the responder holds the active color',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');
  const s=game([two,c('blue','8')],[four,c('red','9')]);
  play(s,0,two);assert.equal(s.players[1].hand.length,2);assert.equal(s.turn,1);
  assert.equal(playable(s,1,four),true);play(s,1,four,'green');
  assert.deepEqual(s.pendingDraw,{count:6,value:'wild4'});assert.equal(s.turn,0);
  assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,1);assert.equal(s.color,'green');
});

for(const [first,second,total] of [['draw2','draw2',4],['wild4','wild4',8]])test(`${first} can be answered with ${second} regardless of color`,()=>{
  const a=c(first==='wild4'?'wild':'red',first),b=c(second==='wild4'?'wild':'green',second);
  const s=game([a,c('blue','6')],[b,c('yellow','8')]);play(s,0,a);assert.ok(playable(s,1,b));play(s,1,b);
  assert.equal(s.pendingDraw.count,total);assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,1);
});

test('+4 cannot be lowered to +2, including a +2 matching the chosen color',()=>{
  const four=c('wild','wild4'),two=c('blue','draw2');const s=game([four,c('green','1')],[two,c('blue','8')]);
  play(s,0,four,'blue');assert.equal(playable(s,1,two),false);unchanged(s,()=>play(s,1,two));
});

for(const value of ['7','skip','reverse','wild'])test(`pending +2 rejects ${value} and cannot be passed for free`,()=>{
  const two=c('red','draw2'),response=c(value==='wild'?'wild':'red',value);const s=game([two,c('blue','8')],[response,c('green','1')]);
  play(s,0,two);assert.equal(playable(s,1,response),false);unchanged(s,()=>play(s,1,response));unchanged(s,()=>act(s,1,{type:'pass'}));
});

test('a player can choose to draw despite holding a valid counter; drawn cards cannot be played immediately',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two,c('blue','8')],[four,c('red','9')]);
  s.deck.push(c('red','draw2'),c('wild','wild4'));play(s,0,two);act(s,1,{type:'draw'});
  assert.equal(s.players[1].hand.length,4);assert.equal(s.turn,0);assert.equal(s.drawnId,null);assert.equal(s.pendingDraw,null);
  unchanged(s,()=>play(s,1,four));
});

test('a mixed chain accumulates 2 + 2 + 4 + 4 and is paid exactly once',()=>{
  const a=c('red','draw2'),b=c('green','draw2'),d=c('wild','wild4'),e=c('wild','wild4');
  const s=game([a,d,c('blue','9')],[b,e,c('red','8')]);
  play(s,0,a);play(s,1,b);play(s,0,d);play(s,1,e);assert.equal(s.pendingDraw.count,12);
  act(s,0,{type:'draw'});assert.equal(s.players[0].hand.length,13);assert.equal(s.players[1].hand.length,1);
  assert.equal(s.pendingDraw,null);assert.equal(s.turn,1);unchanged(s,()=>act(s,0,{type:'draw'}));
});

test('invalid joker color and out-of-turn counters leave the pending chain untouched',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two,c('blue','8')],[four,c('red','9')]);play(s,0,two);
  unchanged(s,()=>play(s,1,four,'pink'));unchanged(s,()=>act(s,0,{type:'draw'}));assert.equal(s.pendingDraw.count,2);
});

test('a last +2 can be countered before a winner is declared',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two],[four,c('green','8')]);
  play(s,0,two);assert.equal(s.phase,'playing');assert.equal(s.winner,null);assert.equal(s.players[0].wins,0);
  play(s,1,four);assert.equal(s.phase,'playing');act(s,0,{type:'draw'});
  assert.equal(s.phase,'playing');assert.equal(s.players[0].hand.length,6);assert.equal(s.players[0].score,0);
});

test('if both players finish with penalty cards, the player forced to draw loses the chain',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two],[four]);
  s.deck=Array.from({length:6},()=>c('blue','1'));play(s,0,two);play(s,1,four);assert.equal(s.phase,'playing');
  act(s,0,{type:'draw'});assert.equal(s.phase,'finished');assert.equal(s.winner,1);assert.equal(s.players[1].score,6);assert.equal(s.players[1].wins,1);
  act(s,0,{type:'ready'});act(s,1,{type:'ready'});assert.equal(s.pendingDraw,null);assert.equal(s.phase,'playing');
});

test('accepting a penalty reshuffles old discards without losing cards or changing the top',()=>{
  const two=c('red','draw2');const s=game([two,c('green','6')],[c('blue','1')]);s.deck=[];s.pile.unshift(c('green','2'),c('yellow','4'));
  const before=[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)].map(c=>c.id).sort();
  play(s,0,two);act(s,1,{type:'draw'});
  assert.equal(s.pile.at(-1).id,two.id);assert.equal(s.players[1].hand.length,3);
  assert.deepEqual([...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)].map(c=>c.id).sort(),before);
});

test('optional UNO never adds cards to or replaces the pending card penalty',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two,c('blue','8')],[four,c('red','9')]);play(s,0,two,'blue',{uno:false});
  assert.throws(()=>act(s,1,{type:'catch'}));assert.equal(s.players[0].hand.length,1);assert.equal(s.pendingDraw.count,2);assert.equal(s.turn,1);play(s,1,four,'green',{uno:true});
  assert.equal(s.players[1].uno,true);assert.equal(s.pendingDraw.count,6);
});

test('penalty timeout takes the whole accumulated amount, not one card or a second draw',()=>{
  let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{now:()=>now});room.join('B',crypto.randomUUID());
  const two=c('red','draw2'),four=c('wild','wild4');const s=room.state;s.color='red';s.pile=[c('red','7')];s.players[0].hand=[two,c('blue','8')];s.players[1].hand=[four,c('red','9')];
  room.play(0,{type:'play',cardId:two.id,uno:true},room.revision);room.play(1,{type:'play',cardId:four.id,color:'blue',uno:true},room.revision);
  now+=TURN_DURATION;assert.equal(room.expireTurn(),true);assert.equal(s.players[0].hand.length,7);assert.equal(s.turn,1);assert.equal(s.pendingDraw,null);
  assert.equal(room.expireTurn(),false);assert.equal(s.players[0].hand.length,7);
});

test('snapshots and animations separate playing a penalty from accepting its draw',()=>{
  const two=c('red','draw2'),four=c('wild','wild4');const s=game([two,c('blue','8')],[four,c('red','9')]);
  const before=structuredClone(view(s,1));play(s,0,two);const pending=structuredClone(view(s,1));
  let motion=planTransition(before,pending);assert.equal(motion.opponentPlayed,true);assert.equal(motion.added.length,0);assert.equal(pending.pendingDraw.count,2);
  act(s,1,{type:'draw'});motion=planTransition(pending,view(s,1));assert.equal(motion.topChanged,false);assert.equal(motion.added.length,2);assert.equal(motion.opponentPlayed,false);
});

test('refresh checkpoints preserve the accumulated penalty and response choices',()=>{
  const now=()=>1000;const token=crypto.randomUUID();const room=new RoomAuthority('Masa','A',token,{now});room.join('B',crypto.randomUUID());
  const two=c('red','draw2'),four=c('wild','wild4');room.state.color='red';room.state.pile=[c('red','7')];room.state.players[0].hand=[two,c('blue','8')];room.state.players[1].hand=[four,c('red','9')];
  room.play(0,{type:'play',cardId:two.id},room.revision);
  const restored=new RoomAuthority('Masa','A',token,{now,saved:structuredClone(room.checkpoint())});
  assert.deepEqual(restored.snapshot(1),room.snapshot(1));assert.ok(restored.snapshot(1).state.playable.includes(four.id));
  restored.play(1,{type:'play',cardId:four.id,color:'green'},restored.revision);assert.equal(restored.state.pendingDraw.count,6);
});

test('timing out on a final penalty resolves scoring and stops the turn clock',()=>{
  let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{now:()=>now});room.join('B',crypto.randomUUID());
  const two=c('red','draw2');room.state.color='red';room.state.pile=[c('red','7')];room.state.players[0].hand=[two];room.state.players[1].hand=[c('blue','1')];room.state.deck=[c('green','2'),c('yellow','3')];
  room.play(0,{type:'play',cardId:two.id},room.revision);now+=TURN_DURATION;room.expireTurn();
  assert.equal(room.state.phase,'finished');assert.equal(room.state.winner,0);assert.equal(room.state.players[0].score,6);assert.equal(room.state.turnDeadline,null);
});

test('every ordinary card matches its color or symbol, while off-color action cards stay illegal',()=>{
  for(const color of ['red','yellow','green','blue'])for(const value of ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2']){
    const candidate=c(color,value),s=game([candidate,c('yellow','1')],[c('blue','3')]);
    assert.equal(playable(s,0,candidate),color==='red'||value==='7',color+' '+value);
    assert.equal(playable(s,1,candidate),false);
  }
});
