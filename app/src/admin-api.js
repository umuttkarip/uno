const adminOrigins=new Set(['https://umuttkarip.github.io','https://uno-masa-umut.caircon-baus-1525.chatgpt.site','http://localhost:4175','http://localhost:4176']);
const adminEncode=new TextEncoder();
const adminProblem=(message,status=400)=>Object.assign(new Error(message),{status});
async function adminHash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',adminEncode.encode(text))),n=>n.toString(16).padStart(2,'0')).join('');}
function adminEqual(a,b){let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
async function adminSignature(value,secret){const key=await crypto.subtle.importKey('raw',adminEncode.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,adminEncode.encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
async function adminAuthorized(request,env,now){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')??'',parts=token.split('.');
  if(parts.length!==3||!env.UNO_ADMIN_SIGNING_KEY||!/^\d+$/.test(parts[0])||Number(parts[0])<=now||Number(parts[0])>now+13*3600000)return false;
  return adminEqual(parts[2],await adminSignature(parts[0]+'.'+parts[1],env.UNO_ADMIN_SIGNING_KEY));
}
async function adminSettings(env){const row=await env.DB.prepare('SELECT value FROM uno_admin_settings WHERE key = ?').bind('kissWild4').first();return {kissWild4:row?row.value==='true':true};}
export async function adminApi(request,env,{now=Date.now}={}){
  const origin=request.headers.get('Origin'),url=new URL(request.url),path=url.pathname,at=now();
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(adminOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'86400'}:{})};
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  try{
    if(origin&&!adminOrigins.has(origin))throw adminProblem('Geçersiz istek kaynağı.',403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!env.DB)throw adminProblem('Kayıtlar şu an açılamıyor.',503);
    if(path==='/admin-api/v1/config'&&request.method==='GET')return json(await adminSettings(env));
    let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>16384)throw adminProblem('İstek çok büyük.',413);try{body=JSON.parse(raw);}catch{throw adminProblem('İstek okunamadı.');}if(!body||typeof body!=='object'||Array.isArray(body))throw adminProblem('İstek okunamadı.');}
    if(path==='/admin-api/v1/login'&&request.method==='POST'){
      if(!env.UNO_ADMIN_PASSWORD_SHA256||!env.UNO_ADMIN_SIGNING_KEY)throw adminProblem('Yönetim girişi hazır değil.',503);
      const ip=await adminHash(request.headers.get('CF-Connecting-IP')??'unknown'),window=Math.floor(at/900000),key=ip+':'+window;
      await env.DB.prepare('DELETE FROM uno_admin_attempts WHERE updated_at < ?').bind(at-3600000).run();
      const counter=await env.DB.prepare('INSERT INTO uno_admin_attempts (id, attempts, updated_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1, updated_at = excluded.updated_at RETURNING attempts').bind(key,at).first();
      if(counter.attempts>8)throw adminProblem('Bir süre sonra tekrar dene.',429);
      if(typeof body.password!=='string'||body.password.length>200||!adminEqual(await adminHash(body.password),env.UNO_ADMIN_PASSWORD_SHA256))throw adminProblem('Şifre yanlış.',401);
      const value=(at+12*3600000)+'.'+crypto.randomUUID();return json({token:value+'.'+await adminSignature(value,env.UNO_ADMIN_SIGNING_KEY)});
    }
    if(path==='/admin-api/v1/rooms'&&request.method==='POST'){
      if(!/^[\w-]{20,80}$/.test(body.id??'')||!/^[\w-]{20,80}$/.test(body.reportKey??'')||typeof body.name!=='string'||!Array.isArray(body.players)||body.players.length>6)throw adminProblem('Masa kaydı okunamadı.');
      const existing=await env.DB.prepare('SELECT report_hash, participants_json FROM uno_room_history WHERE id = ?').bind(body.id).first(),hash=await adminHash(body.reportKey);
      if(existing&&!adminEqual(existing.report_hash,hash))throw adminProblem('Masa kaydı doğrulanamadı.',403);
      const players=body.players.map(p=>({name:String(p.name??'').slice(0,256),wins:Math.max(0,Math.min(100000,Number(p.wins)||0))}));
      const participants=[...new Set([...(existing?JSON.parse(existing.participants_json):[]),...players.map(p=>p.name)])].slice(-100);
      const scope=body.scope==='test'?'test':'main',phase=['waiting','playing','finished','closed'].includes(body.phase)?body.phase:'waiting',round=Math.max(0,Math.min(100000,Number(body.round)||0));
      await env.DB.prepare('INSERT INTO uno_room_history (id, name, scope, mode, rules, phase, round, participants_json, players_json, report_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET phase = excluded.phase, round = excluded.round, participants_json = excluded.participants_json, players_json = excluded.players_json, updated_at = excluded.updated_at').bind(body.id,body.name.slice(0,512),scope,body.mode==='computer'?'computer':'group',body.rules==='special'?'special':'classic',phase,round,JSON.stringify(participants),JSON.stringify(players),hash,at,at).run();
      return json({ok:true});
    }
    if(!await adminAuthorized(request,env,at))throw adminProblem('Giriş yapmalısın.',401);
    if(path==='/admin-api/v1/dashboard'&&request.method==='GET'){
      const {results}=await env.DB.prepare('SELECT id, name, mode, rules, phase, round, participants_json, players_json, created_at, updated_at FROM uno_room_history WHERE scope = ? ORDER BY updated_at DESC LIMIT 100').bind('main').all();
      return json({settings:await adminSettings(env),rooms:results.map(row=>({...row,participants:JSON.parse(row.participants_json),players:JSON.parse(row.players_json),participants_json:undefined,players_json:undefined}))});
    }
    if(path==='/admin-api/v1/settings'&&request.method==='POST'){
      if(typeof body.kissWild4!=='boolean')throw adminProblem('Ayar okunamadı.');
      await env.DB.prepare('INSERT INTO uno_admin_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind('kissWild4',String(body.kissWild4),at).run();return json({settings:await adminSettings(env)});
    }
    throw adminProblem('Sayfa bulunamadı.',404);
  }catch(error){return json({error:error.status?error.message:'İşlem tamamlanamadı.'},error.status??500);}
}
