import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,newPlayer,startRound,act,view,playable,nextPlayer,points} from '../src/engine.js';
import {RoomAuthority,UNO_DURATION} from '../src/room.js';
import {botCommand} from '../src/bot.js';
import {seating} from '../public/table-motion-multi.js';
import {planTransition} from '../public/table-motion.js';
const c=(color,value)=>({id:crypto.randomUUID(),color,value});
function game(n=4){const s=newRoom('Masa',newPlayer('A','a'),{capacity:n});for(let i=1;i<n;i++)s.players.push(newPlayer(String.fromCharCode(65+i),'token'+i));startRound(s);return s;}
function fixed(value,n=4){const s=game(n),card=c(value.startsWith('wild')?'wild':'red',value);s.color='red';s.pile=[c('red','7')];s.players[0].hand=[card,c('blue','9')];return {s,card};}
function clockGame(){let now=1000;const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{now:()=>now});room.join('B',crypto.randomUUID());const card=c('red','3');room.state.color='red';room.state.pile=[c('red','7')];room.state.players[0].hand=[card,c('blue','8')];return {room,card,advance:n=>now+=n};}

test('a four-seat table waits for exactly four players and deals 28 hidden cards',()=>{
  const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{capacity:4});for(let i=1;i<4;i++){assert.equal(room.join(String.fromCharCode(65+i),crypto.randomUUID()),i);assert.equal(room.state.phase,i===3?'playing':'waiting');}
  assert.deepEqual(room.state.players.map(p=>p.hand.length),[7,7,7,7]);assert.equal(room.state.deck.length,79);assert.throws(()=>room.join('E',crypto.randomUUID()));
  for(let me=0;me<4;me++){const state=room.snapshot(me).state;state.players.forEach((p,i)=>assert.equal(!!p.hand,i===me));assert.equal(state.players.filter(p=>p.hand).length,1);}
});
test('four-player normal turns advance clockwise and wrap back to the first seat',()=>{
  const s=game();s.color='red';for(let i=0;i<4;i++){const card=c('red',String(i));s.players[i].hand=[card,c('blue','9')];act(s,i,{type:'play',cardId:card.id,uno:true});assert.equal(s.turn,(i+1)%4);}
});
test('four-player skip skips one seat; reverse changes direction and follows it',()=>{
  const skip=fixed('skip');act(skip.s,0,{type:'play',cardId:skip.card.id,uno:true});assert.equal(skip.s.turn,2);
  const {s,card}=fixed('reverse');act(s,0,{type:'play',cardId:card.id,uno:true});assert.equal(s.direction,-1);assert.equal(s.turn,3);assert.equal(nextPlayer(s,3),2);
  const again=c('red','reverse');s.players[3].hand=[again,c('blue','9')];act(s,3,{type:'play',cardId:again.id,uno:true});assert.equal(s.direction,1);assert.equal(s.turn,0);
});
test('four-player penalties travel to the next seat, stack there, then skip the drawing seat',()=>{
  const {s,card}=fixed('draw2');const four=c('wild','wild4');s.players[1].hand=[four,c('red','9')];act(s,0,{type:'play',cardId:card.id,uno:true});
  assert.equal(s.turn,1);assert.equal(s.players[1].hand.length,2);act(s,1,{type:'play',cardId:four.id,color:'green',uno:true});assert.equal(s.turn,2);const count=s.players[2].hand.length;act(s,2,{type:'draw'});assert.equal(s.players[2].hand.length,count+6);assert.equal(s.turn,3);
});
test('penalty routing respects a reversed four-player table',()=>{
  const {s,card}=fixed('draw2');s.direction=-1;act(s,0,{type:'play',cardId:card.id,uno:true});assert.equal(s.turn,3);act(s,3,{type:'draw'});assert.equal(s.turn,2);
});
test('finishing penalty chains award the first empty hand and sum every losing hand',()=>{
  const {s,card}=fixed('draw2');s.players[0].hand=[card];const four=c('wild','wild4');s.players[1].hand=[four];act(s,0,{type:'play',cardId:card.id});act(s,1,{type:'play',cardId:four.id,color:'green'});assert.equal(s.phase,'playing');act(s,2,{type:'draw'});assert.equal(s.winner,0);
  const total=s.players.slice(1).flatMap(p=>p.hand).reduce((n,card)=>n+points(card),0);assert.equal(s.players[0].score,total);assert.equal(s.players[0].wins,1);
  for(let i=0;i<4;i++)act(s,i,{type:'ready'});assert.equal(s.round,2);assert.equal(s.players[0].wins,1);assert.equal(s.turn,1);
});
test('all four seats see the other three in stable relative positions',()=>{const s=game();for(let me=0;me<4;me++){const places=seating(view(s,me));assert.deepEqual(places.find(p=>p.index===(me+1)%4).seat,'left');assert.equal(places.find(p=>p.index===(me+2)%4).seat,'top');assert.equal(places.find(p=>p.index===(me+3)%4).seat,'right');}});
test('a side opponent play and a different opponent penalty animate in their own seats',()=>{const s=game(),before=structuredClone(view(s,0));const card=s.players[3].hand.pop();s.pile.push(card);s.lastMove={type:'play',player:3};s.players[1].hand.push(c('red','2'),c('blue','4'));const plan=planTransition(before,view(s,0));assert.equal(plan.opponents.find(p=>p.index===3).played,true);assert.equal(plan.opponents.find(p=>p.index===1).added,2);assert.equal(plan.opponents.find(p=>p.index===2).added,0);});

test('a held +4 and other special cards never force playing instead of drawing',()=>{for(const value of ['wild4','wild','draw2','skip','reverse']){const {s,card}=fixed(value,2);s.deck.push(c('green','5'));assert.equal(playable(s,0,card),true);act(s,0,{type:'draw'});assert.equal(s.players[0].hand.some(c=>c.id===card.id),true);assert.equal(s.turn,1);}});
test('a freshly drawn +4 can be played despite holding the active color, or passed',()=>{for(const play of [false,true]){const s=game(2),four=c('wild','wild4');s.color='red';s.players[0].hand=[c('red','8')];s.deck.push(four);act(s,0,{type:'draw'});assert.equal(s.drawnId,four.id);assert.equal(playable(s,0,four),true);act(s,0,play?{type:'play',cardId:four.id,color:'yellow',uno:true}:{type:'pass'});assert.equal(s.turn,1);assert.equal(s.pendingDraw?.count??0,play?4:0);}});
test('forgotten UNO never draws cards after the former grace period',()=>{const {room,card,advance}=clockGame();room.play(0,{type:'play',cardId:card.id},room.revision);advance(UNO_DURATION*3);assert.equal(room.expireUno(),false);assert.equal(room.state.players[0].hand.length,1);assert.equal(room.state.turn,1);assert.equal(room.state.unoDeadline,null);assert.equal(room.state.lastUnoPenalty,null);});
test('pressing optional UNO after the card lands still announces it',()=>{const {room,card,advance}=clockGame();room.play(0,{type:'play',cardId:card.id},room.revision);advance(800);room.play(0,{type:'uno'},room.revision);advance(UNO_DURATION);assert.equal(room.expireUno(),false);assert.equal(room.state.players[0].hand.length,1);assert.equal(room.state.lastUnoCall.player,0);});
test('the next player action cannot penalize a missed UNO',()=>{const {room,card}=clockGame();room.play(0,{type:'play',cardId:card.id},room.revision);assert.throws(()=>room.play(1,{type:'pass'},room.revision));assert.equal(room.state.players[0].hand.length,1);room.play(1,{type:'draw'},room.revision);assert.equal(room.state.players[0].hand.length,1);assert.equal(room.state.vulnerable,null);});
test('a skip retaining the turn allows finishing without UNO or drawing penalty cards',()=>{const {s,card}=fixed('skip',2);s.players[0].hand=[card,c('red','8')];act(s,0,{type:'play',cardId:card.id});const last=s.players[0].hand[0];act(s,0,{type:'play',cardId:last.id});assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.equal(s.players[0].hand.length,0);assert.equal(s.lastUnoPenalty,null);});

test('bot decisions work with only the masked personal hand and declare UNO',()=>{const s=game(2);s.turn=1;s.color='red';s.pile=[c('red','7')];const four=c('wild','wild4'),number=c('red','4');s.players[1].hand=[four,number];const state=view(s,1);assert.equal(state.players[0].hand,undefined);const command=botCommand(state,1);assert.equal(command.cardId,number.id);assert.equal(command.uno,true);act(s,1,command);assert.equal(s.players[1].uno,true);});
test('bot handles stacked penalties, draws without a counter and passes an unplayable drawn card',()=>{const s=game(2);s.turn=1;s.pendingDraw={count:6,value:'wild4'};s.players[1].hand=[c('red','draw2')];assert.deepEqual(botCommand(view(s,1),1),{type:'draw'});const four=c('wild','wild4');s.players[1].hand.push(four);assert.equal(botCommand(view(s,1),1).cardId,four.id);s.pendingDraw=null;s.color='blue';s.drawnId=s.players[1].hand[0].id;assert.deepEqual(botCommand(view(s,1),1),{type:'pass'});});
test('200 bot-driven two- and four-player games finish and conserve all 108 cards',()=>{for(const n of [2,4])for(let g=0;g<100;g++){const s=game(n);let moves=0;while(s.phase==='playing'&&moves++<5000){const i=s.turn;const command=botCommand(view(s,i),i);assert.ok(command);act(s,i,command);const cards=[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);}assert.equal(s.phase,'finished');assert.equal(s.players[s.winner].hand.length,0);}});

test('entering the same named table starts fresh session scores',()=>{const first=new RoomAuthority('Masa','__proto__',crypto.randomUUID());first.join('B',crypto.randomUUID());first.state.players[0].wins=2;first.state.players[1].wins=1;const fresh=new RoomAuthority('Masa','__proto__',crypto.randomUUID());fresh.join('B',crypto.randomUUID());assert.deepEqual(fresh.state.players.map(p=>p.wins),[0,0]);assert.notEqual(first.state.roundId,fresh.state.roundId);});
test('four simultaneous rematch approvals share one round without stale-revision failures',()=>{const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{capacity:4});for(const name of ['B','C','D'])room.join(name,crypto.randomUUID());room.state.phase='finished';const round=room.state.round,revision=room.revision;for(let i=0;i<4;i++)room.play(i,{type:'ready',round},revision);assert.equal(room.state.phase,'playing');assert.equal(room.state.round,round+1);assert.throws(()=>room.play(0,{type:'ready',round},revision));});
