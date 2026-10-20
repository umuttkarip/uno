import {storageKey} from './environment.js';
const KEY=storageKey('uno-history-v1');
const playerKey=name=>String(name??'').trim().toLocaleLowerCase('tr-TR');
function read(storage){try{const data=JSON.parse(storage.getItem(KEY));return data&&typeof data==='object'?data:{};}catch{return {};}}
const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
export function readStats(name,storage){
  try{storage??=globalThis.localStorage;const data=read(storage),key=playerKey(name||data.lastPlayer),record=new Map(Object.entries(data.players??{})).get(key);
  return record&&typeof record==='object'?{name:String(record.name??''),played:count(record.played),wins:count(record.wins),losses:count(record.losses)}:null;}catch{return null;}
}
export function rememberPlayer(name,storage){try{storage??=globalThis.localStorage;const data=read(storage);data.lastPlayer=String(name).trim();storage.setItem(KEY,JSON.stringify(data));}catch{}}
export function recordResult(state,storage){
  if(state?.phase!=='finished'||!state.roundId||!Number.isInteger(state.winner)||!Array.isArray(state.players)||!state.players[state.winner])return false;
  const self=state.players[state.me];if(!self||self.bot)return false;
  try{
    storage??=globalThis.localStorage;
    const data=read(storage),key=playerKey(self.name),receipt=state.roundId+':'+key;
    const seen=new Set(Array.isArray(data.results)?data.results:[]);if(seen.has(receipt))return false;
    const players=new Map(Object.entries(data.players??{})),previous=readStats(self.name,storage)??{};
    const won=state.winner===state.me;
    players.set(key,{name:self.name,played:count(previous.played)+1,wins:count(previous.wins)+(won?1:0),losses:count(previous.losses)+(won?0:1)});
    seen.add(receipt);storage.setItem(KEY,JSON.stringify({lastPlayer:self.name,players:Object.fromEntries(players),results:[...seen].slice(-512)}));return true;
  }catch{return false;}
}
