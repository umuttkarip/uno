import {storageKey,DESIGN_PREVIEW} from './environment.js';
import {roomKey,validName} from './engine.js';

export const RELAY_URL='https://uno-masa-umut.caircon-baus-1525.chatgpt.site/api/v1/';
export const tableSessionKey=room=>storageKey('uno-v8:'+roomKey(room));
const read=key=>{try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}};
const save=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
const erase=key=>{try{sessionStorage.removeItem(key);}catch{}};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class TableConnection {
  constructor(callbacks,{fetch:transport=globalThis.fetch.bind(globalThis),base=RELAY_URL}={}){Object.assign(this,callbacks);this.fetch=transport;this.base=base;this.closed=false;this.controllers=new Set();this.cursor=0;this.version=0;this.seenMessages=new Set();}
  async enter(name,room,{rules='classic'}={}){
    this.name=validName(name);this.room=validName(room,'room');this.storageKey=tableSessionKey(room);
    const previous=read(this.storageKey);this.token=previous?.name===this.name?previous.token:crypto.randomUUID();
    if(!/^[\w-]{20,160}$/.test(this.token??''))this.token=crypto.randomUUID();
    let packet;
    for(let attempt=0;attempt<2;attempt++){try{packet=await this.request('enter',{name:this.name,room:this.room,rules,scope:DESIGN_PREVIEW?'test':'main'});break;}catch(error){if(this.closed||error.status&&error.status<500||attempt===1)throw error;await delay(400);}}
    if(this.closed)return;this.key=packet.key;this.apply(packet);save(this.storageKey,{name:this.name,token:this.token,key:this.key});void this.poll();
  }
  async request(route,body,{poll=false,keepalive=false}={}){
    const controller=new AbortController();if(!keepalive)this.controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),poll?26000:12000);
    try{
      const url=this.base+route+(poll?'?'+new URLSearchParams({key:this.key,after:String(this.cursor),wait:'20000'}):'');
      const response=await this.fetch(url,{method:poll?'GET':'POST',headers:{Authorization:'Bearer '+this.token,...(!poll?{'Content-Type':'application/json'}:{})},...(!poll?{body:JSON.stringify(body)}:{}),signal:controller.signal,keepalive,cache:'no-store'});
      const packet=await response.json();
      if(!response.ok){if(packet.state)this.apply(packet);throw Object.assign(new Error(packet.error??'Bağlantı kurulamadı.'),{status:response.status});}
      return packet;
    }catch(error){if(error.name==='AbortError')throw new Error('Bağlantı kurulamadı. Tekrar dene.');throw error;}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  apply(packet){
    if(this.closed)return;
    for(const message of packet.messages??[]){if(this.seenMessages.has(message.id))continue;this.seenMessages.add(message.id);if(this.seenMessages.size>100)this.seenMessages.delete(this.seenMessages.values().next().value);this.onMessage?.(message);}
    if(!packet.state||packet.cursor<this.cursor||this.hasState&&packet.cursor===this.cursor)return;
    this.hasState=true;
    this.cursor=packet.cursor;this.version=packet.version;this.lastContact=Date.now();this.present=packet.state.players.every(p=>p.online);this.onPresence?.(this.present);this.onState?.(packet);
  }
  async poll(){
    let failures=0;
    while(!this.closed){
      try{const packet=await this.request('state',null,{poll:true});if(this.closed)return;failures=0;this.lastContact=Date.now();if(packet.unchanged)this.onPresence?.(this.present??true);else this.apply(packet);}
      catch(error){
        if(this.closed)return;
        if([401,403,404,410].includes(error.status)){this.finishClose(error.message);return;}
        this.onPresence?.(false);
        if(++failures>=8){this.finishClose('Bağlantı kesildi.');return;}
        await delay(Math.min(5000,500*2**failures));
      }
    }
  }
  async command(route,fields){
    if(this.closed)throw new Error('Bağlantı kesildi.');
    const body={key:this.key,after:this.cursor,id:crypto.randomUUID(),...fields};
    for(let attempt=0;attempt<3;attempt++){
      try{const packet=await this.request(route,body);this.apply(packet);return;}
      catch(error){if(this.closed||error.status&&error.status<500||attempt===2)throw error;await delay(350*(attempt+1));}
    }
  }
  action(command){return this.command('action',{command,version:this.version});}
  message(message){return this.command('message',{message});}
  finishClose(message){this.shutdown();erase(this.storageKey);this.onClose?.(message);}
  leave(){void this.request('leave',{key:this.key},{keepalive:true}).catch(()=>{});this.shutdown();erase(this.storageKey);}
  shutdown(){this.closed=true;for(const controller of this.controllers)controller.abort();this.controllers.clear();}
}
