import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {relayApi} from '../src/relay-api.js';
import {IDLE_LIMIT} from '../src/room.js';
import {TableConnection} from '../src/relay-network.js';
import {botCommand} from '../src/bot.js';

async function setup(){
  const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0001_relay_rooms.sql',import.meta.url),'utf8'));let time=10000;
  const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args);},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}}};
  const call=async(route,{token,body,after=0,key,origin='https://umuttkarip.github.io'}={})=>{
    const url='https://relay.test/api/v1/'+route+(route==='state'?'?'+new URLSearchParams({key,after,wait:'0'}):'');
    const request=new Request(url,{method:route==='state'?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(route!=='state'?{body:JSON.stringify(body??{})}:{})});
    const response=await relayApi(request,env,{now:()=>time});return {status:response.status,...await response.json()};
  };
  const enter=(name,room='23',scope='main',token=crypto.randomUUID())=>call('enter',{token,body:{name,room,scope}}).then(s=>({...s,token}));
  const action=(p,command,id=crypto.randomUUID())=>call('action',{token:p.token,body:{key:p.key,version:p.version,after:p.cursor,id,command}});
  return {db,env,call,enter,action,advance:ms=>time+=ms};
}

test('HTTPS lobby accepts the same room name, starts with two ready players and masks both hands',async()=>{
  const x=await setup(),a=await x.enter('Umut'),b=await x.enter('Sude');assert.equal(a.state.phase,'waiting');assert.equal(b.state.players.length,2);
  const first=await x.action(a,{type:'ready',round:0});assert.equal(first.state.phase,'waiting');
  const second=await x.action(b,{type:'ready',round:0});assert.equal(second.state.phase,'playing');assert.equal(second.state.players[1].hand.length,7);assert.equal(second.state.players[0].hand,undefined);
  const host=await x.call('state',{token:a.token,key:a.key});assert.equal(host.state.players[0].hand.length,7);assert.equal(host.state.players[1].hand,undefined);assert.equal(JSON.stringify(host).includes(a.token),false);assert.equal(JSON.stringify(host).includes(b.token),false);
});

test('six HTTPS players remain in the lobby until everyone is ready; a seventh cannot join',async()=>{
  const x=await setup(),players=[];for(let i=0;i<6;i++)players.push(await x.enter('P'+i));
  assert.equal(players[5].state.phase,'waiting');assert.equal((await x.enter('P6')).status,409);
  for(let i=0;i<6;i++){const result=await x.action(players[i],{type:'ready',round:0});assert.equal(result.state.phase,i===5?'playing':'waiting');}
});

test('simultaneous HTTPS entries and ready approvals preserve all six seats',async()=>{
  const x=await setup();const first=await x.enter('A');const joined=await Promise.all(['B','C','D','E','F'].map(name=>x.enter(name)));assert.ok(joined.every(p=>p.status===200));
  const payload=JSON.parse(x.db.prepare('SELECT payload FROM relay_rooms').get().payload);assert.equal(payload.saved.state.players.length,6);assert.equal(new Set(payload.saved.state.players.map(p=>p.token)).size,6);
  const ready=await Promise.all([first,...joined].map(p=>x.action(p,{type:'ready',round:0})));assert.ok(ready.every(p=>p.status===200));
  const state=await x.call('state',{key:first.key,token:first.token});assert.equal(state.state.phase,'playing');
});

test('a pending HTTPS poll wakes on another player joining instead of waiting for its timeout',async()=>{
  const x=await setup(),a=await x.enter('A');let reads=0;
  const request=new Request('https://relay.test/api/v1/state?'+new URLSearchParams({key:a.key,after:a.cursor,wait:20000}),{headers:{Authorization:'Bearer '+a.token}});
  const response=await relayApi(request,x.env,{now:()=>10000,pause:async()=>{assert.ok(++reads<3);await x.enter('B');}});
  const packet=await response.json();assert.equal(packet.state.players.length,2);assert.equal(reads,1);
});

test('two-, three- and six-player games finish through authenticated HTTPS actions and unanimous rematches',async()=>{
  for(const n of [2,3,6]){
    const x=await setup(),players=[];for(let i=0;i<n;i++)players.push(await x.enter('P'+i));
    for(const p of players)await x.action(p,{type:'ready',round:0});
    let packet=await x.call('state',{token:players[0].token,key:players[0].key}),steps=0;
    while(packet.state.phase==='playing'&&steps++<5000){
      const player=players[packet.state.turn];packet=await x.call('state',{token:player.token,key:player.key});
      packet=await x.action({...packet,token:player.token},botCommand(packet.state,packet.state.me));assert.equal(packet.status,200);
      const full=JSON.parse(x.db.prepare('SELECT payload FROM relay_rooms').get().payload).saved.state;
      assert.equal([...full.deck,...full.pile,...full.players.flatMap(p=>p.hand)].length,108);
    }
    assert.equal(packet.state.phase,'finished');assert.equal(packet.state.players.reduce((sum,p)=>sum+p.wins,0),1);
    const round=packet.state.round;for(const p of players)packet=await x.action({...p,version:packet.version},{type:'ready',round});
    assert.equal(packet.state.round,round+1);assert.equal(packet.state.players.reduce((sum,p)=>sum+p.wins,0),1);
  }
});

test('message rate limits survive separate requests and invalid messages fail without retrying',async()=>{
  const x=await setup(),a=await x.enter('A');const message=()=>x.call('message',{token:a.token,body:{key:a.key,id:crypto.randomUUID(),message:{text:'merhaba'}}});
  assert.equal((await message()).status,200);assert.equal((await message()).status,429);x.advance(651);assert.equal((await message()).status,200);
  x.advance(651);assert.equal((await x.call('message',{token:a.token,body:{key:a.key,id:crypto.randomUUID(),message:{text:''}}})).status,400);
});

test('refresh restores the same player, while a reused HTTP command never draws twice',async()=>{
  const x=await setup(),a=await x.enter('A'),b=await x.enter('B');await x.action(a,{type:'ready',round:0});await x.action(b,{type:'ready',round:0});
  const restored=await x.enter('A','23','main',a.token);assert.equal(restored.state.players.length,2);const id=crypto.randomUUID();
  const first=await x.action(restored,{type:'draw'},id),retry=await x.action(restored,{type:'draw'},id);assert.equal(first.status,200);assert.deepEqual(retry.state.players[0].hand,first.state.players[0].hand);assert.equal(retry.version,first.version);
});

test('quiet heartbeat responses do not resend cards; expired presence pauses and reconnect resumes the turn',async()=>{
  const x=await setup(),a=await x.enter('A'),b=await x.enter('B');await x.action(a,{type:'ready',round:0});const game=await x.action(b,{type:'ready',round:0});
  x.advance(13000);const quiet=await x.call('state',{token:a.token,key:a.key,after:game.cursor});assert.equal(quiet.unchanged,true);assert.equal(quiet.state,undefined);
  x.advance(33000);const paused=await x.call('state',{token:a.token,key:a.key});assert.equal(paused.state.players[1].online,false);assert.equal(paused.state.turnDeadline,null);
  const returned=await x.enter('B','23','main',b.token);assert.equal(returned.state.players[1].online,true);assert.ok(returned.state.turnDeadline>46000);
});

test('HTTPS messages arrive once by cursor and expire instead of becoming chat history',async()=>{
  const x=await setup(),a=await x.enter('A'),b=await x.enter('B');const sent=await x.call('message',{token:a.token,body:{key:a.key,id:crypto.randomUUID(),after:a.cursor,message:{text:'merhaba'}}});assert.equal(sent.messages[0].text,'merhaba');
  const received=await x.call('state',{token:b.token,key:b.key,after:b.cursor});assert.equal(received.messages[0].player,0);
  assert.equal((await x.call('state',{token:b.token,key:b.key,after:received.cursor})).unchanged,true);
  x.advance(5100);assert.deepEqual((await x.call('state',{token:b.token,key:b.key})).messages,[]);
});

test('test rooms stay isolated, lobby exits release seats and idle rooms start fresh',async()=>{
  const x=await setup(),a=await x.enter('A'),b=await x.enter('B'),preview=await x.enter('A','23','test');assert.notEqual(a.key,preview.key);assert.equal(preview.state.players.length,1);
  await x.call('leave',{token:a.token,body:{key:a.key}});const remaining=await x.call('state',{token:b.token,key:b.key});assert.equal(remaining.state.players.length,1);assert.equal(remaining.state.me,0);
  x.advance(IDLE_LIMIT+1);assert.equal((await x.call('state',{token:b.token,key:b.key})).status,410);const fresh=await x.enter('B');assert.equal(fresh.state.players.length,1);assert.equal(fresh.state.players[0].wins,0);
});

test('HTTPS endpoints reject wrong origins, unknown bearer tokens and changes after the game starts',async()=>{
  const x=await setup(),a=await x.enter('A'),b=await x.enter('B');assert.equal((await x.call('state',{key:a.key,token:crypto.randomUUID()})).status,403);
  assert.equal((await x.call('state',{key:a.key,token:a.token,origin:'https://other.test'})).status,403);
  await x.action(a,{type:'ready',round:0});await x.action(b,{type:'ready',round:0});assert.equal((await x.enter('C')).status,409);
});

test('browser HTTP transport restores snapshots, deduplicates message delivery and cancels its pending poll',async()=>{
  const x=await setup();let states=0,messages=0;
  const transport=(url,options)=>{
    if(options.method==='GET')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    return relayApi(new Request(url,options),x.env,{now:()=>10000});
  };
  const client=new TableConnection({onState:()=>states++,onMessage:()=>messages++},{fetch:transport,base:'https://relay.test/api/v1/'});
  await client.enter('A','23');assert.equal(states,1);await client.action({type:'ready',round:0});assert.equal(states,2);
  const event={id:'same',text:'UNO',player:0};client.apply({messages:[event,event]});assert.equal(messages,1);client.shutdown();assert.equal(client.controllers.size,0);
});
