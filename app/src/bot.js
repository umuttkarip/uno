import {COLORS,playable,nextPlayer} from './engine.js';
export function botCommand(s,index){
  const player=s.players[index];
  if(!player)return null;
  if(s.phase==='finished')return !player.ready?{type:'ready',round:s.round}:null;
  if(s.phase!=='playing'||s.turn!==index)return null;
  const options=player.hand.filter(c=>playable(s,index,c));
  if(!options.length)return {type:s.drawnId?'pass':'draw'};
  const frequency=color=>player.hand.filter(c=>c.color===color).length;
  const color=[...COLORS].sort((a,b)=>frequency(b)-frequency(a))[0];
  const next=s.players[nextPlayer(s,index)];const urgent=(next.count??next.hand?.length??0)<=2;
  const rank=c=>(c.color==='wild'?-8:3)+(c.value==='draw2'?urgent?8:2:0)+(c.value==='skip'||c.value==='reverse'?urgent?5:1:0)+(c.value==='wild4'&&urgent?8:0)+frequency(c.color)*.2;
  options.sort((a,b)=>s.pendingDraw?(a.value==='draw2'?-1:1)-(b.value==='draw2'?-1:1):rank(b)-rank(a));
  return {type:'play',cardId:options[0].id,color,uno:true};
}
