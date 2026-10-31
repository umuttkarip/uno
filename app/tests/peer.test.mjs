import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {build} from 'esbuild';
import {TableConnection,tableSessionKey} from '../src/peer-table.js';
import {botCommand} from '../src/bot.js';
import {SocketBus,mqttPacket} from '../src/socket-bus.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function transports({direct=true,bus=true}={}){
 const peers=new Map(),buses=new Set();
 class Conn extends EventEmitter {constructor(){super();this.open=false;}send(data){if(!this.open)throw Error('closed');queueMicrotask(()=>{if(this.other.open)this.other.emit('data',structuredClone(data));});}close(){if(!this.open)return;this.open=this.other.open=false;this.emit('close');this.other.emit('close');}}
 class FakePeer extends EventEmitter {
  constructor(id){super();this.id=id??crypto.randomUUID();this.conns=new Set();queueMicrotask(()=>{if(this.destroyed)return;if(peers.has(this.id)){this.emit('error',{type:'unavailable-id'});return;}peers.set(this.id,this);this.open=true;this.emit('open');});}
  connect(id,options){const own=new Conn(),other=new Conn();own.other=other;other.other=own;other.metadata=options.metadata;this.conns.add(own);if(direct&&peers.has(id))queueMicrotask(()=>{peers.get(id).conns.add(other);peers.get(id).emit('connection',other);own.open=other.open=true;own.emit('open');});return own;}
  destroy(){this.destroyed=true;this.open=false;if(peers.get(this.id)===this)peers.delete(this.id);for(const conn of this.conns)conn.close();}reconnect(){this.disconnected=false;}
 }
 class FakeBus {constructor(args){Object.assign(this,args);}start(){if(bus){this.ready=true;buses.add(this);queueMicrotask(()=>this.onReady());}}send(message){if(!this.ready)return false;for(const other of buses)if(other.topic===this.topic)queueMicrotask(()=>{if(other.ready)other.onMessage(structuredClone(message));});return true;}close(){this.ready=false;buses.delete(this);}}
 return {Peer:FakePeer,Bus:FakeBus};
}
async function table(t,n=2,options={},rules='classic'){
 const transport=transports(options),clients=[],room=crypto.randomUUID();
 for(let i=0;i<n;i++){const states=[],messages=[],histories=[],closes=[],errors=[],storage=memory(),client=new TableConnection({onState:s=>states.push(s),onMessage:m=>messages.push(m),onHistory:items=>histories.push(structuredClone(items)),onClose:m=>closes.push(m),onError:e=>errors.push(e)},{...transport,storage,commandTimeout:40});t.after(()=>client.shutdown());Object.assign(client,{states,messages,histories,closes,errors});await client.enter(String.fromCharCode(65+i),room,{rules});clients.push(client);}
 await flush();return {clients,host:clients[0],room,transport};
}
for(const [name,options]of [['direct',{bus:false}],['persistent socket',{direct:false}],['both',{}]])test(`${name} transport joins and unanimously starts without HTTP actions`,async t=>{
 const {clients,host}=await table(t,3,options,'special');assert.equal(host.authority.state.phase,'waiting');assert.equal(host.authority.state.rules,'special');
 await Promise.all(clients.map(c=>c.action({type:'ready',round:0})));await flush();assert.equal(host.authority.state.phase,'playing');assert.deepEqual(host.authority.state.players.map(p=>p.hand.length),[7,7,7]);
 for(let me=0;me<3;me++){const state=clients[me].lastSnapshot.state;assert.equal(state.me,me);assert.equal(state.players[me].hand.length,7);assert.equal(state.players.filter(p=>p.hand).length,1);}
 const actor=clients[host.authority.state.turn],before=host.authority.state.players[host.authority.state.turn].hand.length;await actor.action({type:'draw'});assert.equal(host.authority.state.players[actor.lastSnapshot.state.me].hand.length,before+1);
});
for(const n of [2,3,6])for(const rules of ['classic','special'])test(`${n}-player ${rules} socket game finishes and rematches with scores conserved`,async t=>{
 const {clients,host}=await table(t,n,{direct:false},rules);await Promise.all(clients.map(c=>c.action({type:'ready',round:0})));await flush();let turns=0;
 while(host.authority.state.phase==='playing'&&turns++<5000){const index=host.authority.state.turn,client=clients[index];await client.action(botCommand(client.lastSnapshot.state,index));await flush();const s=host.authority.state;assert.equal([...s.deck,...s.pile,...s.players.flatMap(p=>p.hand)].length,rules==='special'?129:108);}
 assert.equal(host.authority.state.phase,'finished');const winner=host.authority.state.winner,round=host.authority.state.round;await Promise.all(clients.map(c=>c.action({type:'ready',round})));await flush();assert.equal(host.authority.state.round,round+1);assert.equal(host.authority.state.players[winner].wins,1);
});
test('duplicate socket commands and message copies apply once, preserving names after a lobby departure',async t=>{
 const {clients:[a,b,c],host}=await table(t,3,{direct:false});b.leave();await flush();assert.deepEqual(host.authority.state.players.map(p=>p.name),['A','C']);
 assert.equal(a.messages[0].text,'B masadan ayrıldı.');await c.message({text:'merhaba'});await flush();assert.equal(a.messages.length,2);assert.equal(a.messages[1].name,'C');c.receive({type:'message',message:a.messages[1]});assert.equal(c.messages.length,2);
 await Promise.all([a.action({type:'ready',round:0}),c.action({type:'ready',round:0})]);await flush();host.authority.state.turn=1;host.publish();await flush();
 const before=host.authority.state.players[1].hand.length,command={type:'action',command:{type:'draw'},version:c.version,id:crypto.randomUUID(),token:c.token};
 host.hostMessage(command,{nodeId:c.nodeId});host.hostMessage(command,{nodeId:c.nodeId});await flush();assert.equal(host.authority.state.players[1].hand.length,before+1);
});
test('host refresh restores hands, score and tokens; guests rejoin the existing seat',async t=>{
 const {clients:[host,guest],transport,room}=await table(t,2,{direct:false});await Promise.all([host.action({type:'ready',round:0}),guest.action({type:'ready',round:0})]);await flush();host.authority.state.players[1].wins=3;host.publish();await flush();const cards=guest.lastSnapshot.state.players[1].hand.map(c=>c.id),token=guest.token,oldPacket=structuredClone(guest.lastSnapshot);
 host.shutdown();const restored=new TableConnection({onState(){}},{...transport,storage:host.storage});t.after(()=>restored.shutdown());await restored.enter('A',room);guest.joinHost();await flush();
 assert.equal(restored.authority.state.players.length,2);assert.equal(guest.token,token);assert.deepEqual(guest.lastSnapshot.state.players[1].hand.map(c=>c.id),cards);assert.equal(guest.lastSnapshot.state.players[1].wins,3);
 guest.receive({...oldPacket,type:'state'});assert.equal(guest.hostEpoch,restored.epoch);assert.equal(guest.lastSnapshot.epoch,restored.epoch);
});
test('an existing socket table accepts a guest even if its signaling connection is unavailable',async t=>{
 const {host,room,transport}=await table(t,1,{direct:false});class OfflinePeer extends EventEmitter{destroy(){this.destroyed=true;}}
 const guest=new TableConnection({onState(){}},{...transport,Peer:OfflinePeer,storage:memory()});t.after(()=>guest.shutdown());await guest.enter('B',room);assert.equal(guest.host,false);assert.equal(guest.lastSnapshot.state.players.length,2);assert.equal(host.authority.state.players[1].name,'B');
});
test('a guest refresh restores its identity and hand without claiming the host seat',async t=>{
 const {clients:[host,guest],transport,room}=await table(t,2,{direct:false});await Promise.all([host.action({type:'ready',round:0}),guest.action({type:'ready',round:0})]);await flush();const hand=guest.lastSnapshot.state.players[1].hand.map(c=>c.id),token=guest.token;guest.shutdown();
 const restored=new TableConnection({onState(){}},{...transport,storage:guest.storage});t.after(()=>restored.shutdown());await restored.enter('B',room);assert.equal(restored.host,false);assert.equal(restored.token,token);assert.deepEqual(restored.lastSnapshot.state.players[1].hand.map(c=>c.id),hand);assert.equal(host.authority.state.players.length,2);
});
test('a saved identity without its freshness timestamp still reclaims the same player',async t=>{
 const {clients:[host,guest],transport,room}=await table(t,2,{direct:false});const saved=JSON.parse(guest.storage.getItem(guest.storageKey)),token=guest.token;delete saved.at;guest.storage.setItem(guest.storageKey,JSON.stringify(saved));guest.shutdown();
 const restored=new TableConnection({onState(){}},{...transport,storage:guest.storage});t.after(()=>restored.shutdown());await restored.enter('B',room);assert.equal(restored.token,token);assert.equal(host.authority.state.players.length,2);
});
test('a lost command reply releases its lock quickly and preserves the reconnect identity',async t=>{
 const {clients:[host,guest]}=await table(t,2,{direct:false});await Promise.all([host.action({type:'ready',round:0}),guest.action({type:'ready',round:0})]);await flush();host.authority.state.turn=1;host.publish();await flush();
 const original=host.sendLink.bind(host);host.sendLink=()=>true;const action=guest.action({type:'draw'});await assert.rejects(action,/Bağlantı yenileniyor/);assert.ok(guest.storage.getItem(guest.storageKey));host.sendLink=original;guest.joinHost();await flush();assert.equal(guest.lastSnapshot.state.players[1].count,8);assert.equal(host.authority.state.players[1].hand.length,8);assert.equal(guest.pending.size,0);
});
test('MQTT frames decode partial and concatenated packets without duplicate subscriptions',()=>{
 const sent=[],received=[],link={buffer:new Uint8Array(),socket:{send:p=>sent.push(p)},timeout:null},bus=new SocketBus({topic:'qa',onMessage:m=>received.push(m)});
 const topic=[0,2,113,97],payload=new TextEncoder().encode('{"x":1}'),packet=mqttPacket(0x30,[...topic,...payload]);bus.receive(link,packet.subarray(0,4));assert.equal(received.length,0);bus.receive(link,new Uint8Array([...packet.subarray(4),...packet]));assert.deepEqual(received,[{x:1},{x:1}]);assert.equal(sent.length,0);bus.close();
});

for(const options of [{direct:false},{bus:false},{}])test(`host departure transfers the same live hand and chat (${JSON.stringify(options)})`,async t=>{
 const {clients:[a,b,c]}=await table(t,3,options,'special');await Promise.all([a,b,c].map(p=>p.action({type:'ready',round:0})));await flush();
 a.authority.state.players[1].wins=4;a.authority.state.turn=1;a.publish();await flush();await a.message({text:'devam'});await flush();
 const hands=a.authority.state.players.slice(1).map(p=>p.hand.map(c=>c.id)),oldState=structuredClone(c.lastSnapshot);
 await a.leave();await new Promise(resolve=>setTimeout(resolve,260));b.tick();c.tick();await flush();b.tick();c.tick();await flush();
 assert.equal(b.host,true);assert.equal(b.authority.state.phase,'playing');assert.deepEqual(b.authority.state.players.map(p=>p.name),['B','C']);assert.deepEqual(b.authority.state.players.map(p=>p.hand.map(c=>c.id)),hands);assert.equal(b.authority.state.players[0].wins,4);
 assert.equal(c.lastSnapshot.state.me,1);assert.equal(c.lastSnapshot.state.players.length,2);assert.equal(b.authority.messages[0].text,'devam');assert.equal(b.authority.messages.at(-1).text,'A masadan ayrıldı.');
 c.receive({...oldState,type:'state'});assert.equal(c.lastSnapshot.state.players.length,2);await b.action({type:'draw'});await flush();assert.equal(b.authority.state.players[0].hand.length,hands[0].length+1);
});
test('a guest can leave a live game without resetting remaining hands, and a two-player departure names the player',async t=>{
 const {clients:[a,b,c]}=await table(t,3,{direct:false});await Promise.all([a,b,c].map(p=>p.action({type:'ready',round:0})));await flush();
 a.authority.state.turn=1;a.publish();await flush();await b.leave();await flush();assert.equal(a.closed,false);assert.equal(a.authority.state.players[1].name,'C');assert.equal(c.lastSnapshot.state.me,1);assert.equal(a.authority.state.turn,1);
 await c.action({type:'draw'});await flush();await c.leave();await new Promise(resolve=>setTimeout(resolve,30));assert.deepEqual(a.closes,['C masadan ayrıldı.']);
});
test('a direct-only closing table delivers the named final event before its channels are closed',async t=>{
 const {clients:[a,b]}=await table(t,2,{bus:false});await Promise.all([a,b].map(c=>c.action({type:'ready',round:0})));await flush();
 await b.leave();await new Promise(resolve=>setTimeout(resolve,30));assert.deepEqual(a.closes,['B masadan ayrıldı.']);assert.equal(a.messages.at(-1).text,'B masadan ayrıldı.');
});
test('joining and reconnecting receive session chat with original names and sticker codes',async t=>{
 const {clients:[a,b]}=await table(t,2,{direct:false});await a.message({emote:'bmo-laugh'});await flush();b.joinHost();await flush();assert.equal(b.histories.at(-1)[0].text,'bmo-laugh');assert.equal(b.histories.at(-1)[0].name,'A');assert.ok(b.histories.at(-1)[0].at);
});
test('a disconnected guest keeps its seat briefly then leaves by name so the other two can continue',async t=>{
 const {clients:[a,b,c]}=await table(t,3,{direct:false});await Promise.all([a,b,c].map(p=>p.action({type:'ready',round:0})));await flush();b.shutdown();
 const now=Date.now();a.now=()=>now+7000;a.links.get(c.token).seen=a.now();a.tick();await flush();assert.equal(a.authority.state.players.length,3);assert.equal(a.joined,false);
 a.now=()=>now+31000;a.links.get(c.token).seen=a.now();a.tick();await flush();assert.deepEqual(a.authority.state.players.map(p=>p.name),['A','C']);assert.equal(a.joined,true);assert.equal(c.messages.at(-1).text,'B masadan ayrıldı.');
});
test('production game bundle contains no HTTP game relay or polling loop',async()=>{
 const result=await build({entryPoints:['public/game.js'],bundle:true,write:false,metafile:true,format:'esm'});const files=Object.keys(result.metafile.inputs);assert.equal(files.some(f=>f.endsWith('relay-network.js')||f.endsWith('relay-api.js')),false);assert.ok(files.some(f=>f.endsWith('peer-table.js')));assert.ok(!result.outputFiles[0].text.includes('chatgpt.site/api/v1/'));assert.equal(tableSessionKey(' Masa '),'uno-v10:masa');
});
