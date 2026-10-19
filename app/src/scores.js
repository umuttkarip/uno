import {roomKey} from './engine.js';
const key=name=>'uno-scores-v1:'+roomKey(name);
export function readScores(name,storage){try{storage??=globalThis.localStorage;const data=JSON.parse(storage.getItem(key(name)));return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
export function saveScores(state,storage){
  if(state.phase!=='finished')return;
  try{storage??=globalThis.localStorage;const records=new Map(Object.entries(readScores(state.name,storage)));for(const p of state.players)records.set(p.name,{wins:p.wins,score:p.score});storage.setItem(key(state.name),JSON.stringify(Object.fromEntries(records)));}catch{}
}
