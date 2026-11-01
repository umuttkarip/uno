import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {adminApi} from '../src/admin-api.js';
import {AdminBridge} from '../src/admin-client.js';
async function setup(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(await readFile(new URL('../drizzle/0002_admin.sql',import.meta.url),'utf8'));let clock=1000000;
 const env={UNO_ADMIN_PASSWORD_SHA256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('only-a-test-password'))),n=>n.toString(16).padStart(2,'0')).join(''),UNO_ADMIN_SIGNING_KEY:'test-signing-key-not-used-in-production',DB:{prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args);},async all(){return{results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}}};
 const call=async(path,{body,token,origin='https://umuttkarip.github.io',method=body?'POST':'GET'}={})=>{const response=await adminApi(new Request('https://test.invalid/admin-api/v1/'+path,{method,headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{now:()=>clock});return{status:response.status,data:await response.json()};};
 const login=async()=>{const result=await call('login',{body:{password:'only-a-test-password'}});assert.equal(result.status,200);return result.data.token;};return{call,login,db,advance:ms=>clock+=ms};
}
test('admin requires a server-verified password and signed unexpired token; public config exposes no room names',async t=>{
 const{call,login,advance}=await setup(t);assert.equal((await call('dashboard')).status,401);assert.equal((await call('login',{body:{password:'wrong'}})).status,401);
 const token=await login();assert.equal((await call('dashboard',{token})).status,200);assert.equal((await call('dashboard',{token:token.slice(0,-1)+'x'})).status,401);assert.deepEqual((await call('config')).data,{kissWild4:true,darlingRemove:true});assert.equal((await call('config',{origin:'https://untrusted.invalid'})).status,403);
 advance(13*3600000);assert.equal((await call('dashboard',{token})).status,401);
});
test('settings require admin access and propagate through the minimal public config',async t=>{
 const{call,login}=await setup(t);assert.equal((await call('settings',{body:{kissWild4:false}})).status,401);const token=await login();assert.equal((await call('settings',{token,body:{kissWild4:false}})).status,200);assert.deepEqual((await call('config')).data,{kissWild4:false,darlingRemove:true});
 assert.equal((await call('settings',{token,body:{darlingRemove:false}})).status,200);assert.deepEqual((await call('config')).data,{kissWild4:false,darlingRemove:false});assert.equal((await call('settings',{token,body:{darlingRemove:'true'}})).status,400);
 assert.equal((await call('settings',{token,body:{kissWild4:true,darlingRemove:true}})).status,200);assert.deepEqual((await call('config')).data,{kissWild4:true,darlingRemove:true});
});
test('room records retain past participants, hide test tables and secrets, and reject another reporting key',async t=>{
 const{call,login}=await setup(t),id=crypto.randomUUID(),reportKey=crypto.randomUUID(),base={id,reportKey,name:'23',players:[{name:'Umut',wins:0},{name:'Sude',wins:1}],phase:'playing',round:1};assert.equal((await call('rooms',{body:base})).status,200);
 assert.equal((await call('rooms',{body:{...base,reportKey:crypto.randomUUID()}})).status,403);await call('rooms',{body:{...base,phase:'closed',players:[{name:'Umut',wins:0}]}});await call('rooms',{body:{...base,id:crypto.randomUUID(),scope:'test'}});
 const result=await call('dashboard',{token:await login()});assert.equal(result.data.rooms.length,1);assert.deepEqual(result.data.rooms[0].participants,['Umut','Sude']);assert.equal(result.data.rooms[0].phase,'closed');assert.equal(JSON.stringify(result.data).includes(reportKey),false);assert.equal(JSON.stringify(result.data).includes('report_hash'),false);
});
test('repeated wrong passwords are rate limited',async t=>{const{call}=await setup(t);for(let i=0;i<8;i++)assert.equal((await call('login',{body:{password:'wrong'}})).status,401);assert.equal((await call('login',{body:{password:'wrong'}})).status,429);});
test('admin reporting is absent from headless engine tests and never waits in the action path',()=>{const bridge=new AdminBridge({state:{}});assert.equal(bridge.enabled,false);assert.equal(bridge.observe(),undefined);bridge.stop();});
test('ordinary card moves send no extra room reports and reporting contains neither cards nor chat',async t=>{
 const calls=[],authority={chatId:'test-room',reportKey:'test-key',features:{},state:{name:'Masa',mode:'group',rules:'classic',phase:'playing',round:1,turn:0,players:[{name:'A',wins:0,hand:[{id:'card'}]}]}};
 const bridge=new AdminBridge(authority,{enabled:true,fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({kissWild4:true,darlingRemove:false})};}});t.after(()=>bridge.stop());bridge.observe();await new Promise(resolve=>setTimeout(resolve,180));assert.deepEqual(authority.features,{kissWild4:true,darlingRemove:false});
 authority.state.turn=1;authority.state.players[0].hand.push({id:'drawn'});assert.equal(bridge.observe(),undefined);await new Promise(resolve=>setTimeout(resolve,170));
 const reports=calls.filter(c=>c.url.endsWith('rooms'));assert.equal(reports.length,1);const report=JSON.parse(reports[0].options.body);assert.deepEqual(report.players,[{name:'A',wins:0,bot:false,online:true}]);assert.equal(JSON.stringify(report).includes('drawn'),false);assert.equal(JSON.stringify(report).includes('hand'),false);assert.equal(bridge.observe(true),undefined);
});

test('public active players show only current online humans, deduplicate names and expose no room or session data',async t=>{
 const{call}=await setup(t),base={id:crypto.randomUUID(),reportKey:crypto.randomUUID(),name:'Gizli masa',players:[{name:'Sude',wins:8},{name:'Umut',wins:2},{name:'Bilgisayar',bot:true},{name:'Deniz',online:false}],phase:'waiting'};
 await call('rooms',{body:base});await call('rooms',{body:{...base,id:crypto.randomUUID(),players:[{name:'sude'},{name:'Ali'}]}});await call('rooms',{body:{...base,id:crypto.randomUUID(),scope:'test',players:[{name:'Test oyuncusu'}]}});
 const result=await call('players');assert.equal(result.status,200);assert.deepEqual(result.data.players.map(p=>p.name.toLocaleLowerCase('tr-TR')),['ali','sude','umut']);assert.deepEqual(Object.keys(result.data),['players']);for(const p of result.data.players)assert.deepEqual(Object.keys(p),['name']);assert.equal(JSON.stringify(result.data).includes('Gizli'),false);assert.equal(JSON.stringify(result.data).includes(base.reportKey),false);
 assert.deepEqual((await call('players?scope=test')).data,{players:[{name:'Test oyuncusu'}]});
 await call('rooms',{body:{...base,players:[{name:'Umut',wins:2}]}});assert.equal((await call('players')).data.players.some(p=>p.name==='Deniz'),false);
});
test('active players expire after a missing heartbeat and disappear as soon as the room closes',async t=>{
 const{call,advance}=await setup(t),base={id:crypto.randomUUID(),reportKey:crypto.randomUUID(),name:'Masa',mode:'computer',players:[{name:'Sude'},{name:'Bilgisayar',bot:true}],phase:'playing'};
 assert.deepEqual((await call('players')).data,{players:[]});await call('rooms',{body:base});assert.deepEqual((await call('players')).data,{players:[{name:'Sude'}]});advance(74000);assert.equal((await call('players')).data.players.length,1);advance(1000);assert.deepEqual((await call('players')).data,{players:[]});
 await call('rooms',{body:base});assert.equal((await call('players')).data.players.length,1);await call('rooms',{body:{...base,phase:'closed'}});assert.deepEqual((await call('players')).data,{players:[]});
});
test('room presence renews in the background without card actions and stops after closure',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const calls=[],authority={chatId:'test-room',reportKey:'test-key',features:{},state:{name:'Masa',mode:'group',rules:'classic',phase:'waiting',round:0,players:[{name:'A',wins:0},{name:'B',wins:0,online:true}]}};
 const bridge=new AdminBridge(authority,{enabled:true,fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({})};}});t.after(()=>bridge.stop());const reports=()=>calls.filter(c=>c.url.endsWith('rooms'));
 bridge.observe();t.mock.timers.tick(150);assert.equal(reports().length,1);t.mock.timers.tick(30000);t.mock.timers.tick(150);assert.equal(reports().length,2);
 authority.state.players[1].online=false;bridge.observe();t.mock.timers.tick(150);assert.equal(JSON.parse(reports().at(-1).options.body).players[1].online,false);
 bridge.observe(true);assert.equal(JSON.parse(reports().at(-1).options.body).phase,'closed');const count=reports().length;t.mock.timers.tick(90000);assert.equal(reports().length,count);
});
