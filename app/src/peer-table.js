import Peer from 'peerjs';
import {storageKey,TABLE_PEER_PREFIX} from './environment.js';
import {roomKey,validName} from './engine.js';
import {RoomAuthority,IDLE_LIMIT} from './room.js';
import {SocketBus} from './socket-bus.js';
const read=(key,storage)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
const save=(key,value,storage)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
const erase=(key,storage)=>{try{storage.removeItem(key);}catch{}};
const ICE={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]};
export const tableSessionKey=room=>storageKey('uno-v9:'+roomKey(room));
export class TableConnection {
  constructor(callbacks,{Peer:PeerType=Peer,Bus=SocketBus,now=Date.now,commandTimeout=2500,storage=globalThis.sessionStorage}={}){Object.assign(this,callbacks,{PeerType,Bus,now,commandTimeout,storage});this.closed=false;this.links=new Map();this.pending=new Map();this.receipts=new Map();this.seenMessages=new Set();this.sequence=0;this.lastSequence=-1;this.reconnects=0;this.version=0;this.nodeId=crypto.randomUUID();this.epoch=crypto.randomUUID();}
  async enter(name,room,{rules='classic'}={}){
    this.name=validName(name);this.room=validName(room,'room');this.rules=rules;this.storageKey=tableSessionKey(room);
    const previous=read(this.storageKey,this.storage),identity=previous?.name===this.name?previous:null,savedAt=identity?.saved?.lastActive??identity?.at;this.previous=identity&&this.now()-savedAt<IDLE_LIMIT?identity:null;this.token=identity?.token??crypto.randomUUID();if(!/^[\w-]{20,80}$/.test(this.token))this.token=crypto.randomUUID();
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(roomKey(room)));this.hostId=TABLE_PEER_PREFIX+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    const entry=new Promise((resolve,reject)=>{this.resolveEntry=resolve;this.rejectEntry=reject;this.entryTimer=setTimeout(()=>this.fail('Bağlantı kurulamadı. Tekrar dene.'),14000);});
    this.bus=new this.Bus({topic:'uno/'+this.hostId,onMessage:message=>this.busMessage(message),onReady:()=>{if(this.host===false)this.joinHost();else if(this.host===undefined)this.bus.send({from:this.nodeId,to:this.hostId,data:{type:'discover'}});},onOffline:()=>{if(this.host===false&&!this.conn?.open)this.presence(false);}});this.bus.start();
    this.clock=setInterval(()=>this.tick(),1000);if(this.previous?.host===false)this.becomeGuest();else this.claim();
    this.restore=()=>{if(this.closed)return;this.reconnectSignaling();if(this.host===false){this.joinHost();this.connectHost();}};
    globalThis.window?.addEventListener('online',this.restore);globalThis.window?.addEventListener('pageshow',this.restore);globalThis.document?.addEventListener('visibilitychange',this.restore);
    return entry;
  }
  makePeer(id){const peer=new this.PeerType(id,{debug:0,config:ICE});peer.on('disconnected',()=>{if(this.peer===peer)this.reconnectSignaling();});return this.peer=peer;}
  claim(){
    if(this.closed)return;const peer=this.makePeer(this.hostId);
    peer.on('open',()=>{
      if(this.closed||peer!==this.peer)return;this.host=true;const saved=this.previous?.host?this.previous.saved:null;
      this.authority=new RoomAuthority(this.room,this.name,this.token,{saved,mode:'group',rules:this.rules});
      for(const receipt of this.previous?.receipts??[])this.receipts.set(receipt.id,receipt);
      peer.on('connection',conn=>this.accept(conn));this.publish();this.finishEntry();
    });
    peer.on('error',error=>{
      if(this.closed||peer!==this.peer)return;
      if(error.type==='unavailable-id'&&this.host!==true){peer.destroy();if(this.previous?.host&&this.reconnects++<3)this.claimTimer=setTimeout(()=>this.claim(),350);else this.becomeGuest();}
      else if(!['network','socket-error','socket-closed'].includes(error.type))this.fail('Bağlantı kurulamadı. Tekrar dene.');else this.reconnectSignaling();
    });
  }
  becomeGuest(){
    if(this.closed)return;this.host=false;this.peer?.destroy();this.joinHost();const peer=this.makePeer(undefined);
    peer.on('open',()=>this.connectHost());peer.on('error',()=>{if(!this.closed&&this.peer===peer)this.reconnectSignaling();});
  }
  connectHost(){
    if(this.closed||this.host!==false||!this.peer?.open||this.connecting||this.conn?.open||this.now()<(this.nextDirectAt??0))return;
    this.connecting=true;const conn=this.conn=this.peer.connect(this.hostId,{reliable:true,serialization:'json',metadata:{nodeId:this.nodeId}});
    this.connectTimer=setTimeout(()=>{if(this.conn===conn&&!conn.open){this.connecting=false;conn.close();this.conn=null;}},4500);
    conn.on('open',()=>{if(this.closed||this.conn!==conn)return;clearTimeout(this.connectTimer);this.connecting=false;this.forceSocket=false;this.joinHost();});
    conn.on('data',data=>{if(this.conn===conn)this.receive(data);});
    const lost=()=>{if(this.closed||this.conn!==conn)return;clearTimeout(this.connectTimer);this.conn=null;this.connecting=false;if(!this.bus.ready)this.presence(false);};conn.on('close',lost);conn.on('error',lost);
  }
  joinHost(){if(this.closed||this.host!==false)return;this.sendHost({type:'join',name:this.name,token:this.token,nodeId:this.nodeId,recover:!!this.forceSocket});}
  recover(){this.forceSocket=true;this.nextDirectAt=this.now()+10000;const old=this.conn;this.conn=null;this.connecting=false;old?.close();this.joinHost();}
  sendHost(data){if(this.conn?.open&&this.send(this.conn,data))return true;return this.bus?.send({from:this.nodeId,to:this.hostId,data});}
  sendLink(link,data){if(link.direct?.open&&this.send(link.direct,data))return true;return this.bus?.send({from:this.hostId,to:link.nodeId,data});}
  send(conn,data){try{if(!conn?.open)return false;conn.send(data);return true;}catch{return false;}}
  busMessage(message){if(this.closed||!message?.data)return;if(this.host&&message.to===this.hostId)this.hostMessage(message.data,{nodeId:message.from});else if(message.to===this.nodeId&&message.from===this.hostId){if(this.host===undefined&&message.data.type==='host')this.becomeGuest();else if(this.host===false)this.receive(message.data);}}
  accept(conn){
    let token;conn.on('data',data=>{if(this.closed)return;if(data?.type==='join')token=data.token;if(token)this.hostMessage(data,{nodeId:conn.metadata?.nodeId,direct:conn,token});});
    const lost=()=>{const link=this.links.get(token);if(this.closed||link?.direct!==conn)return;link.direct=null;if(!this.bus.ready){link.seen=0;this.publish();}};conn.on('close',lost);conn.on('error',lost);
  }
  hostMessage(data,source){
    if(!this.authority||!this.valid(data))return;let link,index;
    try{
      if(data.type==='discover'){this.bus.send({from:this.hostId,to:source.nodeId,data:{type:'host'}});return;}
      if(data.type==='pulse'&&!this.links.has(data.token)){const player=this.authority.state.players.find((p,i)=>i>0&&p.token===data.token);if(player)return this.hostMessage({...data,type:'join',name:player.name},source);}
      if(data.type==='join'){
        index=this.authority.join(data.name,data.token);if(index===0)throw Error('Bu oyuncu başka bir sekmede açık.');
        link=this.links.get(data.token)??{};if(link.nodeId!==source.nodeId||data.recover){const old=link.direct;link.direct=null;old?.close();}Object.assign(link,{token:data.token,nodeId:source.nodeId,seen:this.now()});if(source.direct)link.direct=source.direct;this.links.set(data.token,link);this.publish();return;
      }
      const token=source.token??data.token;link=this.links.get(token);if(!link||link.nodeId!==source.nodeId)return;link.seen=this.now();index=this.authority.state.players.findIndex(p=>p.token===token);if(index<1)return;
      if(data.type==='pulse'){this.sendLink(link,{type:'pulse'});return;}
      if(data.type==='leave'){
        if(this.authority.state.phase==='waiting'){this.authority.state.players.splice(index,1);this.links.delete(token);for(const p of this.authority.state.players)p.ready=false;this.authority.revision++;this.publish();}
        else this.finishClose('Masa kapandı.',true);return;
      }
      if(typeof data.id!=='string')return;
      const receipt=this.receipts.get(token+':'+data.id);if(receipt){this.sendState(link,data.id);return;}
      if(data.type==='action'){if(!this.allPresent())throw Error('Oyuncu bekleniyor.');this.authority.play(index,data.command,data.version);}
      else if(data.type==='message'){const message=this.authority.message(index,data.message);this.deliverMessage(message);for(const other of this.links.values())this.sendLink(other,{type:'message',message});}
      else return;
      const id=token+':'+data.id;this.receipts.set(id,{id});if(this.receipts.size>100)this.receipts.delete(this.receipts.keys().next().value);
      this.publish(data.id,token);
    }catch(error){link??={nodeId:source.nodeId,direct:source.direct};if(link.token)this.sendState(link);this.sendLink(link,{type:'error',ack:data.id,message:error.message});}
  }
  allPresent(){return this.authority.state.players.every((p,i)=>i===0||this.now()-(this.links.get(p.token)?.seen??-Infinity)<6500);}
  syncPresence(){const s=this.authority.state;let changed=false;for(let i=0;i<s.players.length;i++){const online=i===0||this.now()-(this.links.get(s.players[i].token)?.seen??-Infinity)<6500;if(s.players[i].online!==online){s.players[i].online=online;changed=true;}}this.joined=this.allPresent();if(this.joined)this.authority.resumeTurn();else this.authority.pauseTurn();this.presence(this.joined);return changed;}
  presence(online){this.present=online;this.onPresence?.(online);}
  sendState(link,ack){const index=this.authority.state.players.findIndex(p=>p.token===link.token);if(index<1)return;this.sendLink(link,{type:'state',...this.authority.snapshot(index),sequence:this.sequence,epoch:this.epoch,...(ack?{ack}:{})});}
  publish(ack,token){
    if(this.closed)return;this.syncPresence();this.sequence++;const own={...this.authority.snapshot(0),sequence:this.sequence,epoch:this.epoch};this.version=own.version;this.lastSnapshot=own;this.onState?.(own);
    for(const link of this.links.values())this.sendState(link,link.token===token?ack:null);this.saveHost();
  }
  receive(data){
    if(this.closed||!this.valid(data))return;this.lastHostSeen=this.now();
    if(data.type==='state'){
      if(data.ack)this.settle(data.ack);if(data.epoch===this.hostEpoch&&data.sequence<=this.lastSequence)return;
      this.hostEpoch=data.epoch;this.lastSequence=data.sequence;this.joined=true;this.version=data.version;this.lastSnapshot=data;this.presence(data.state.players.every(p=>p.online));
      save(this.storageKey,{name:this.name,token:this.token,host:false,at:this.now()},this.storage);this.onState?.(data);this.finishEntry();
    }else if(data.type==='message')this.deliverMessage(data.message);
    else if(data.type==='error'){if(data.ack)this.settle(data.ack,data.message);else if(this.rejectEntry)this.fail(data.message);else this.onError?.(data.message);}
    else if(data.type==='leave')this.finishClose(data.message??'Masa kapandı.');
  }
  deliverMessage(message){if(!message||this.seenMessages.has(message.id))return;this.seenMessages.add(message.id);if(this.seenMessages.size>100)this.seenMessages.delete(this.seenMessages.values().next().value);this.onMessage?.(message);}
  async action(command){if(this.closed||!this.joined)throw Error('Bağlantı yenileniyor.');if(this.host){this.authority.play(0,command,this.version);this.publish();}else return this.command({type:'action',command,version:this.version});}
  async message(message){if(this.closed||!this.joined)throw Error('Bağlantı yenileniyor.');if(this.host){const item=this.authority.message(0,message);this.deliverMessage(item);for(const link of this.links.values())this.sendLink(link,{type:'message',message:item});this.saveHost();}else return this.command({type:'message',message});}
  command(data){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.settle(id,'Bağlantı yenileniyor.');this.presence(false);this.recover();},this.commandTimeout);this.pending.set(id,{resolve,reject,timer});if(!this.sendHost({...data,id,token:this.token})){this.settle(id,'Bağlantı yenileniyor.');this.recover();}});}
  settle(id,error){const pending=this.pending.get(id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(id);error?pending.reject(Error(error)):pending.resolve();}
  tick(){
    if(this.closed)return;
    if(this.host){if(this.authority.expired()){this.finishClose('Masa kapandı.',true);return;}const changed=this.syncPresence(),turn=this.joined&&this.authority.expireTurn();if(changed||turn)this.publish();for(const link of this.links.values())this.sendLink(link,{type:'pulse'});}
    else if(this.host===false){if(this.joined&&this.now()-this.lastHostSeen>3500)this.recover();else if(!this.joined)this.joinHost();else this.sendHost({type:'pulse',token:this.token});if(this.joined&&this.now()-this.lastHostSeen>6500)this.presence(false);this.connectHost();}
    this.reconnectSignaling();
  }
  reconnectSignaling(){if(this.closed||!this.peer?.disconnected||this.peer.destroyed||this.signalTimer)return;this.signalTimer=setTimeout(()=>{this.signalTimer=null;try{this.peer?.reconnect();}catch{}},750);}
  saveHost(){save(this.storageKey,{name:this.name,token:this.token,host:true,saved:this.authority.checkpoint(),receipts:[...this.receipts.values()]},this.storage);}
  valid(data){try{return data&&typeof data==='object'&&JSON.stringify(data).length<1048576;}catch{return false;}}
  finishEntry(){clearTimeout(this.entryTimer);this.resolveEntry?.();this.resolveEntry=null;this.rejectEntry=null;}
  fail(message){if(this.closed)return;const reject=this.rejectEntry;this.rejectEntry=null;this.resolveEntry=null;this.shutdown();if(reject)reject(Error(message));else this.onClose?.(message);}
  finishClose(message,broadcast=false){if(broadcast)for(const link of this.links.values())this.sendLink(link,{type:'leave',message});this.shutdown();erase(this.storageKey,this.storage);this.onClose?.(message);}
  leave(){if(this.host){for(const link of this.links.values())this.sendLink(link,{type:'leave',message:'Masa kapandı.'});}else this.sendHost({type:'leave',token:this.token});this.shutdown();erase(this.storageKey,this.storage);}
  shutdown(){if(this.closed)return;this.closed=true;for(const key of ['clock','entryTimer','connectTimer','signalTimer','claimTimer'])clearInterval(this[key]);for(const id of this.pending.keys())this.settle(id,'Bağlantı kesildi.');this.bus?.close();for(const link of this.links.values())link.direct?.close();this.conn?.close();this.peer?.destroy();globalThis.window?.removeEventListener('online',this.restore);globalThis.window?.removeEventListener('pageshow',this.restore);globalThis.document?.removeEventListener('visibilitychange',this.restore);}
}
