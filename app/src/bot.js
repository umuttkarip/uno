import {COLORS,playable,nextPlayer,needsTarget,points} from './engine.js';
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
  const rank=c=>(c.color==='wild'?-8:3)+(c.value==='draw2'||c.value==='bomb'?urgent?8:2:0)+(c.value==='skip'||c.value==='reverse'?urgent?5:1:0)+(c.value==='wild4'&&urgent?8:0)+(c.value==='gift'?7:0)+(c.value==='swap'&&player.hand.length>5?10:0)+frequency(c.color)*.2;
  const defense=c=>c.value==='shield'||c.value==='reflect'?0:c.value==='draw2'?1:2;
  options.sort((a,b)=>s.pendingDraw?defense(a)-defense(b):rank(b)-rank(a));
  const chosen=options[0],command={type:'play',cardId:chosen.id,color,uno:true};
  if(needsTarget(chosen,player.hand.length)){
    const opponents=s.players.flatMap((p,i)=>i===index?[]:[{index:i,count:p.count??p.hand?.length??0}]).filter(p=>p.count>0).sort((a,b)=>a.count-b.count);
    command.target=opponents[0].index;
    if(chosen.value==='gift')command.giftId=player.hand.filter(c=>c.id!==chosen.id).sort((a,b)=>points(b)-points(a))[0].id;
  }
  return command;
}
