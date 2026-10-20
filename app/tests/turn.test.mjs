import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomAuthority,TURN_DURATION,IDLE_LIMIT,UNO_DURATION} from '../src/room.js';
function game() {let now=100000;const room=new RoomAuthority('Masa','Umut',crypto.randomUUID(),{now:()=>now});room.join('Deniz',crypto.randomUUID());return {room,advance:n=>now+=n,now:()=>now};}
test('each turn has thirty seconds, without depending on client clock',()=>{const {room,advance,now}=game();assert.equal(room.state.turnDeadline,now()+30000);advance(29999);assert.equal(room.expireTurn(),false);advance(1);assert.equal(room.expireTurn(),true);assert.equal(room.state.turn,1);assert.equal(room.state.players[0].hand.length,8);assert.equal(room.state.turnDeadline,now()+TURN_DURATION);assert.equal(room.snapshot(1).serverNow,now());});
test('timeout draws exactly one card and passes even when drawn card is playable',()=>{const {room,advance}=game();room.state.deck.push({id:'timed-draw',color:room.state.color,value:'2'});advance(TURN_DURATION);room.expireTurn();assert.equal(room.state.turn,1);assert.equal(room.state.drawnId,null);assert.equal(room.state.players[0].hand.length,8);});
test('if a playable card was already drawn, timeout passes without drawing twice',()=>{const {room,advance}=game();room.state.deck.push({id:'drawn',color:room.state.color,value:'4'});room.play(0,{type:'draw'},room.revision);assert.equal(room.state.drawnId,'drawn');advance(TURN_DURATION);room.expireTurn();assert.equal(room.state.players[0].hand.length,8);assert.equal(room.state.turn,1);});
test('chat and UNO do not extend the turn, normal play starts a fresh turn',()=>{const {room,advance,now}=game();const deadline=room.state.turnDeadline;advance(1000);room.message(0,{text:'test'});assert.equal(room.state.turnDeadline,deadline);const c={id:'timer-play',color:room.state.color,value:'3'};room.state.players[0].hand.push(c);room.play(0,{type:'play',cardId:c.id},room.revision);assert.equal(room.state.turnDeadline,now()+TURN_DURATION);});
test('late commands cannot sneak a play into an expired turn',()=>{const {room,advance}=game();const c=room.state.players[0].hand[0];advance(TURN_DURATION);assert.equal(room.play(0,{type:'play',cardId:c.id},room.revision),false);assert.equal(room.state.players[0].hand.length,8);assert.equal(room.state.turn,1);});
test('pause and reconnect preserve remaining time with no ticking while disconnected',()=>{const {room,advance,now}=game();advance(7000);room.pauseTurn();assert.equal(room.state.turnDeadline,null);advance(60000);assert.equal(room.expireTurn(),false);room.resumeTurn();assert.equal(room.state.turnDeadline,now()+23000);});
test('automatic turn expiry does not prevent the twenty-minute room cleanup',()=>{const {room,advance}=game();for(let i=0;i<39;i++){advance(TURN_DURATION);room.expireTurn();}advance(TURN_DURATION);assert.equal(room.expired(),true);assert.equal(room.expireTurn(),false);assert.equal(IDLE_LIMIT,1200000);});

for(const value of ['skip','reverse'])test(`${value} keeps the turn and allows the last card without an UNO penalty, even after the usual grace time`,()=>{
  const {room,advance}=game(),s=room.state,first={id:'first',color:'red',value},last={id:'last',color:'red',value:'9'};
  s.pile=[{id:'top',color:'red',value:'7'}];s.color='red';s.players[0].hand=[first,last];
  room.play(0,{type:'play',cardId:first.id},room.revision);assert.equal(s.turn,0);assert.equal(s.vulnerable,null);assert.equal(s.unoDeadline,null);
  assert.throws(()=>room.play(1,{type:'catch'},room.revision));advance(UNO_DURATION+100);assert.equal(room.expireUno(),false);assert.equal(s.players[0].hand.length,1);
  room.play(0,{type:'play',cardId:last.id},room.revision);assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.equal(s.players[0].hand.length,0);assert.equal(s.lastUnoPenalty,null);
});

test('old saved UNO deadlines are cleared on either turn without changing hands or draw penalties',()=>{
  for(const turn of [0,1]){
    const {room,advance}=game(),s=room.state;s.players[0].hand=[{id:'last',color:s.color,value:'9'}];s.turn=turn;s.vulnerable=0;s.unoDeadline=100001;s.pendingDraw={count:6,value:'wild4'};
    const saved=structuredClone(room.checkpoint());saved.unoRemaining=1000;advance(UNO_DURATION+100);const restored=new RoomAuthority('','','',{now:room.now,saved});
    assert.equal(restored.expireUno(),false);assert.equal(restored.state.players[0].hand.length,1);assert.equal(restored.state.vulnerable,null);assert.equal(restored.state.unoDeadline,null);assert.equal(restored.unoRemaining,null);assert.equal(restored.state.pendingDraw.count,6);
  }
});
