import {RoomAuthority,IDLE_LIMIT} from './room.js';
import {botCommand} from './bot.js';
import {validName} from './engine.js';
import {readScores,saveScores} from './scores.js';
export class LocalGame {
  constructor(callbacks){Object.assign(this,callbacks);this.closed=false;}
  async enter(name){
    this.name=validName(name);this.storageKey='uno-solo-v1';const room='bilgisayar:'+this.name;
    let saved;try{const previous=JSON.parse(sessionStorage.getItem(this.storageKey));if(previous?.name===this.name&&Date.now()-previous.saved.lastActive<IDLE_LIMIT)saved=previous.saved;}catch{}
    const token=saved?.state.players[0].token??crypto.randomUUID();
    this.authority=new RoomAuthority(room,this.name,token,{saved,mode:'computer',scores:readScores(room)});
    if(!saved){const botName=this.name.toLocaleLowerCase('tr-TR')==='bilgisayar'?'Bilgisayar 2':'Bilgisayar';this.authority.join(botName,crypto.randomUUID());this.authority.state.players[1].bot=true;}
    this.onPresence?.(true);this.publish();
    this.clock=setInterval(()=>{if(this.closed)return;if(this.authority.expired()){this.leave();this.onClose?.('Masa kapandı.');return;}const uno=this.authority.expireUno(),turn=this.authority.expireTurn();if(uno||turn)this.publish();this.schedule();},250);
  }
  publish(){if(this.closed)return;clearTimeout(this.botTimer);this.botTimer=null;const snapshot=this.authority.snapshot(0);this.version=snapshot.version;this.onState(snapshot);saveScores(snapshot.state);try{sessionStorage.setItem(this.storageKey,JSON.stringify({name:this.name,saved:this.authority.checkpoint()}));}catch{}this.schedule();}
  schedule(){
    if(this.closed||this.botTimer)return;
    const s=this.authority.state;
    const ready=s.phase==='finished'&&s.players[0].ready&&!s.players[1].ready;
    if(!ready&&!(s.phase==='playing'&&s.turn===1))return;
    const delay=Math.max(750+Math.random()*350,s.vulnerable===0&&s.unoDeadline?s.unoDeadline-Date.now()+100:0);
    this.botTimer=setTimeout(()=>{this.botTimer=null;if(this.closed)return;const command=botCommand(this.authority.snapshot(1).state,1);if(command){try{this.authority.play(1,command,this.authority.revision);this.publish();}catch(error){this.onError?.(error.message);}}},delay);
  }
  async action(command){if(this.closed)throw new Error('Oyun kapandı.');this.authority.play(0,command,this.version);this.publish();}
  async message(payload){if(this.closed)return;this.onMessage(this.authority.message(0,payload));}
  shutdown(){this.closed=true;clearInterval(this.clock);clearTimeout(this.botTimer);}
  leave(){this.shutdown();try{sessionStorage.removeItem(this.storageKey);}catch{}}
}
