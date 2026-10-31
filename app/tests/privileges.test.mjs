import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomAuthority} from '../src/room.js';
import {cardLayoutChanged} from '../public/table-motion.js';
function playing(name='Sude'){
 const room=new RoomAuthority('Masa',name,crypto.randomUUID(),{mode:'group'});room.join(name==='Umut'?'Deniz':'Umut',crypto.randomUUID());room.play(0,{type:'ready',round:0},room.revision);room.play(1,{type:'ready',round:0},room.revision);return room;
}
test('Sude saying öptüm changes exactly one card to +4 without changing card count, turn or deadline',()=>{
 const room=playing(),s=room.state,before=room.snapshot(0).state,deadline=s.turnDeadline,ids=s.players[0].hand.map(c=>c.id),count=s.players[0].hand.filter(c=>c.value==='wild4').length,revision=room.revision;
 const message=room.message(0,{text:'  ÖPTÜM  '});assert.equal(message.text,'ÖPTÜM');assert.equal(s.players[0].hand.filter(c=>c.value==='wild4').length,count+1);assert.deepEqual(s.players[0].hand.map(c=>c.id),ids);assert.equal(s.turn,before.turn);assert.equal(s.turnDeadline,deadline);assert.equal(room.revision,revision+1);assert.equal(cardLayoutChanged(before,room.snapshot(0).state),true);
 assert.equal([...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)].length,108);assert.ok(room.snapshot(0).state.playable.includes(s.lastMove.card));
});
test('other names, ordinary messages, lobby and disabled privileges leave cards unchanged',()=>{
 for(const [name,text,enabled]of [['Umut','öptüm',true],['Sude','merhaba',true],['Sude','öptüm',false]]){const room=playing(name),before=structuredClone(room.state.players[0].hand);room.features.kissWild4=enabled;room.message(0,{text});assert.deepEqual(room.state.players[0].hand,before);}
 const lobby=new RoomAuthority('Masa','Sude',crypto.randomUUID(),{mode:'group'});lobby.message(0,{text:'öptüm'});assert.deepEqual(lobby.state.players[0].hand,[]);
});
