import {act, newPlayer, newRoom, startRound, validName, view} from './engine.js';

export const IDLE_LIMIT = 20 * 60 * 1000;
export const TURN_DURATION = 30 * 1000;
export const EMOTES = ['😂', '😭', '😏', '😡', '😮', '❤️', '👏', '💀', 'seal', 'seal-tongue', 'seal-happy', 'seal-cry'];

export class RoomAuthority {
  constructor(room, name, token, {now = Date.now, saved} = {}) {
    this.now = now;
    this.state = saved?.state ?? newRoom(room, newPlayer(name, token));
    this.revision = saved?.revision ?? 0;
    this.lastActive = saved?.lastActive ?? now();
    this.lastMessages = new Map();
    this.remaining = saved?.remaining ?? null;
    this.state.turnDeadline ??= null;
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
    if (this.state.players.length === 2) throw new Error('Masa dolu.');
    if (name.trim().toLocaleLowerCase('tr-TR') === this.state.players[0].name.toLocaleLowerCase('tr-TR')) throw new Error('Farklı bir ad yaz.');
    this.state.players.push(newPlayer(name, token));
    startRound(this.state);
    this.restartTurn();
    this.revision++;
    this.touch();
    return 1;
  }

  play(index, command, revision) {
    if (this.expired()) throw new Error('Masa kapandı.');
    if (this.expireTurn()) return false;
    if (revision !== this.revision) throw new Error('Tekrar dene.');
    if (!['play','draw','pass','uno','catch','ready'].includes(command?.type)) throw new Error('Geçersiz hamle.');
    act(this.state, index, command);
    if (!['uno','catch'].includes(command.type)) this.restartTurn();
    this.state.players[index].seen = this.now();
    this.revision++;
    this.touch();
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
    if (this.state.phase !== 'playing' || !this.state.turnDeadline) return;
    this.remaining = Math.max(1000, this.state.turnDeadline - this.now());
    this.state.turnDeadline = null;
  }
  resumeTurn() {
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
  snapshot(index) {return {state: structuredClone(view(this.state, index)), version: this.revision, serverNow:this.now()};}
  checkpoint() {return {state: this.state, revision: this.revision, lastActive: this.lastActive, remaining:this.remaining};}
  touch() {this.lastActive = this.now();}
  expired() {return this.now() - this.lastActive >= IDLE_LIMIT;}
}
