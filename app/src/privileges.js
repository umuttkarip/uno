import {removeHandCard} from './engine.js';
export const DEFAULT_FEATURES={kissWild4:true,darlingRemove:true};
const normalized=text=>text.trim().normalize('NFC').toLocaleLowerCase('tr-TR');
export function kissWild4(state,index,text,features=DEFAULT_FEATURES){
  const player=state.players[index];
  if(!features.kissWild4||state.phase!=='playing'||!player||normalized(player.name)!=='sude'||normalized(text)!=='öptüm')return null;
  const eligible=player.hand.filter(card=>card.value!=='wild4');if(!eligible.length)return null;
  const random=new Uint32Array(1);crypto.getRandomValues(random);const card=eligible[random[0]%eligible.length];
  card.color='wild';card.value='wild4';
  state.lastMove={type:'kiss',player:index,card:card.id,seq:++state.seq};
  return card.id;
}
export function darlingRemove(state,index,text,features=DEFAULT_FEATURES){
  const player=state.players[index];
  if(!features.darlingRemove||state.phase!=='playing'||!player||normalized(player.name)!=='sude'||normalized(text)!=='canım')return null;
  const eligible=player.hand.filter(card=>card.value!=='wild4');if(!eligible.length)return null;
  const random=new Uint32Array(1);crypto.getRandomValues(random);
  return removeHandCard(state,index,eligible[random[0]%eligible.length].id);
}
