import {storageKey} from './environment.js';

export const CHAT_LIMIT=1000;
export const chatHistoryKey=(roomId,token)=>storageKey('uno-chat-v2:'+JSON.stringify([roomId,token]));
export function chatMessage(item){
  if(!item||typeof item.id!=='string'||typeof item.name!=='string'||typeof item.text!=='string')return null;
  return {id:item.id,name:item.name,text:item.text,emote:!!item.emote,system:!!item.system,at:Number.isFinite(item.at)&&Math.abs(item.at)<=8.64e15?item.at:Date.now()};
}
export class ChatHistory {
  constructor(storage){
    this.key=null;this.items=[];this.ids=new Set();
    try{this.storage=storage??globalThis.localStorage;}catch{}
  }
  bind(roomId,token){
    if(typeof roomId!=='string'||!roomId||typeof token!=='string'||!token)return false;
    const key=chatHistoryKey(roomId,token);if(this.key===key)return false;
    this.key=key;this.items=[];this.ids=new Set();
    try{const saved=JSON.parse(this.storage.getItem(key));if(Array.isArray(saved))this.merge(saved,false);}catch{}
    return true;
  }
  clear(){
    try{if(this.key)this.storage.removeItem(this.key);}catch{}
    this.key=null;this.items=[];this.ids.clear();
  }
  merge(messages,persist=true){
    const added=[];
    for(const message of messages){const item=chatMessage(message);if(!item||this.ids.has(item.id))continue;this.ids.add(item.id);this.items.push(item);added.push(item);}
    this.items.sort((a,b)=>a.at-b.at);
    if(this.items.length>CHAT_LIMIT){this.items=this.items.slice(-CHAT_LIMIT);this.ids=new Set(this.items.map(item=>item.id));}
    if(persist&&added.length&&this.key)try{this.storage.setItem(this.key,JSON.stringify(this.items));}catch{}
    return added;
  }
}
