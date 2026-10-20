import {RoomAuthority,IDLE_LIMIT} from './room.js';
import {roomKey,validName} from './engine.js';

const ONLINE_LIMIT=45000,HEARTBEAT=12000,MESSAGE_LIFE=5000;
const origins=new Set(['https://umuttkarip.github.io','https://uno-masa-umut.caircon-baus-1525.chatgpt.site','http://localhost:4175','http://localhost:4176']);
const problem=(text,status=400)=>Object.assign(new Error(text),{status});
const bearer=request=>request.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
const signature=a=>JSON.stringify([a.revision,a.state.players.map(p=>[p.token,p.online]),a.state.turnDeadline,a.state.unoDeadline]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function relayApi(request,env,{now=Date.now,pause=sleep}={}){
  const origin=request.headers.get('Origin'),url=new URL(request.url),path=url.pathname;
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'86400'}:{})};
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  try{
    if(origin&&!origins.has(origin))throw problem('Geçersiz istek kaynağı.',403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(path==='/api/v1/health')return json({ok:true,protocol:8});
    if(!env.DB)throw problem('Oyun sunucusuna bağlanılamadı.',503);
    if(!['/api/v1/enter','/api/v1/state','/api/v1/action','/api/v1/message','/api/v1/leave'].includes(path))throw problem('İstek bulunamadı.',404);
    const entering=path.endsWith('/enter'),polling=path.endsWith('/state');
    if(request.method!==(polling?'GET':'POST'))throw problem('Geçersiz yöntem.',405);
    let body={};
    if(!polling){const raw=await request.text();if(raw.length>65536)throw problem('İstek çok büyük.',413);body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw problem('İstek okunamadı.');}
    const token=bearer(request);
    if(!/^[\w-]{20,160}$/.test(token))throw problem('Oyuncu oturumu bulunamadı.',401);
    let key=body.key??url.searchParams.get('key'),name;
    if(entering){
      name=validName(body.name);validName(body.room,'room');
      const scope=body.scope==='test'?'test':body.scope==='main'?'main':null;if(!scope)throw problem('Masa bulunamadı.');
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(roomKey(body.room)));
      key=scope+':'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      await env.DB.prepare('DELETE FROM relay_rooms WHERE updated_at < ?').bind(now()-IDLE_LIMIT).run();
    }
    if(typeof key!=='string'||!/^(main|test):[a-f0-9]{64}$/.test(key))throw problem('Masa bulunamadı.',404);
    const after=Number(polling?url.searchParams.get('after'):body.after) || 0;
    const wait=polling?Math.min(20000,Math.max(0,Number(url.searchParams.get('wait'))||0)):0;
    const start=Date.now();
    do{
      const result=await transact(env.DB,key,{now,token,create:entering?{name,room:body.room}:null,run:(a,data,index)=>{
        if(entering){if(a.state.players[index].name!==name)throw problem('Oyuncu adı değişmiş.',403);a.touch();return;}
        if(polling)return;
        if(path.endsWith('/leave')){
          if(a.state.phase==='waiting'&&a.state.players.length>1){a.state.players.splice(index,1);for(const p of a.state.players)p.ready=false;a.revision++;}
          else data.closed=true;
          return;
        }
        if(typeof body.id!=='string'||body.id.length>100)throw problem('İstek okunamadı.');
        if(data.receipts.some(r=>r.id===body.id&&r.token===token))return;
        if(path.endsWith('/action')){
          if(!a.state.players.every(p=>p.online))throw problem('Oyuncu bekleniyor.',409);
          try{a.play(index,body.command,body.version);a.state.players[index].seen=now();}catch(error){throw problem(error.message,409);}
        }else if(path.endsWith('/message')){
          data.messageTimes??={};if(data.messageTimes[token]!==undefined&&now()-data.messageTimes[token]<650)throw problem('Biraz bekle.',429);
          let message;try{message=a.message(index,body.message??{});}catch(error){throw problem(error.message);}
          data.messageTimes[token]=now();data.events.push({cursor:data.cursor+1,at:now(),message});data.eventSeq++;
        }
        data.receipts.push({id:body.id,token,at:now()});
      }});
      if(path.endsWith('/leave'))return json({left:true});
      if(!polling||result.data.cursor>after)return json(packet(result,token,key,after,now()));
      if(!wait||Date.now()-start>=wait)return json({unchanged:true,cursor:result.data.cursor,serverNow:now()});
      if(request.signal.aborted)return new Response(null,{status:204,headers});
      await pause(Math.min(500,wait));
    }while(true);
  }catch(error){
    if(error.status)return json({error:error.message},error.status);
    if(error instanceof SyntaxError)return json({error:'İstek okunamadı.'},400);
    return json({error:'Oyun sunucusuna bağlanılamadı. Tekrar dene.'},503);
  }
}

function packet({a,data},token,key,after,now){
  const me=a.state.players.findIndex(p=>p.token===token);
  return {...a.snapshot(me),key,cursor:data.cursor,messages:data.events.filter(e=>e.cursor>after&&now-e.at<MESSAGE_LIFE).map(e=>e.message)};
}

async function transact(db,key,{now,token,create,run}){
  for(let attempt=0;attempt<12;attempt++){
    const row=await db.prepare('SELECT payload,version FROM relay_rooms WHERE name=?').bind(key).first();
    let data,a,fresh=!row;
    if(fresh){
      if(!create)throw problem('Masa kapandı.',410);
      a=new RoomAuthority(create.room,create.name,token,{now,mode:'group'});a.state.players[0].seen=now();
      data={saved:a.checkpoint(),cursor:0,events:[],eventSeq:0,receipts:[]};
    }else{
      data=JSON.parse(row.payload);a=new RoomAuthority('', '', '', {now,saved:data.saved});
      if(a.expired()){
        await db.prepare('DELETE FROM relay_rooms WHERE name=? AND version=?').bind(key,row.version).run();
        if(create)continue;throw problem('Masa kapandı.',410);
      }
    }
    const previous=JSON.stringify(data),before=signature(a),eventSeq=data.eventSeq;
    let index=a.state.players.findIndex(p=>p.token===token);
    if(index<0){
      if(!create)throw problem('Oyuncu oturumu bulunamadı.',403);
      try{index=a.join(create.name,token);}catch(error){throw problem(error.message,409);}
      a.state.players[index].seen=now();
    }
    const self=a.state.players[index];if(now()-self.seen>=HEARTBEAT||create)self.seen=now();
    for(const p of a.state.players)p.online=now()-p.seen<ONLINE_LIMIT;
    if(a.state.players.every(p=>p.online)){a.resumeTurn();a.expireUno();a.expireTurn();}else a.pauseTurn();
    run(a,data,index);
    data.events=data.events.filter(e=>now()-e.at<MESSAGE_LIFE);
    data.receipts=data.receipts.filter(r=>now()-r.at<120000).slice(-64);
    if(fresh||signature(a)!==before||data.eventSeq!==eventSeq)data.cursor++;
    data.saved=a.checkpoint();
    if(data.closed){
      if(!row)return {a,data};
      const result=await db.prepare('DELETE FROM relay_rooms WHERE name=? AND version=?').bind(key,row.version).run();
      if(result.meta.changes)return {a,data};continue;
    }
    const payload=JSON.stringify(data);
    if(!fresh&&payload===previous)return {a,data};
    const result=fresh?await db.prepare('INSERT INTO relay_rooms(name,payload,version,updated_at) VALUES (?,?,0,?) ON CONFLICT(name) DO NOTHING').bind(key,payload,a.lastActive).run():await db.prepare('UPDATE relay_rooms SET payload=?,version=version+1,updated_at=? WHERE name=? AND version=?').bind(payload,a.lastActive,key,row.version).run();
    if(result.meta.changes)return {a,data};
  }
  throw problem('Masa güncellendi. Tekrar dene.',409);
}
