export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const COLOR_NAMES = {red:'Kırmızı',yellow:'Sarı',green:'Yeşil',blue:'Mavi',wild:'Joker'};
export const LABELS = {skip:'Pas',reverse:'Yön değiştir',draw2:'+2',wild:'Renk değiştir',wild4:'+4'};
export function deck() {
  let id = 0; const cards = [];
  for (const color of COLORS) {
    cards.push({id:String(id++),color,value:'0'});
    for (const value of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2'])
      for (let i=0;i<2;i++) cards.push({id:String(id++),color,value});
  }
  for (const value of ['wild','wild4']) for(let i=0;i<4;i++) cards.push({id:String(id++),color:'wild',value});
  return shuffle(cards);
}
export function shuffle(cards) {
  for(let i=cards.length-1;i>0;i--) {const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); const j = Math.floor(bytes[0]/4294967296*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
export function roomKey(name) {
  return String(name??'').trim().toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
}
export function validName(name, type='player') {
  const n=typeof name==='string'?name.trim():'';
  if(!n)throw new Error(type==='room'?'Lütfen masa adını yaz.':'Lütfen adını yaz.');
  return n;
}
export function newPlayer(name,token) {return {name:validName(name),token,hand:[],score:0,wins:0,seen:Date.now(),ready:false,uno:false};}
export function newRoom(name, player) {return {name:validName(name,'room'),players:[player],phase:'waiting',round:0,turn:0,drawnId:null,pendingDraw:null,deck:[],pile:[],color:null,log:[],seq:0,vulnerable:null,winner:null,lastMove:null};}
function log(s,text) {s.log.unshift({id:++s.seq,text,time:Date.now()});s.log=s.log.slice(0,12);}
function take(s,n) {
  const out=[];
  for(let i=0;i<n;i++) {
    if(!s.deck.length && s.pile.length>1) {const top=s.pile.pop();s.deck=shuffle(s.pile);s.pile=[top];}
    if(s.deck.length) out.push(s.deck.pop());
  }
  return out;
}
export function startRound(s) {
  if(s.players.length!==2) throw new Error('Başlamak için arkadaşının katılmasını bekle.');
  s.deck=deck();s.pile=[];s.round++;s.phase='playing';s.turn=(s.round-1)%2;s.color=null;s.winner=null;s.vulnerable=null;s.drawnId=null;s.pendingDraw=null;
  for(const p of s.players) {p.hand=take(s,7);p.ready=false;p.uno=false;}
  let first=s.deck.findIndex(c=>/^\d$/.test(c.value));s.pile=[s.deck.splice(first,1)[0]];s.color=s.pile[0].color;
  log(s,`${s.round}. el başladı. İlk sıra ${s.players[s.turn].name} adlı oyuncuda.`);
}
export function playable(s,index,c) {
  if(s.phase!=='playing' || s.turn!==index || !c || (s.drawnId && s.drawnId!==c.id)) return false;
  // House rule: a pending penalty can be matched or raised, never lowered.
  if(s.pendingDraw)return c.value==='wild4'||(c.value==='draw2'&&s.pendingDraw.value==='draw2');
  if(c.value==='wild4') return !s.players[index].hand.some(x=>x.color===s.color);
  const top=s.pile.at(-1);
  return c.color==='wild' || c.color===s.color || c.value===top.value;
}
export function points(c) {return c.color==='wild'?50:/^\d$/.test(c.value)?Number(c.value):20;}
function finishRound(s,index) {
  s.phase='finished';s.winner=index;const p=s.players[index],other=s.players[1-index];
  const gain=other.hand.reduce((n,c)=>n+points(c),0);p.score+=gain;p.wins++;s.roundPoints=gain;s.vulnerable=null;
  log(s,`${p.name} eli kazandı! +${gain} puan.`);
}
export function act(s,index,a) {
  const p=s.players[index],other=s.players[1-index];
  if(!p) throw new Error('Bu masada oyuncu değilsin.');
  if(a.type==='ping') {p.seen=Date.now();return;}
  if(a.type==='start') {if(index!==0 || s.phase!=='waiting') throw new Error('Masayı yalnız kuran kişi başlatabilir.');startRound(s);return;}
  if(a.type==='ready') {
    if(s.phase!=='finished') throw new Error('El henüz bitmedi.');
    p.ready=true;if(s.players.every(x=>x.ready)) startRound(s);return;
  }
  if(s.phase!=='playing') throw new Error('Önce oyunu başlatın.');
  if(a.type==='uno') {
    if(p.hand.length!==1 || p.uno) throw new Error('Tek kartın kaldığında UNO diyebilirsin.');
    p.uno=true;if(s.vulnerable===index)s.vulnerable=null;log(s,`${p.name}: UNO!`);return;
  }
  if(a.type==='catch') {
    if(s.vulnerable!==1-index || other.uno || other.hand.length!==1) throw new Error('Şu anda yakalanacak bir UNO yok.');
    other.hand.push(...take(s,2));s.vulnerable=null;log(s,`${p.name}, UNO demeyen ${other.name} adlı oyuncuyu yakaladı. +2 kart!`);return;
  }
  if(s.turn!==index) throw new Error('Şu anda sıra arkadaşında.');
  if(a.type==='draw') {
    if(s.drawnId) throw new Error('Bir kart çektin. Oyna veya pas geç.');
    if(s.pendingDraw){
      const count=s.pendingDraw.count;
      p.hand.push(...take(s,count));p.uno=false;s.vulnerable=null;s.pendingDraw=null;s.drawnId=null;s.turn=1-index;
      log(s,`${p.name} ${count} kart çekti ve sırasını kaybetti.`);
      s.lastMove={type:'draw',player:index,seq:s.seq};
      if(!other.hand.length)finishRound(s,1-index);
      return;
    }
    s.vulnerable=null;const cards=take(s,1);p.hand.push(...cards);p.uno=false;
    log(s,`${p.name} bir kart çekti.`);
    if(cards.length && playable(s,index,cards[0])) s.drawnId=cards[0].id;
    else {s.turn=1-index;s.drawnId=null;}
    s.lastMove={type:'draw',player:index,seq:s.seq};return;
  }
  if(a.type==='pass') {
    if(!s.drawnId) throw new Error('Pas geçmek için önce bir kart çekmelisin.');
    s.vulnerable=null;s.drawnId=null;s.turn=1-index;log(s,`${p.name} pas geçti.`);return;
  }
  if(a.type!=='play') throw new Error('Geçersiz hamle.');
  const i=p.hand.findIndex(x=>x.id===a.cardId), c=p.hand[i];
  if(i<0 || !playable(s,index,c)) throw new Error('Bu kartı oynayamazsın. Aynı renk veya sembolü seç.');
  if(c.color==='wild' && !COLORS.includes(a.color)) throw new Error('Bir renk seçmelisin.');
  s.vulnerable=null;p.hand.splice(i,1);s.pile.push(c);s.color=c.color==='wild'?a.color:c.color;s.drawnId=null;p.uno=false;
  log(s,`${p.name}, ${c.color==='wild'?'joker':COLOR_NAMES[c.color].toLocaleLowerCase('tr-TR')} ${LABELS[c.value]??c.value} oynadı.${c.color==='wild'?' Yeni renk: '+COLOR_NAMES[s.color]+'.':''}`);
  s.turn=1-index;
  if(c.value==='skip'||c.value==='reverse') {s.turn=index;log(s,'İki kişilik oyunda sıra tekrar sende.');}
  if(c.value==='draw2'||c.value==='wild4') {
    s.pendingDraw={count:(s.pendingDraw?.count??0)+(c.value==='draw2'?2:4),value:c.value};
  }
  s.lastMove={type:'play',player:index,card:c.id,seq:s.seq};
  if(p.hand.length===1) {
    p.uno=a.uno===true;
    if(p.uno)log(s,`${p.name}: UNO!`);else s.vulnerable=index;
  }
  if(!p.hand.length&&!s.pendingDraw)finishRound(s,index);
}
export function view(s,index) {
  return {...s,log:undefined,deck:undefined,pile:undefined,top:s.pile.at(-1)??null,deckCount:s.deck.length,me:index,
    players:s.players.map((p,i)=>({name:p.name,score:p.score,wins:p.wins,ready:p.ready,uno:p.uno,online:Date.now()-p.seen<35000,count:p.hand.length,...(i===index?{hand:p.hand}:{})})),
    playable:s.players[index].hand.filter(c=>playable(s,index,c)).map(c=>c.id)};
}
