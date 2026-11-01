import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomAuthority} from '../src/room.js';
import {cardLayoutChanged} from '../public/table-motion.js';
import {points} from '../src/engine.js';
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
const allCards=s=>[...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)];
function keepOne(s,index,value='7'){
 const p=s.players[index],cards=allCards(s),card=cards.find(c=>c.value===value);
 for(const owner of s.players)owner.hand=owner.hand.filter(c=>c.id!==card.id);
 s.deck=s.deck.filter(c=>c.id!==card.id);s.pile=s.pile.filter(c=>c.id!==card.id);
 s.deck.push(...p.hand);p.hand=[card];return card;
}
test('Sude saying canım removes exactly one non-+4 card without playing it or changing turn, color or deadline',()=>{
 const room=playing(),s=room.state,player=s.players[0],four=s.deck.find(c=>c.value==='wild4');s.deck.splice(s.deck.indexOf(four),1);player.hand.push(four);
 s.turn=1;const before=room.snapshot(0).state,hand=structuredClone(player.hand),ids=allCards(s).map(c=>c.id).sort(),top=structuredClone(s.pile),deadline=s.turnDeadline,revision=room.revision;
 room.message(0,{text:'  CANIM  '});
 const removed=hand.filter(c=>!player.hand.some(next=>next.id===c.id));assert.equal(removed.length,1);assert.notEqual(removed[0].value,'wild4');assert.deepEqual(player.hand,hand.filter(c=>c.id!==removed[0].id));assert.ok(player.hand.some(c=>c.id===four.id));
 assert.deepEqual(allCards(s).map(c=>c.id).sort(),ids);assert.deepEqual(s.pile,top);assert.equal(s.color,before.color);assert.equal(s.turn,1);assert.equal(s.turnDeadline,deadline);assert.equal(s.pendingDraw,null);assert.equal(room.revision,revision+1);assert.equal(cardLayoutChanged(before,room.snapshot(0).state),true);
});
test('canım has no effect for other names, other text, disabled flag, lobby or a hand containing only +4',()=>{
 for(const [name,text,enabled]of [['Umut','canım',true],['Sude','canım benim',true],['Sude','canım',false]]){const room=playing(name),before=structuredClone(room.state);room.features.darlingRemove=enabled;room.message(0,{text});assert.deepEqual(room.state,before);}
 const lobby=new RoomAuthority('Masa','Sude',crypto.randomUUID(),{mode:'group'});lobby.message(0,{text:'canım'});assert.deepEqual(lobby.state.players[0].hand,[]);
 const room=playing();keepOne(room.state,0,'wild4');const before=structuredClone(room.state),revision=room.revision;room.message(0,{text:'canım'});assert.deepEqual(room.state,before);assert.equal(room.revision,revision);assert.equal(room.messages.length,1);
});
test('removing a drawn special card clears its restriction and spy tracking without activating it',()=>{
 const room=playing(),s=room.state,card=keepOne(s,0,'skip'),four=s.deck.find(c=>c.value==='wild4');s.deck.splice(s.deck.indexOf(four),1);s.players[0].hand.push(four);s.drawnId=card.id;s.insights=[{viewer:1,cardId:card.id},{viewer:1,cardId:four.id}];s.lastUnoCall={player:0,seq:s.seq};
 const turn=s.turn,color=s.color;room.message(0,{text:'canım'});assert.equal(s.drawnId,null);assert.equal(s.turn,turn);assert.equal(s.color,color);assert.deepEqual(s.insights,[{viewer:1,cardId:four.id}]);assert.equal(s.lastUnoCall,null);assert.equal(s.players[0].uno,false);assert.equal(s.phase,'playing');
});
test('removing the last card finishes and scores the hand exactly once; rematch restores the normal deck',()=>{
 const room=playing(),s=room.state;keepOne(s,0);s.turn=1;const gain=s.players[1].hand.reduce((total,c)=>total+points(c),0);
 room.message(0,{text:'canım'});assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.equal(s.players[0].hand.length,0);assert.equal(s.players[0].wins,1);assert.equal(s.players[0].score,gain);assert.equal(s.turnDeadline,null);assert.equal(allCards(s).length,108);
 room.lastMessages.clear();room.message(0,{text:'canım'});assert.equal(s.players[0].wins,1);assert.equal(s.players[0].score,gain);
 room.play(0,{type:'ready',round:s.round},room.revision);room.play(1,{type:'ready',round:s.round},room.revision);assert.equal(s.phase,'playing');assert.equal(s.players[0].hand.length,7);assert.equal(allCards(s).length,108);assert.equal(allCards(s).filter(c=>c.value==='wild4').length,4);assert.equal(s.players[0].wins,1);
});
test('canım cannot erase an outstanding +2/+4 penalty or win before that penalty is resolved',()=>{
 for(const recipient of [0,1]){
  const room=playing(),s=room.state;keepOne(s,0);s.pendingDraw={count:4,value:'wild4',source:1-recipient};s.turn=recipient;const deadline=s.turnDeadline;
  room.message(0,{text:'canım'});assert.equal(s.phase,'playing');assert.equal(s.winner,null);assert.equal(s.players[0].wins,0);assert.deepEqual(s.finishOrder,[0]);assert.equal(s.pendingDraw.count,4);assert.equal(s.turnDeadline,deadline);
  room.play(recipient,{type:'draw'},room.revision);assert.equal(s.pendingDraw,null);
  if(recipient===0){assert.equal(s.players[0].hand.length,4);assert.equal(s.phase,'playing');assert.deepEqual(s.finishOrder,[]);}else{assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.equal(s.players[0].wins,1);}
 }
});
