import Peer from 'peerjs';
import {roomKey,validName} from './engine.js';
import {RoomAuthority,IDLE_LIMIT} from './room.js';
import {readScores,saveScores} from './scores.js';
const read=key=>{try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
const erase=key=>{try{sessionStorage.removeItem(key);}catch{}};

export class TableConnection {
  constructor(callbacks){Object.assign(this,callbacks);this.pending=new Map();this.connections=new Map();this.closed=false;this.version=0;this.reconnects=0;}
  async enter(name,room){
    this.name=validName(name);this.room=validName(room,'room');this.capacity=6;this.key=roomKey(room);this.storageKey='uno-v6:'+this.key;
    const previous=read(this.storageKey);this.token=previous?.name===this.name?previous.token:crypto.randomUUID();
    this.saved=previous?.name===this.name&&previous.host&&previous.saved.state.mode==='group'&&Date.now()-previous.saved.lastActive<IDLE_LIMIT?previous.saved:null;
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(this.key));
    this.hostId='umut-uno-v6-'+Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,48);
    return new Promise((resolve,reject)=>{this.resolveEntry=resolve;this.rejectEntry=reject;this.entryTimer=setTimeout(()=>this.fail('Bağlantı kurulamadı. Tekrar dene.'),25000);this.claim();});
  }
  claim(){
    if(this.closed)return;const peer=this.peer=new Peer(this.hostId,{debug:0});
    peer.on('open',()=>{if(this.closed)return;this.host=true;this.authority=new RoomAuthority(this.room,this.name,this.token,{saved:this.saved,capacity:this.capacity,mode:'group',scores:readScores(this.room)});this.authority.pauseTurn();peer.on('connection',conn=>this.accept(conn));this.publish();this.finishEntry();this.startClock();});
    peer.on('error',error=>{if(this.closed||this.peer!==peer)return;if(error.type==='unavailable-id'&&!this.host){peer.destroy();this.becomeGuest();}else this.peerError(error);});
    peer.on('disconnected',()=>this.reconnectSignaling(peer));
  }
  becomeGuest(){
    if(this.closed)return;this.host=false;const peer=this.peer=new Peer({debug:0});
    peer.on('open',()=>this.connectHost());peer.on('error',error=>{if(this.closed||this.peer!==peer)return;if(error.type==='peer-unavailable')this.retryHost();else this.peerError(error);});peer.on('disconnected',()=>this.reconnectSignaling(peer));
  }
  connectHost(){
    if(this.closed||!this.peer?.open)return;const conn=this.conn=this.peer.connect(this.hostId,{reliable:true,serialization:'json'});
    const timeout=setTimeout(()=>{if(this.conn===conn&&!this.joined){conn.close();this.retryHost();}},10000);
    conn.on('open',()=>this.send(conn,{type:'join',name:this.name,token:this.token}));
    conn.on('data',data=>{
      if(this.closed||this.conn!==conn||!this.validPacket(data))return;
      if(data.type==='state'){
        clearTimeout(timeout);if(!this.joined){this.joined=true;this.reconnects=0;this.finishEntry();this.startClock();}
        this.lastSnapshot=data;this.version=data.version;this.lastActivity=Date.now();this.onPresence?.(data.state.players.every(p=>p.online));this.saveGuest();this.onState(data);saveScores(data.state);if(data.ack)this.settle(data.ack);
      }else if(data.type==='message'){this.lastActivity=Date.now();this.onMessage(data.message);if(data.ack)this.settle(data.ack);}
      else if(data.type==='error'){if(data.ack)this.settle(data.ack,data.message);else if(!this.joined)this.fail(data.message);else this.onError(data.message);}
      else if(data.type==='leave')this.finishClose('Masa kapandı.');
    });
    conn.on('close',()=>{clearTimeout(timeout);if(this.closed||this.conn!==conn)return;this.joined=false;this.onPresence?.(false);this.retryHost();});
    conn.on('error',()=>{clearTimeout(timeout);if(!this.closed&&this.conn===conn)this.retryHost();});
  }
  allPresent(){return this.authority.state.players.every((p,i)=>i===0||p.bot||this.connections.get(i)?.open);}
  syncPresence(){
    const s=this.authority.state;s.players.forEach((p,i)=>p.online=i===0||!!p.bot||!!this.connections.get(i)?.open);
    this.joined=this.allPresent();if(this.joined){clearTimeout(this.offlineTimer);this.authority.resumeTurn();}else this.authority.pauseTurn();
    this.onPresence?.(this.joined);
  }
  accept(conn){
    let index=null;const timeout=setTimeout(()=>{if(index===null)conn.close();},10000);
    conn.on('data',data=>{
      if(this.closed||!this.validPacket(data))return;
      try{
        if(data.type==='join'){
          if(index!==null)return;const seat=this.authority.join(data.name,data.token);if(seat===0)throw new Error('Bu oyuncu başka bir sekmede açık.');index=seat;clearTimeout(timeout);
          const old=this.connections.get(index);this.connections.set(index,conn);if(old&&old!==conn)old.close();this.publish();
        }else if(index!==null&&this.connections.get(index)===conn){
          if(data.type==='action'){if(!this.allPresent())throw new Error('Oyuncu bekleniyor.');this.authority.play(index,data.command,data.version);this.publish(data.id,index);}
          else if(data.type==='message'){const message=this.authority.message(index,data.message);this.onMessage(message);this.broadcast({type:'message',message},data.id,index);this.saveHost();}
          else if(data.type==='leave'){this.broadcast({type:'leave'});this.finishClose();}
          else if(data.type==='ping')this.send(conn,{type:'pong'});
        }
      }catch(error){this.send(conn,{type:'error',message:error.message,ack:data.id});if(index===null)setTimeout(()=>conn.close(),150);else this.publish();}
    });
    conn.on('close',()=>{
      clearTimeout(timeout);if(this.closed||index===null||this.connections.get(index)!==conn)return;
      this.connections.delete(index);this.publish();clearTimeout(this.offlineTimer);this.offlineTimer=setTimeout(()=>{if(!this.allPresent()){this.broadcast({type:'leave'});this.finishClose('Bağlantı kesildi.');}},30000);
    });conn.on('error',()=>{});
  }
  broadcast(data,ack,ackIndex){for(const [index,conn]of this.connections)this.send(conn,{...data,...(index===ackIndex&&ack?{ack}:{})});}
  publish(ack,ackIndex){
    if(this.closed)return;this.syncPresence();const own=this.authority.snapshot(0);this.version=own.version;this.lastSnapshot=own;this.onState(own);
    for(const [index,conn]of this.connections)this.send(conn,{type:'state',...this.authority.snapshot(index),...(index===ackIndex&&ack?{ack}:{})});
    saveScores(own.state);this.saveHost();
  }
  async action(command){if(this.closed||!this.joined)throw new Error('Bağlantı kesildi.');if(this.host){this.authority.play(0,command,this.version);this.publish();}else return this.command({type:'action',command,version:this.version});}
  async message(message){if(this.closed||(this.host?!this.connections.size:!this.joined))throw new Error('Bağlantı kesildi.');if(this.host){const event=this.authority.message(0,message);this.onMessage(event);this.broadcast({type:'message',message:event});this.saveHost();}else return this.command({type:'message',message});}
  command(payload){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Yanıt alınamadı.'));},10000);this.pending.set(id,{resolve,reject,timer});if(!this.send(this.conn,{...payload,id}))this.settle(id,'Bağlantı kesildi.');});}
  settle(id,error){const p=this.pending.get(id);if(!p)return;clearTimeout(p.timer);this.pending.delete(id);error?p.reject(new Error(error)):p.resolve();}
  validPacket(data){try{return data&&typeof data==='object'&&JSON.stringify(data).length<25000;}catch{return false;}}
  send(conn,data){try{if(!conn?.open)return false;conn.send(data);return true;}catch{return false;}}
  finishEntry(){clearTimeout(this.entryTimer);this.resolveEntry?.();this.resolveEntry=null;this.rejectEntry=null;}
  saveHost(){write(this.storageKey,{name:this.name,token:this.token,host:true,saved:this.authority.checkpoint()});}
  saveGuest(){write(this.storageKey,{name:this.name,token:this.token,host:false});}
  retryHost(){if(this.closed||this.retryTimer)return;if(++this.reconnects>8){this.fail('Masa bağlantısı kesildi.');return;}this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.connectHost();},1500);}
  reconnectSignaling(peer){setTimeout(()=>{if(!this.closed&&this.peer===peer&&peer.disconnected&&!peer.destroyed){try{peer.reconnect();}catch{this.fail('Bağlantı kesildi.');}}},2000);}
  peerError(error){if(this.joined&&['network','socket-error','socket-closed'].includes(error.type))return;this.fail('Bağlantı kurulamadı. Tekrar dene.');}
  startClock(){if(this.clock)return;this.lastActivity=Date.now();this.clock=setInterval(()=>{if(this.closed)return;if(this.host?this.authority.expired():Date.now()-this.lastActivity>=IDLE_LIMIT){if(this.host)this.broadcast({type:'leave'});else this.send(this.conn,{type:'leave'});this.finishClose();}else if(this.host&&this.joined){const uno=this.authority.expireUno(),turn=this.authority.expireTurn();if(uno||turn)this.publish();}},250);}
  fail(message){if(this.closed)return;const reject=this.rejectEntry;this.rejectEntry=null;this.resolveEntry=null;this.shutdown();if(reject)reject(new Error(message));else this.onClose?.(message);}
  finishClose(message){if(this.closed)return;this.shutdown();erase(this.storageKey);this.onClose?.(message);}
  leave(){if(this.host)this.broadcast({type:'leave'});else this.send(this.conn,{type:'leave'});this.shutdown();erase(this.storageKey);}
  shutdown(){this.closed=true;clearTimeout(this.entryTimer);clearTimeout(this.retryTimer);clearTimeout(this.offlineTimer);clearInterval(this.clock);for(const id of this.pending.keys())this.settle(id,'Bağlantı kesildi.');for(const conn of this.connections.values())conn.close();this.connections.clear();this.conn?.close();this.peer?.destroy();}
}
