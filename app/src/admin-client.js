import {DESIGN_PREVIEW} from './environment.js';
export const ADMIN_API='https://uno-masa-umut.caircon-baus-1525.chatgpt.site/admin-api/v1/';
export class AdminBridge {
  constructor(authority,{fetch:transport=globalThis.fetch?.bind(globalThis),enabled=typeof window!=='undefined'}={}){
    this.authority=authority;this.fetch=transport;this.enabled=enabled&&typeof transport==='function';if(!this.enabled)return;
    void this.settings();this.timer=setInterval(()=>void this.settings(),30000);
  }
  async settings(){try{const response=await this.fetch(ADMIN_API+'config',{signal:AbortSignal.timeout(4000)});if(response.ok){const settings=await response.json();for(const key of ['kissWild4','darlingRemove'])if(typeof settings[key]==='boolean')this.authority.features[key]=settings[key];}}catch{}}
  observe(closed=false){
    if(!this.enabled)return;const s=this.authority.state;
    const report={id:this.authority.chatId,reportKey:this.authority.reportKey,name:s.name,scope:DESIGN_PREVIEW?'test':'main',mode:s.mode,rules:s.rules,phase:closed?'closed':s.phase,round:s.round,players:s.players.map(p=>({name:p.name,wins:p.wins}))},signature=JSON.stringify(report);
    if(signature===this.signature)return;this.signature=signature;clearTimeout(this.pending);
    const send=()=>{void this.fetch(ADMIN_API+'rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:signature,keepalive:true,signal:AbortSignal.timeout(4000)}).then(response=>{if(!response.ok)this.signature=null;}).catch(()=>{this.signature=null;});};
    if(closed)send();else this.pending=setTimeout(send,150);
  }
  stop(){clearInterval(this.timer);clearTimeout(this.pending);}
}
