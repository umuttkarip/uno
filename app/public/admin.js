import {ADMIN_API} from '../src/admin-client.js';
const $=id=>document.getElementById(id),key='uno-admin-session-v1';
let token='';try{token=sessionStorage.getItem(key)??'';}catch{}
function logout(){token='';try{sessionStorage.removeItem(key);}catch{}$('dashboard').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('password').value='';}
async function request(path,body){const response=await fetch(ADMIN_API+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});const data=await response.json();if(!response.ok){if(response.status===401&&path!=='login')logout();throw Error(data.error??'İşlem tamamlanamadı.');}return data;}
function render(data){
  $('kiss-toggle').checked=data.settings.kissWild4;$('darling-toggle').checked=data.settings.darlingRemove;$('room-count').textContent=data.rooms.length+' masa';$('rooms').replaceChildren();$('empty').hidden=data.rooms.length>0;
  for(const room of data.rooms){const row=document.createElement('tr');const values=[room.name,room.participants.join(', '),room.mode==='computer'?'Çevrimdışı':room.rules==='special'?'Grup · Özel':'Grup · Normal',({waiting:'Lobi',playing:'Oynanıyor',finished:'El bitti',closed:'Kapandı'})[room.phase]];
    for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
    if(room.round){const detail=document.createElement('span');detail.className='room-meta';detail.textContent=room.round+' el · '+room.players.map(p=>p.name+' '+p.wins).join(' / ');row.children[0].append(detail);}
    const cell=document.createElement('td'),time=document.createElement('time');time.dateTime=new Date(room.updated_at).toISOString();time.textContent=new Date(room.updated_at).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});cell.append(time);row.append(cell);$('rooms').append(row);
  }
}
async function load(){const data=await request('dashboard');render(data);$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;}
$('login').onsubmit=async event=>{event.preventDefault();$('enter').disabled=true;$('login-error').textContent='';try{const data=await request('login',{password:$('password').value});token=data.token;try{sessionStorage.setItem(key,token);}catch{}$('password').value='';await load();}catch(error){$('login-error').textContent=error.name==='TimeoutError'?'Bağlantı zaman aşımına uğradı.':error.message;}finally{$('enter').disabled=false;}};
$('logout').onclick=logout;
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('error').textContent='';try{await load();}catch(error){$('error').textContent=error.message;}finally{$('refresh').disabled=false;}};
for(const [id,feature]of [['kiss-toggle','kissWild4'],['darling-toggle','darlingRemove']])$(id).onchange=async()=>{const enabled=$(id).checked;$(id).disabled=true;$('error').textContent='';try{await request('settings',{[feature]:enabled});}catch(error){$(id).checked=!enabled;$('error').textContent=error.message;}finally{$(id).disabled=false;}};
if(token)void load().catch(error=>{$('login-error').textContent=error.message;});
