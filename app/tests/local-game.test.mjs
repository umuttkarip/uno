import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalGame} from '../src/local-game.js';
import {TURN_DURATION,UNO_DURATION} from '../src/room.js';
import {deck} from '../src/engine.js';
import {planTransition} from '../public/table-motion.js';

const memory=()=>{const entries=new Map();return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};};
async function setup(t){
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1000});
  t.mock.method(Math,'random',()=>0);
  for(const key of ['sessionStorage','localStorage']){const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value:memory()});t.after(()=>old?Object.defineProperty(globalThis,key,old):Reflect.deleteProperty(globalThis,key));}
  const states=[],errors=[],messages=[],game=new LocalGame({onState:s=>states.push(s),onError:e=>errors.push(e),onMessage:m=>messages.push(m)});
  await game.enter('A');t.after(()=>game.shutdown());
  return {game,states,errors,messages,tick:n=>t.mock.timers.tick(n),ack:()=>game.presented(states.at(-1).version)};
}
function fixed(game,human,bot,{turn=0}={}){
  const s=game.authority.state,cards=deck();
  const pick=([color,value])=>{const i=cards.findIndex(c=>c.color===color&&c.value===value);assert.notEqual(i,-1);return cards.splice(i,1)[0];};
  s.players[0].hand=human.map(pick);s.players[1].hand=bot.map(pick);
  s.pile=[pick(['red','7'])];s.color='red';s.deck=cards;s.turn=turn;
  s.pendingDraw=null;s.drawnId=null;s.vulnerable=null;s.unoDeadline=null;s.lastUnoPenalty=null;
  game.authority.restartTurn();game.authority.revision++;game.publish();
  return s;
}
const red=value=>['red',value],blue=value=>['blue',value],four=['wild','wild4'];

test('local bot waits for the actual rendered move, even when animations take several seconds',async t=>{
  const q=await setup(t),s=fixed(q.game,[red('3'),blue('9')],[red('draw2')],{turn:1});
  q.tick(6000);assert.equal(s.players[1].hand.length,1);assert.equal(s.pendingDraw,null);
  q.ack();q.tick(749);assert.equal(s.players[1].hand.length,1);q.tick(1);
  assert.equal(s.players[1].hand.length,0);assert.equal(s.pendingDraw.count,2);
  assert.equal(s.players[0].hand.length,2);assert.equal(s.phase,'playing');assert.deepEqual(q.errors,[]);
});

for(const [value,penalty]of [['draw2',2],['wild4',4]])test(`computer's final ${value} is played first and remains optional to counter or accept`,async t=>{
  const q=await setup(t),s=fixed(q.game,[four,red('9')],[value==='wild4'?four:red(value)],{turn:1});
  q.ack();q.tick(750);const pending=q.states.at(-1),humanCount=s.players[0].hand.length;
  assert.equal(pending.state.top.value,value);assert.equal(pending.state.pendingDraw.count,penalty);
  assert.equal(humanCount,2);assert.equal(s.winner,null);assert.equal(s.players[1].wins,0);
  q.tick(TURN_DURATION*2);assert.equal(s.players[0].hand.length,humanCount);assert.equal(s.phase,'playing');
  q.ack();assert.equal(s.turnDeadline,Date.now()+TURN_DURATION);
  await q.game.action({type:'play',cardId:s.players[0].hand[0].id,color:'green',uno:true});
  assert.equal(s.pendingDraw.count,penalty+4);assert.equal(s.players[0].hand.length,1);
  q.ack();q.tick(750);assert.equal(s.players[1].hand.length,penalty+4);
  assert.equal(s.phase,'playing');assert.equal(s.winner,null);assert.equal(s.players[1].wins,0);
  assert.equal(planTransition(pending.state,q.states.at(-2).state).ownPlayed.value,'wild4');
});

test('accepting a final +2 draws exactly two, awards one win, and rematches only after the result is rendered',async t=>{
  const q=await setup(t),s=fixed(q.game,[four,red('9')],[red('draw2')],{turn:1});
  q.ack();q.tick(750);q.ack();await q.game.action({type:'draw'});
  assert.equal(s.players[0].hand.length,4);assert.equal(s.pendingDraw,null);assert.equal(s.winner,1);assert.equal(s.players[1].wins,1);
  const round=s.round;q.ack();await q.game.action({type:'ready',round});q.tick(3000);assert.equal(s.round,round);
  q.ack();q.tick(750);assert.equal(s.round,round+1);assert.equal(s.players[1].wins,1);assert.deepEqual(s.players.map(p=>p.hand.length),[7,7]);
  const saved=JSON.parse(localStorage.getItem('uno-scores-v1:bilgisayar:a'));assert.equal(saved.Bilgisayar.wins,1);
});

test('a final penalty grants a full response turn after landing, then times out only once',async t=>{
  const q=await setup(t),s=fixed(q.game,[four,red('9')],[red('draw2')],{turn:1});
  q.ack();q.tick(750);q.tick(5000);q.ack();
  q.tick(TURN_DURATION-250);assert.equal(s.players[0].hand.length,2);q.tick(250);
  assert.equal(s.players[0].hand.length,4);assert.equal(s.winner,1);assert.equal(s.players[1].wins,1);
  q.ack();q.tick(TURN_DURATION*2);assert.equal(s.players[0].hand.length,4);assert.equal(s.players[1].wins,1);
});

test('UNO grace starts after the card lands; forgetting it is distinct from the computer final +2',async t=>{
  const q=await setup(t),s=fixed(q.game,[red('3'),blue('9')],[red('draw2')]);q.ack();
  await q.game.action({type:'play',cardId:s.players[0].hand[0].id});
  q.tick(5000);assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,1);
  q.ack();q.tick(UNO_DURATION-250);assert.equal(s.players[0].hand.length,1);q.tick(250);
  assert.equal(s.players[0].hand.length,3);assert.equal(s.lastUnoPenalty.player,0);
  assert.equal(s.pendingDraw,null);assert.equal(s.players[1].hand.length,1);
  const uno=q.states.at(-1);q.tick(6000);assert.equal(s.players[1].hand.length,1);
  q.ack();q.tick(750);assert.equal(s.pendingDraw.count,2);assert.equal(s.players[0].hand.length,3);
  assert.equal(q.states.at(-1).state.lastUnoPenalty.seq,uno.state.lastUnoPenalty.seq);
  assert.equal(planTransition(uno.state,q.states.at(-1).state).added.length,0);
});

test('pressing UNO after the visual landing prevents the penalty and the bot still cannot auto-draw for a human',async t=>{
  const q=await setup(t),s=fixed(q.game,[red('3'),four],[red('draw2')]);q.ack();
  await q.game.action({type:'play',cardId:s.players[0].hand[0].id});q.tick(5000);q.ack();
  q.tick(500);await q.game.action({type:'uno'});q.ack();q.tick(750);
  assert.equal(s.players[0].hand.length,1);assert.equal(s.lastUnoPenalty,null);assert.equal(s.pendingDraw.count,2);
  q.ack();await q.game.action({type:'play',cardId:s.players[0].hand[0].id,color:'green'});q.ack();q.tick(750);
  assert.equal(s.winner,0);assert.equal(s.players[0].wins,1);assert.equal(s.players[1].hand.length,6);
});

test('stale rendering acknowledgements cannot release a newer move or duplicate a bot turn',async t=>{
  const q=await setup(t),old=q.states.at(-1).version,s=fixed(q.game,[red('3'),blue('9')],[red('3'),blue('9')],{turn:1});
  assert.equal(q.game.presented(old),undefined);q.tick(3000);assert.equal(s.players[1].hand.length,2);
  const current=q.states.at(-1).version;q.game.presented(current);q.game.presented(current);q.tick(750);
  assert.equal(s.players[1].hand.length,1);assert.equal(s.turn,0);q.ack();q.tick(2000);assert.equal(s.players[1].hand.length,1);
});

test('leaving while the bot is waiting cancels every later action',async t=>{
  const q=await setup(t),s=fixed(q.game,[red('3'),blue('9')],[red('draw2')],{turn:1});q.ack();q.game.leave();q.tick(60000);
  assert.equal(s.players[1].hand.length,1);assert.equal(s.pendingDraw,null);assert.equal(sessionStorage.getItem('uno-solo-v1'),null);
});

test('refresh restores a pending last +2, the counter and the same scores without redealing',async t=>{
  const q=await setup(t),s=fixed(q.game,[four,red('9')],[red('draw2')],{turn:1});q.ack();q.tick(750);q.ack();
  s.players[0].wins=3;s.players[1].wins=2;q.game.save();q.game.shutdown();
  const states=[],restored=new LocalGame({onState:s=>states.push(s)});t.after(()=>restored.shutdown());await restored.enter('A');
  assert.equal(restored.authority.state.pendingDraw.count,2);assert.equal(restored.authority.state.players[1].hand.length,0);
  assert.deepEqual(restored.authority.state.players.map(p=>p.wins),[3,2]);assert.equal(restored.authority.state.players[1].bot,true);
  restored.presented(states.at(-1).version);const hand=restored.authority.state.players[0].hand;
  await restored.action({type:'play',cardId:hand[0].id,color:'green',uno:true});restored.presented(states.at(-1).version);q.tick(750);
  assert.equal(restored.authority.state.players[1].hand.length,6);assert.equal(restored.authority.state.phase,'playing');
  assert.deepEqual(restored.authority.state.players.map(p=>p.wins),[3,2]);
});

test('text and every expression stay separate from the turn clock and bot presentation',async t=>{
  const q=await setup(t),s=fixed(q.game,[red('3'),blue('9')],[red('draw2')],{turn:1}),deadline=s.turnDeadline;
  await q.game.message({text:'merhaba'});assert.equal(q.messages[0].text,'merhaba');
  for(const emote of ['😂','😭','😏','😡','😮','❤️','👏','💀','seal','seal-tongue','seal-happy','seal-cry']){q.tick(700);await q.game.message({emote});}
  assert.equal(q.messages.length,13);assert.equal(s.players[1].hand.length,1);assert.equal(s.turnDeadline,deadline);
  assert.equal(s.messages,undefined);assert.equal(q.states.length,2);
});

test('an animation stalled in the background does not keep an idle computer table alive',async t=>{
  const q=await setup(t);q.tick(20*60*1000);assert.equal(q.game.closed,true);assert.equal(sessionStorage.getItem('uno-solo-v1'),null);
});
