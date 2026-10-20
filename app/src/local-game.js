import {RoomAuthority,IDLE_LIMIT} from './room.js';
import {botCommand} from './bot.js';
import {validName} from './engine.js';
import {storageKey} from './environment.js';
export class LocalGame {
  constructor(callbacks){Object.assign(this,callbacks);this.closed=false;}
  async enter(name,roomName,{rules='classic'}={}){
    this.name=validName(name);this.storageKey=storageKey(rules==='special'?'uno-solo-special-v1':'uno-solo-v1');const room='bilgisayar:'+this.name;
    let saved;try{const previous=JSON.parse(sessionStorage.getItem(this.storageKey));if(previous?.name===this.name&&Date.now()-previous.saved.lastActive<IDLE_LIMIT)saved=previous.saved;}catch{}
    const token=saved?.state.players[0].token??crypto.randomUUID();
    this.authority=new RoomAuthority(room,this.name,token,{saved,mode:'computer',rules});
    if(!saved){const botName=this.name.toLocaleLowerCase('tr-TR')==='bilgisayar'?'Bilgisayar 2':'Bilgisayar';this.authority.join(botName,crypto.randomUUID());this.authority.state.players[1].bot=true;}
    this.onPresence?.(true);this.publish();
    this.clock=setInterval(()=>{if(this.closed)return;if(this.authority.expired()){this.leave();this.onClose?.('Masa kapandı.');return;}if(this.presentation)return;const uno=this.authority.expireUno(),turn=this.authority.expireTurn();if(uno||turn)this.publish();this.schedule();},250);
  }
  save(){try{sessionStorage.setItem(this.storageKey,JSON.stringify({name:this.name,saved:this.authority.checkpoint()}));}catch{}}
  publish(){
    if(this.closed)return;
    clearTimeout(this.botTimer);this.botTimer=null;
    const snapshot=this.authority.snapshot(0);this.version=snapshot.version;
    // The local clock and bot wait until the player has actually seen this move.
    this.presentation={version:snapshot.version,started:this.authority.now()};
    this.save();this.onState(snapshot);
  }
  presented(version){
    if(this.closed||this.presentation?.version!==version)return;
    const now=this.authority.now(),elapsed=Math.max(0,now-this.presentation.started),s=this.authority.state;
    if(s.turnDeadline)s.turnDeadline+=elapsed;
    if(s.unoDeadline)s.unoDeadline+=elapsed;
    this.presentation=null;this.save();this.schedule();
    return {turnDeadline:s.turnDeadline,unoDeadline:s.unoDeadline,serverNow:now};
  }
  schedule(){
    if(this.closed||this.presentation||this.botTimer)return;
    const s=this.authority.state;
    const ready=s.phase==='finished'&&s.players[0].ready&&!s.players[1].ready;
    if(!ready&&!(s.phase==='playing'&&s.turn===1))return;
    const delay=750+Math.random()*350;
    this.botTimer=setTimeout(()=>{this.botTimer=null;if(this.closed)return;const command=botCommand(this.authority.snapshot(1).state,1);if(command){try{this.authority.play(1,command,this.authority.revision);this.publish();}catch(error){this.onError?.(error.message);}}},delay);
  }
  async action(command){if(this.closed)throw new Error('Oyun kapandı.');if(this.presentation)throw new Error('Kartlar yerleşiyor.');this.authority.play(0,command,this.version);this.publish();}
  async message(payload){if(this.closed)return;this.onMessage(this.authority.message(0,payload));}
  shutdown(){this.closed=true;clearInterval(this.clock);clearTimeout(this.botTimer);}
  leave(){this.shutdown();try{sessionStorage.removeItem(this.storageKey);}catch{}}
}
