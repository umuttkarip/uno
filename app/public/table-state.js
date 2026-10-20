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

export function messageSender(message,state){
  if(!state)return null;
  const name=message.name??state.players[message.player]?.name;
  if(name===undefined)return null;
  return {name,own:message.name!==undefined?name===state.players[state.me]?.name:message.player===state.me};
}

export function feedback(previous,state){
  if(!previous||previous.round!==state.round)return [];
  const events=[];
  if(state.lastUnoCall&&state.lastUnoCall.seq!==previous.lastUnoCall?.seq)events.push({player:state.lastUnoCall.player,text:'UNO',uno:true});
  return events;
}
