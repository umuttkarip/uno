import {TableConnection} from '../src/network.js';
import {COLORS,roomKey,LABELS} from '../src/engine.js';
import {back} from './cards.js';
import {TableMotion} from './table-motion.js';
import {unlockAudio} from './card-audio.js';
import {EXPRESSIONS,expression,expressionImage,preloadExpressions} from './expressions.js';

const $=id=>document.getElementById(id);
let connection,state,busy=false,entering=false,moving=false,unoArmed=false,pendingCard,resultRound=-1;
let present=true,noticeTimer,suppressClickUntil=0,clockOffset=0,processing=false,generation=0;
let queue=[],chatAnimation,chatGeneration=0;
const messageTimers=new Set();
const roomParam=new URL(location.href).searchParams.get('masa');
if(roomParam)$('room').value=roomParam;
$('deck-face').innerHTML=back();
const motion=new TableMotion({hand:$('hand'),opponent:$('opponent-hand'),discard:$('discard'),deck:$('draw'),scroll:$('hand-scroll')});
$('emotes').innerHTML=EXPRESSIONS.map(item=>`<button type="button" class="${item.sticker?'sticker-choice':''}" data-emote="${item.code}" aria-label="${item.name}">${expressionImage(item.code)}</button>`).join('');
preloadExpressions();
document.addEventListener('pointerdown',unlockAudio,{once:true});

function notice(text){if(!text)return;$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,3200);}
function setChat(open,instant=false){
  const version=++chatGeneration;
  chatAnimation?.cancel();
  $('chat-toggle').setAttribute('aria-expanded',String(open));
  const panel=$('chat-panel');
  if(open){
    panel.hidden=false;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)chatAnimation=panel.animate([{opacity:0,transform:'translateY(7px) scale(.98)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.22,.8,.25,1)'});
    $('message').focus({preventScroll:true});
  }else if(!instant&&!panel.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    chatAnimation=panel.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px) scale(.99)'}],{duration:120,easing:'ease-out'});
    chatAnimation.finished.catch(()=>{}).then(()=>{if(version===chatGeneration)panel.hidden=true;});
  }else panel.hidden=true;
}

function showLogin(message=''){
  generation++;queue=[];processing=false;
  connection?.shutdown();connection=null;state=null;busy=false;entering=false;moving=false;unoArmed=false;pendingCard=null;present=true;resultRound=-1;
  motion.reset();
  $('login').hidden=false;$('match').hidden=true;$('match').dataset.motion='settled';$('leave').hidden=true;$('enter').disabled=false;$('entry-error').textContent=message;
  document.body.classList.remove('disconnected');
  setChat(false,true);$('color-dialog').close();$('result-dialog').close();$('messages').replaceChildren();
  for(const timer of messageTimers)clearTimeout(timer);messageTimers.clear();
}

$('entry-form').addEventListener('submit',async event=>{
  event.preventDefault();if(entering||!$('entry-form').reportValidity())return;
  entering=true;$('enter').disabled=true;$('entry-error').textContent='';unlockAudio();
  const name=$('name').value.trim(),room=$('room').value.trim();
  const current=connection=new TableConnection({
    onState:snapshot=>{if(connection===current)receive(snapshot);},
    onMessage:message=>{if(connection===current)showMessage(message);},
    onError:message=>{if(connection===current)notice(message);},
    onClose:message=>{if(connection===current)showLogin(message);},
    onPresence:online=>{if(connection!==current)return;present=online;document.body.classList.toggle('disconnected',!online);renderControls();}
  });
  try{
    await current.enter(name,room);if(connection!==current)return;
    const url=new URL(location.href);url.searchParams.delete('name');url.searchParams.delete('room');url.searchParams.set('masa',room);history.replaceState(null,'',url);
    renderControls();
  }catch(error){if(connection===current)showLogin(error.message);}
  finally{entering=false;$('enter').disabled=false;}
});

function receive(snapshot){
  if(Number.isFinite(snapshot.serverNow))clockOffset=snapshot.serverNow-Date.now();
  queue.push(snapshot);
  if(!processing)void drain();
}

async function drain(){
  const version=generation;processing=true;
  while(queue.length&&version===generation){
    const snapshot=queue.shift();
    const previous=state;state=snapshot.state;
    if(!state)continue;
    $('login').hidden=true;$('match').hidden=false;$('leave').hidden=false;
    if(previous&&previous.round!==state.round){unoArmed=false;$('result-dialog').close();}
    if(previous&&previous.players[previous.me]?.count!==state.players[state.me]?.count)unoArmed=false;
    if(pendingCard&&!state.playable.includes(pendingCard)){$('color-dialog').close();pendingCard=null;}
    moving=true;$('match').dataset.motion='moving';renderControls();
    try{await motion.update(previous,state,{present});}catch(error){console.error('Card transition failed',error);}
    if(version!==generation)return;
    moving=false;$('match').dataset.motion='settled';renderControls();
    if(state.phase==='finished'&&resultRound!==state.round){resultRound=state.round;$('result-name').textContent=state.players[state.winner].name+' kazandı';$('result-dialog').showModal();}
  }
  if(version===generation){processing=false;renderControls();}
}

function renderControls(){
  if(!state)return;
  const self=state.players[state.me],opponent=state.players[1-state.me];
  const playing=state.phase==='playing',mine=playing&&state.turn===state.me;
  const blocked=busy||moving||!present;
  $('self-name').textContent=self.name;$('opponent-name').textContent=opponent?.name??'';
  $('self-name').classList.toggle('active',mine);$('opponent-name').classList.toggle('active',playing&&!mine);
  $('opponent-name').classList.toggle('absent',!present);
  $('waiting').hidden=state.phase!=='waiting';$('piles').hidden=state.phase==='waiting';
  $('draw').disabled=!mine||!!state.drawnId||blocked;
  if(state.top)$('discard').setAttribute('aria-label',`${({red:'Kırmızı',yellow:'Sarı',green:'Yeşil',blue:'Mavi',wild:'Joker'})[state.top.color]} ${LABELS[state.top.value]??state.top.value}`);
  motion.updateInteraction(state,{blocked,present});
  $('pass').hidden=!(mine&&state.drawnId);$('pass').disabled=blocked;
  $('catch').hidden=!(playing&&state.vulnerable===1-state.me);$('catch').disabled=blocked;
  $('uno').disabled=!playing||![1,2].includes(self.count)||self.uno||blocked;
  $('uno').classList.toggle('armed',unoArmed||self.uno);$('uno').setAttribute('aria-pressed',String(unoArmed||self.uno));
  $('chat-toggle').disabled=!opponent||!present;
  $('rematch').disabled=self.ready||blocked;$('rematch').textContent=self.ready?'Hazır':'Tekrar oyna';
  updateTurnHint();
}

function updateTurnHint(){
  const end=state?.turnDeadline;
  const urgent=state?.phase==='playing'&&present&&Number.isFinite(end)&&end>Date.now()+clockOffset&&end-(Date.now()+clockOffset)<5000;
  $('self-name').classList.toggle('closing-turn',!!urgent&&state.turn===state.me);
  $('opponent-name').classList.toggle('closing-turn',!!urgent&&state.turn!==state.me);
}
setInterval(updateTurnHint,500);

async function action(type,extra={}){
  if(busy||moving||!connection||!state)return;
  busy=true;renderControls();
  try{await connection.action({type,...extra});}
  catch(error){notice(error.message);}
  finally{busy=false;renderControls();}
}

$('hand').addEventListener('click',event=>{
  if(Date.now()<suppressClickUntil||moving||busy)return;
  const button=event.target.closest('[data-card]');if(!button||!state||!present)return;
  const c=state.players[state.me].hand.find(c=>c.id===button.dataset.card);
  if(!c||!state.playable.includes(c.id))return;
  if(c.color==='wild'){pendingCard=c.id;$('color-dialog').showModal();}
  else void action('play',{cardId:c.id,uno:unoArmed});
});
document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{
  const id=pendingCard;pendingCard=null;$('color-dialog').close();
  if(id&&COLORS.includes(button.dataset.color))void action('play',{cardId:id,color:button.dataset.color,uno:unoArmed});
}));
$('color-dialog').addEventListener('close',()=>pendingCard=null);
$('color-dialog').addEventListener('click',event=>{if(event.target===$('color-dialog')){const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)event.target.close();}});
$('draw').onclick=()=>action('draw');$('pass').onclick=()=>action('pass');$('catch').onclick=()=>action('catch');
$('uno').onclick=()=>{if(state?.players[state.me].count===1)void action('uno');else{unoArmed=!unoArmed;renderControls();}};
$('rematch').onclick=()=>action('ready');$('result-close').onclick=()=>$('result-dialog').close();
$('discard').onclick=()=>{if(state?.phase==='finished')$('result-dialog').showModal();};
$('leave').onclick=()=>{connection?.leave();showLogin();};
$('chat-toggle').onclick=()=>setChat($('chat-panel').hidden);$('chat-close').onclick=()=>setChat(false);

async function sendMessage(payload){
  if(!connection||!state)return;
  try{await connection.message(payload);setChat(false);$('message').value='';}
  catch(error){notice(error.message);}
}
$('chat-form').onsubmit=event=>{event.preventDefault();const text=$('message').value.trim();if(text)void sendMessage({text});};
$('emotes').onclick=event=>{const emote=event.target.closest('[data-emote]')?.dataset.emote;if(emote)void sendMessage({emote});};
function showMessage(message){
  if(!state||!state.players[message.player])return;
  const item=message.emote?expression(message.text):null;
  const bubble=document.createElement('div');bubble.className='message'+(message.player===state.me?' own':'')+(item?' is-emote':'')+(item?.sticker?' is-sticker':'');
  const name=document.createElement('strong');name.textContent=state.players[message.player].name;bubble.append(name);
  if(item){const content=document.createElement('span');content.innerHTML=expressionImage(message.text);bubble.append(content);}
  else{const text=document.createElement('span');text.textContent=message.text;bubble.append(text);}
  $('messages').append(bubble);
  while($('messages').children.length>3)$('messages').firstElementChild.remove();
  const timer=setTimeout(()=>{messageTimers.delete(timer);bubble.classList.add('out');const end=setTimeout(()=>{messageTimers.delete(end);bubble.remove();},280);messageTimers.add(end);},5000);messageTimers.add(timer);
}

document.addEventListener('keydown',event=>{if(event.key==='Escape')setChat(false);});
document.addEventListener('pointerdown',event=>{if(!$('chat-panel').hidden&&!$('chat-panel').contains(event.target)&&!$('chat-toggle').contains(event.target))setChat(false);});
let drag;
$('hand-scroll').addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;drag={x:event.clientX,scroll:$('hand-scroll').scrollLeft,moved:false};});
window.addEventListener('pointermove',event=>{if(!drag)return;const delta=event.clientX-drag.x;if(Math.abs(delta)>6)drag.moved=true;if(drag.moved){$('hand-scroll').classList.add('dragging');$('hand-scroll').scrollLeft=drag.scroll-delta;event.preventDefault();}},{passive:false});
function endDrag(){if(drag?.moved)suppressClickUntil=Date.now()+250;drag=null;$('hand-scroll').classList.remove('dragging');}
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
window.addEventListener('pagehide',()=>connection?.shutdown());
try{const saved=roomParam?JSON.parse(sessionStorage.getItem('uno-v3:'+roomKey(roomParam))):null;if(saved?.name&&saved.token){$('name').value=saved.name;$('entry-form').requestSubmit();}}catch{}
