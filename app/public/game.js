import {TableConnection} from '../src/network.js';
import {COLORS, roomKey, LABELS} from '../src/engine.js';
import {EMOTES} from '../src/room.js';
import {card, back} from './cards.js';
import {unlockAudio, cardSound} from './audio.js';

const $ = id => document.getElementById(id);
let connection, state, busy=false, entering=false, unoArmed=false, pendingCard, previousMove, resultRound=-1;
let handKey='', opponentKey='', topKey='', noticeTimer, present=true, suppressClickUntil=0;
const messageTimers=new Set();
const roomParam=new URL(location.href).searchParams.get('masa');
if(roomParam)$('room').value=roomParam;
$('deck-face').innerHTML=back();
$('emotes').innerHTML=EMOTES.map(e=>`<button type="button" data-emote="${e}" aria-label="${({'😂':'Gülme','😭':'Ağlama','😏':'Sırıtma','😡':'Kızgın','😮':'Şaşkın','❤️':'Kalp','👏':'Alkış','💀':'Kafatası'})[e]}">${e}</button>`).join('');

document.addEventListener('pointerdown',unlockAudio,{once:true});
function notice(text){if(!text)return;$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,3200);}
function setChat(open){$('chat-panel').hidden=!open;$('chat-toggle').setAttribute('aria-expanded',String(open));if(open)$('message').focus({preventScroll:true});}
function showLogin(message=''){
  connection?.shutdown();connection=null;state=null;busy=false;entering=false;unoArmed=false;pendingCard=null;present=true;
  handKey=opponentKey=topKey='';previousMove=undefined;resultRound=-1;
  $('login').hidden=false;$('match').hidden=true;$('leave').hidden=true;$('enter').disabled=false;$('entry-error').textContent=message;
  document.body.classList.remove('disconnected');
  setChat(false);$('color-dialog').close();$('result-dialog').close();$('messages').replaceChildren();
  for(const t of messageTimers)clearTimeout(t);messageTimers.clear();
}

$('entry-form').addEventListener('submit',async e=>{
  e.preventDefault();if(entering||!$('entry-form').reportValidity())return;
  entering=true;$('enter').disabled=true;$('entry-error').textContent='';await unlockAudio();
  const name=$('name').value.trim(),room=$('room').value.trim();
  const current=connection=new TableConnection({
    onState:snapshot=>{if(connection===current)receive(snapshot);},
    onMessage:message=>{if(connection===current)showMessage(message);},
    onError:message=>{if(connection===current)notice(message);},
    onClose:message=>{if(connection===current)showLogin(message);},
    onPresence:online=>{if(connection!==current)return;present=online;document.body.classList.toggle('disconnected',!online);render();}
  });
  try{
    await current.enter(name,room);if(connection!==current)return;
    $('login').hidden=true;$('match').hidden=false;$('leave').hidden=false;
    const url=new URL(location.href);url.searchParams.delete('name');url.searchParams.delete('room');url.searchParams.set('masa',room);history.replaceState(null,'',url);
    render();
  }catch(error){if(connection===current)showLogin(error.message);}
  finally{entering=false;$('enter').disabled=false;}
});

function receive(snapshot){
  const previous=state;state=snapshot.state;
  if(!state)return;
  if(previous&&previous.round!==state.round){unoArmed=false;$('result-dialog').close();handKey=topKey='';}
  if(previous&&previous.players[previous.me]?.count!==state.players[state.me]?.count)unoArmed=false;
  const move=state.lastMove;
  if(previousMove!==undefined&&move&&move.seq!==previousMove&&['play','draw'].includes(move.type))cardSound(move.type);
  previousMove=move?.seq??null;
  if(pendingCard&&!state.playable.includes(pendingCard)){$('color-dialog').close();pendingCard=null;}
  render();
  if(state.phase==='finished'&&resultRound!==state.round){resultRound=state.round;$('result-name').textContent=state.players[state.winner].name+' kazandı';$('result-dialog').showModal();}
}

function render(){
  if(!state)return;
  const me=state.me,self=state.players[me],opponent=state.players[1-me];
  const playing=state.phase==='playing',mine=playing&&state.turn===me;
  $('self-name').textContent=self.name;$('opponent-name').textContent=opponent?.name??'';
  $('self-name').classList.toggle('active',mine);$('opponent-name').classList.toggle('active',playing&&!mine);
  $('opponent-name').classList.toggle('absent',!present);
  $('waiting').hidden=state.phase!=='waiting';$('piles').hidden=state.phase==='waiting';
  $('draw').disabled=!mine||!!state.drawnId||busy||!present;
  const opponentCount=opponent?.count??0;
  if(opponentKey!==opponentCount){
    opponentKey=opponentCount;const n=Math.min(opponentCount,16);
    $('opponent-hand').innerHTML=Array.from({length:n},(_,i)=>back(`--rotation:${(i-(n-1)/2)*3.2}deg;--offset:${Math.abs(i-(n-1)/2)*1.1}px`)).join('');
    $('opponent-hand').setAttribute('aria-label',`${opponentCount} kapalı kart`);
  }
  if(state.top&&topKey!==state.top.id+':'+state.round){
    topKey=state.top.id+':'+state.round;$('discard').innerHTML=card(state.top);
    if(previousMove!==undefined)$('discard').firstElementChild.classList.add('new-card');
    $('discard').setAttribute('aria-label',`${({red:'Kırmızı',yellow:'Sarı',green:'Yeşil',blue:'Mavi',wild:'Joker'})[state.top.color]} ${LABELS[state.top.value]??state.top.value}`);
  }
  $('discard').classList.toggle('joker',state.top?.color==='wild');
  if(COLORS.includes(state.color))$('discard').style.setProperty('--chosen-color',`var(--${state.color})`);
  const nextHandKey=JSON.stringify([self.hand,state.playable,busy,present,state.drawnId]);
  if(handKey!==nextHandKey){
    const focused=document.activeElement?.dataset.card;
    handKey=nextHandKey;const n=self.hand.length;
    $('hand').style.setProperty('--overlap',(n>10?43:n>7?34:28)+'px');
    $('hand').innerHTML=self.hand.map((c,i)=>card(c,{button:true,playable:state.playable.includes(c.id)&&!busy&&present,drawn:state.drawnId===c.id,style:`--rotation:${n<=11?(i-(n-1)/2)*1.6:0}deg;--offset:${n<=11?Math.abs(i-(n-1)/2)*1.2:0}px`})).join('');
    if(focused){const el=$('hand').querySelector(`[data-card="${CSS.escape(focused)}"]`);if(el&&!el.disabled)el.focus({preventScroll:true});}
  }
  $('pass').hidden=!(mine&&state.drawnId);$('pass').disabled=busy||!present;
  $('catch').hidden=!(playing&&state.vulnerable===1-me);$('catch').disabled=busy||!present;
  $('uno').disabled=!playing||![1,2].includes(self.count)||self.uno||busy||!present;
  $('uno').classList.toggle('armed',unoArmed||self.uno);$('uno').setAttribute('aria-pressed',String(unoArmed||self.uno));
  $('chat-toggle').disabled=!opponent||!present;
  $('rematch').disabled=self.ready||busy||!present;$('rematch').textContent=self.ready?'Hazır':'Tekrar oyna';
}

async function action(type,extra={}){
  if(busy||!connection||!state)return;
  busy=true;render();
  try{await connection.action({type,...extra});}
  catch(error){notice(error.message);}
  finally{busy=false;render();}
}

$('hand').addEventListener('click',e=>{
  if(Date.now()<suppressClickUntil)return;
  const button=e.target.closest('[data-card]');if(!button||busy||!state||!present)return;
  const c=state.players[state.me].hand.find(c=>c.id===button.dataset.card);
  if(!c||!state.playable.includes(c.id))return;
  if(c.color==='wild'){pendingCard=c.id;$('color-dialog').showModal();}
  else action('play',{cardId:c.id,uno:unoArmed});
});

document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{
  const id=pendingCard;pendingCard=null;$('color-dialog').close();
  if(id)action('play',{cardId:id,color:button.dataset.color,uno:unoArmed});
}));
$('color-dialog').addEventListener('close',()=>pendingCard=null);
$('color-dialog').addEventListener('click',e=>{if(e.target===$('color-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close();}});
$('draw').onclick=()=>action('draw');$('pass').onclick=()=>action('pass');$('catch').onclick=()=>action('catch');
$('uno').onclick=()=>{if(state?.players[state.me].count===1)action('uno');else{unoArmed=!unoArmed;render();}};
$('rematch').onclick=()=>action('ready');$('result-close').onclick=()=>$('result-dialog').close();
$('discard').onclick=()=>{if(state?.phase==='finished')$('result-dialog').showModal();};
$('leave').onclick=()=>{connection?.leave();showLogin();};
$('chat-toggle').onclick=()=>setChat($('chat-panel').hidden);$('chat-close').onclick=()=>setChat(false);

async function sendMessage(payload){
  if(!connection||!state)return;
  try{await connection.message(payload);setChat(false);$('message').value='';}
  catch(error){notice(error.message);}
}
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value.trim();if(text)sendMessage({text});};
$('emotes').onclick=e=>{const emote=e.target.closest('[data-emote]')?.dataset.emote;if(emote)sendMessage({emote});};
function showMessage(message){
  if(!state||!state.players[message.player])return;
  const bubble=document.createElement('div');bubble.className='message'+(message.player===state.me?' own':'')+(message.emote?' is-emote':'');
  const name=document.createElement('strong');name.textContent=state.players[message.player].name;
  const text=document.createElement('span');text.textContent=message.text;
  bubble.append(name,text);$('messages').append(bubble);
  while($('messages').children.length>3)$('messages').firstElementChild.remove();
  const timer=setTimeout(()=>{messageTimers.delete(timer);bubble.classList.add('out');const end=setTimeout(()=>{messageTimers.delete(end);bubble.remove();},280);messageTimers.add(end);},5000);messageTimers.add(timer);
}

document.addEventListener('keydown',e=>{if(e.key==='Escape')setChat(false);});
document.addEventListener('pointerdown',e=>{if(!$('chat-panel').hidden&&!$('chat-panel').contains(e.target)&&!$('chat-toggle').contains(e.target))setChat(false);});
let drag;
$('hand-scroll').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,scroll:$('hand-scroll').scrollLeft,moved:false};});
window.addEventListener('pointermove',e=>{
  if(!drag)return;const delta=e.clientX-drag.x;
  if(Math.abs(delta)>6)drag.moved=true;
  if(drag.moved){$('hand-scroll').classList.add('dragging');$('hand-scroll').scrollLeft=drag.scroll-delta;e.preventDefault();}
},{passive:false});
function endDrag(){if(drag?.moved)suppressClickUntil=Date.now()+250;drag=null;$('hand-scroll').classList.remove('dragging');}
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
window.addEventListener('pagehide',()=>connection?.shutdown());
try {
  const saved=roomParam?JSON.parse(sessionStorage.getItem('uno-v2:'+roomKey(roomParam))):null;
  if(saved?.name&&saved.token){$('name').value=saved.name;$('entry-form').requestSubmit();}
} catch {}
