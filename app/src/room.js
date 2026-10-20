import {act, newPlayer, newRoom, startRound, validName, view,penalizeUno} from './engine.js';

export const IDLE_LIMIT = 20 * 60 * 1000;
export const TURN_DURATION = 30 * 1000;
export const UNO_DURATION = 2500;
export const EMOTES = ['😂', '😭', '😏', '😡', '😮', '❤️', '👏', '💀', 'seal', 'seal-tongue', 'seal-happy', 'seal-cry', 'seal-scream', 'seal-kiss', 'seal-sulk', 'seal-smug'];

export class RoomAuthority {
  constructor(room, name, token, {now = Date.now, saved,capacity=2,mode='online'} = {}) {
    this.now = now;
    this.state = saved?.state ?? newRoom(room, newPlayer(name, token),{capacity,mode});
    if(this.state.round>0)this.state.roundId??=crypto.randomUUID();
    this.revision = saved?.revision ?? 0;
    this.lastActive = saved?.lastActive ?? now();
    this.lastMessages = new Map();
    this.remaining = saved?.remaining ?? null;
    this.state.turnDeadline ??= null;
    this.state.pendingDraw ??= null;
    this.state.unoDeadline ??= null;
    this.unoRemaining=saved?.unoRemaining??null;
  }

  join(name, token) {
    validName(name);
    if (typeof token !== 'string' || !/^[\w-]{20,80}$/.test(token)) throw new Error('Oturum geçersiz.');
    if (this.expired()) throw new Error('Masa kapandı.');
    const existing = this.state.players.findIndex(p => p.token === token);
    if (existing >= 0) {
      if (this.state.players[existing].name !== name.trim()) throw new Error('Oyuncu adı değişmiş.');
      this.touch();
      return existing;
    }
    if (this.state.players.length >= this.state.capacity) throw new Error('Masa dolu.');
    if (this.state.phase!=='waiting') throw new Error('Bu masada oyun başladı.');
    if (this.state.players.some(p=>name.trim().toLocaleLowerCase('tr-TR') === p.name.toLocaleLowerCase('tr-TR'))) throw new Error('Farklı bir ad yaz.');
    const player=newPlayer(name, token);this.state.players.push(player);
    if(this.state.mode!=='group'&&this.state.players.length===this.state.capacity){startRound(this.state);this.restartTurn();}
    this.revision++;
    this.touch();
    return this.state.players.length-1;
  }

  play(index, command, revision) {
    if (this.expired()) throw new Error('Masa kapandı.');
    if (this.expireTurn()) return false;
    if (this.expireUno()) return false;
    if(command?.type==='ready'&&command.round!==undefined&&command.round!==this.state.round)throw new Error('Bu el sona erdi.');
    const sameRoundReady=command?.type==='ready'&&command.round===this.state.round&&(this.state.phase==='finished'||(this.state.phase==='waiting'&&this.state.mode==='group'));
    if (revision !== this.revision&&!sameRoundReady) throw new Error('Tekrar dene.');
    if (!['play','draw','pass','uno','catch','ready'].includes(command?.type)) throw new Error('Geçersiz hamle.');
    act(this.state, index, command);
    if(this.state.vulnerable!==null&&!this.state.unoDeadline)this.state.unoDeadline=this.now()+UNO_DURATION;
    if (!['uno','catch'].includes(command.type)) this.restartTurn();
    this.state.players[index].seen = this.now();
    this.revision++;
    if(!this.state.players[index].bot)this.touch();
  }

  message(index, {text, emote}) {
    if (!this.state.players[index] || this.expired()) throw new Error('Masa kapandı.');
    if (this.lastMessages.has(index) && this.now() - this.lastMessages.get(index) < 650) throw new Error('Biraz bekle.');
    if (emote && !EMOTES.includes(emote)) throw new Error('Geçersiz ifade.');
    if (!emote && (typeof text !== 'string' || !text.trim() || [...text.trim()].length > 120)) throw new Error('Mesaj 1–120 karakter olmalı.');
    this.lastMessages.set(index, this.now());
    this.touch();
    return {id: crypto.randomUUID(), player: index, text: emote || text.trim().replace(/[\x00-\x1f]/g, ' '), emote: !!emote};
  }

  restartTurn() {this.state.turnDeadline = this.state.phase === 'playing' ? this.now() + TURN_DURATION : null; this.remaining = null;}
  pauseTurn() {
    if(this.state.unoDeadline){this.unoRemaining=Math.max(250,this.state.unoDeadline-this.now());this.state.unoDeadline=null;}
    if (this.state.phase !== 'playing' || !this.state.turnDeadline) return;
    this.remaining = Math.max(1000, this.state.turnDeadline - this.now());
    this.state.turnDeadline = null;
  }
  resumeTurn() {
    if(this.unoRemaining!==null&&this.state.vulnerable!==null){this.state.unoDeadline=this.now()+this.unoRemaining;this.unoRemaining=null;}
    if (this.state.phase !== 'playing' || this.state.turnDeadline) return;
    this.state.turnDeadline = this.now() + Math.max(5000, this.remaining ?? TURN_DURATION);
    this.remaining = null;
  }
  expireTurn() {
    const s = this.state;
    if (this.expired() || s.phase !== 'playing' || !s.turnDeadline || this.now() < s.turnDeadline) return false;
    const index = s.turn;
    if (s.drawnId) act(s,index,{type:'pass'});
    else {
      act(s,index,{type:'draw'});
      if (s.drawnId) act(s,index,{type:'pass'});
    }
    s.lastMove = {type:'timeout',player:index,seq:s.seq};
    this.revision++;
    this.restartTurn();
    return true;
  }
  expireUno() {
    const s=this.state;
    if(this.expired()||s.phase!=='playing'||!s.unoDeadline||this.now()<s.unoDeadline)return false;
    const changed=penalizeUno(s);if(changed)this.revision++;
    return changed;
  }
  snapshot(index) {return {state: structuredClone(view(this.state, index)), version: this.revision, serverNow:this.now()};}
  checkpoint() {return {state: this.state, revision: this.revision, lastActive: this.lastActive, remaining:this.remaining,unoRemaining:this.unoRemaining};}
  touch() {this.lastActive = this.now();}
  expired() {return this.now() - this.lastActive >= IDLE_LIMIT;}
}
