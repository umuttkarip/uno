import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomAuthority} from '../src/room.js';
import {botCommand} from '../src/bot.js';

function table(n,rules='special'){
  const room=new RoomAuthority('Masa','A',crypto.randomUUID(),{mode:'group',rules});
  for(let i=1;i<n;i++)room.join(String.fromCharCode(65+i),crypto.randomUUID());
  for(let i=0;i<n;i++)room.play(i,{type:'ready',round:0},room.revision);
  return room;
}
for(const direction of [1,-1])for(let count=3;count<=6;count++)test(`${count} players: departures preserve cards, turn and pending attacks in direction ${direction}`,()=>{
  for(let index=0;index<count;index++){
    const room=table(count),s=room.state;s.direction=direction;s.turn=index;s.drawnId=s.players[index].hand[0].id;
    s.pendingDraw={count:6,value:'wild4',source:(index+count-1)%count};
    const expected=s.players[(index+direction+count)%count].token,hands=new Map(s.players.map(p=>[p.token,p.hand.map(c=>c.id)])),round=s.round;
    const message=room.leave(index);assert.equal(message.text,String.fromCharCode(65+index)+' masadan ayrıldı.');assert.equal(message.system,true);
    assert.equal(s.players.length,count-1);assert.equal(s.players[s.turn].token,expected);assert.equal(s.drawnId,null);assert.equal(s.round,round);assert.equal(s.phase,'playing');assert.equal(s.pendingDraw.count,6);
    assert.ok(s.pendingDraw.source>=0&&s.pendingDraw.source<s.players.length);
    for(const p of s.players)assert.deepEqual(p.hand.map(c=>c.id),hands.get(p.token));
    const cards=[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)];assert.equal(cards.length,129);assert.equal(new Set(cards.map(c=>c.id)).size,129);
    let turns=0;while(s.phase==='playing'&&turns++<5000)room.play(s.turn,botCommand(room.snapshot(s.turn).state,s.turn),room.revision);
    assert.equal(s.phase,'finished');assert.ok(s.players[s.winner]);
  }
});
test('leaving out of turn preserves the drawn card choice and drops stale private insights',()=>{
  const room=table(4),s=room.state;s.turn=2;s.drawnId=s.players[2].hand[0].id;s.pendingDraw={count:2,value:'draw2',source:1};
  const drawn=s.drawnId;s.insights=[{viewer:3,cardId:s.players[1].hand[0].id},{viewer:3,cardId:drawn},{viewer:1,cardId:drawn}];
  room.leave(1);assert.equal(s.turn,1);assert.equal(s.drawnId,drawn);assert.equal(s.pendingDraw.source,undefined);assert.deepEqual(s.insights,[{viewer:2,cardId:drawn}]);
});
test('a finished winner leaving returns the remaining players to a usable ready lobby',()=>{
  const room=table(3),s=room.state;s.phase='finished';s.winner=1;s.players[2].wins=3;room.leave(1);
  assert.equal(s.phase,'waiting');assert.equal(s.winner,null);assert.equal(s.players[1].wins,3);
  room.play(0,{type:'ready',round:s.round},room.revision);room.play(1,{type:'ready',round:s.round},room.revision);assert.equal(s.phase,'playing');assert.equal(s.players[1].wins,3);
});
