import {COLOR_NAMES} from '../src/engine.js';

export function controls(state,{busy=false,moving=false,present=true}={}){
  const self=state.players[state.me],playing=state.phase==='playing',mine=playing&&state.turn===state.me;
  const blocked=busy||moving||!present;
  return {mine,blocked,canDraw:mine&&!blocked,drawCommand:state.drawnId?'pass':'draw',
    drawLabel:state.pendingDraw?`${state.pendingDraw.count} kart çek`:state.drawnId?'Pas geç':'Kart çek',
    showPass:mine&&!moving&&!!(state.drawnId||state.pendingDraw),
    canUno:playing&&self.count===1&&!self.uno&&!blocked};
}

export function chosenColor(state){return state.top?.color==='wild'&&COLOR_NAMES[state.color]?{color:state.color,label:COLOR_NAMES[state.color]}:null;}

export function feedback(previous,state){
  if(!previous||previous.round!==state.round)return [];
  const events=[];
  if(state.lastUnoPenalty?.seq!==previous.lastUnoPenalty?.seq&&state.lastUnoPenalty?.player===state.me)events.push({player:state.me,text:'UNO demedin. +2 kart.',private:true});
  if(state.lastUnoCall&&state.lastUnoCall.seq!==previous.lastUnoCall?.seq)events.push({player:state.lastUnoCall.player,text:'UNO',uno:true});
  return events;
}
