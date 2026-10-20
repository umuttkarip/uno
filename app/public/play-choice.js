import {needsTarget,needsColor} from '../src/engine.js';

// Resolve each choice against the latest masked snapshot, never another hand.
export function nextPlayChoice(state,play){
  const hand=state.players[state.me].hand,c=hand.find(card=>card.id===play.cardId);
  if(!c||!state.playable.includes(c.id))return {type:'invalid'};
  if(needsTarget(c,hand.length)){
    const players=state.players.flatMap((p,index)=>index===state.me||!p.count?[]:[{index,name:p.name,count:p.count}]);
    if(!players.some(p=>p.index===play.target))return {type:'target',players};
  }
  if(c.value==='gift'&&hand.length>1&&!hand.some(card=>card.id===play.giftId&&card.id!==c.id))return {type:'gift',cards:hand.filter(card=>card.id!==c.id)};
  if(needsColor(c,state.pendingDraw)&&!['red','yellow','green','blue'].includes(play.color))return {type:'color'};
  return {type:'ready'};
}
