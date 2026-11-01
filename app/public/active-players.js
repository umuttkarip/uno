import {ADMIN_API} from '../src/admin-client.js';
import {DESIGN_PREVIEW} from '../src/environment.js';

export function mountActivePlayers(section){
  const list=section.querySelector('ul'),status=section.querySelector('[role="status"]'),count=section.querySelector('[data-count]');
  let timer,request,signature='';
  const visible=()=>!document.hidden&&!section.closest('[hidden]');
  function pause(){clearTimeout(timer);request?.abort();request=null;}
  function render(players,message=''){
    const next=JSON.stringify(players);if(next!==signature){signature=next;list.replaceChildren(...players.map(player=>{const item=document.createElement('li');item.textContent=player.name;return item;}));}
    count.textContent=players.length?String(players.length):'';list.hidden=!players.length;status.hidden=!!players.length;status.textContent=message||'Şu an aktif oyuncu yok.';
  }
  async function refresh(){
    clearTimeout(timer);if(!visible()||request)return;
    const attempt=request=new AbortController(),timeout=setTimeout(()=>attempt.abort(),4000);
    try{
      const response=await fetch(ADMIN_API+'players'+(DESIGN_PREVIEW?'?scope=test':''),{signal:attempt.signal,cache:'no-store'});
      if(!response.ok)throw Error('Oyuncular alınamadı.');
      const data=await response.json();if(!Array.isArray(data.players))throw Error('Oyuncular alınamadı.');
      if(request===attempt)render(data.players.filter(p=>p&&typeof p.name==='string'));
    }catch{if(request===attempt)render([],'Oyuncular şu an gösterilemiyor.');}
    finally{clearTimeout(timeout);if(request===attempt){request=null;if(visible())timer=setTimeout(()=>void refresh(),15000);}}
  }
  document.addEventListener('visibilitychange',()=>document.hidden?pause():void refresh());
  window.addEventListener('online',()=>void refresh());window.addEventListener('pageshow',()=>void refresh());window.addEventListener('pagehide',pause);
  void refresh();return{refresh,pause};
}
