import test from 'node:test';
import assert from 'node:assert/strict';
import {planTransition,cardLayoutChanged} from '../public/table-motion.js';
import {MultiTableMotion} from '../public/table-motion-multi.js';
import {RoomAuthority} from '../src/room.js';
const c=(id,color='red',value='3')=>({id,color,value});
const state=(hand,count=7,top=c('top'),move=null)=>({round:1,me:0,players:[{hand,count:hand.length},{count}],top,lastMove:move});
test('draw animates only the added card while surviving cards keep their keys',()=>{const a=c('a'),b=c('b'),d=c('drawn');const plan=planTransition(state([a,b]),state([a,b,d]));assert.deepEqual(plan.added,[d]);assert.deepEqual(plan.removed,[]);assert.equal(plan.topChanged,false);assert.equal(plan.opponentAdded,0);});
test('local play and opponent play use their respective source hands',()=>{const a=c('a'),b=c('b');const own=planTransition(state([a,b]),state([b],7,a,{type:'play',card:'a',player:0}));assert.equal(own.ownPlayed,a);assert.equal(own.opponentPlayed,false);assert.deepEqual(own.removed,[a]);const other=planTransition(state([a,b]),state([a,b],6,c('op-card'),{type:'play',card:'op-card',player:1}));assert.equal(other.opponentPlayed,true);assert.equal(other.opponentAdded,0);});
test('a pending +4 plays first; accepting it later draws four without replaying the discard',()=>{const a=c('wild','wild','wild4'),keep=c('keep');const before=state([a,keep],3);const pending={...state([keep],3,a,{type:'play',card:a.id,player:0}),pendingDraw:{count:4,value:'wild4'}};const played=planTransition(before,pending);assert.equal(played.ownPlayed,a);assert.equal(played.opponentAdded,0);const accepted=planTransition(pending,state([keep],7,a,{type:'draw',player:1}));assert.equal(accepted.opponentAdded,4);assert.equal(accepted.topChanged,false);assert.equal(accepted.ownPlayed,null);});
test('new round deals every card, reconnect does not re-deal an existing hand',()=>{const a=c('a'),b=c('b');const next=state([a,b]);assert.equal(planTransition(null,next).deal,true);assert.equal(planTransition(next,structuredClone(next)).deal,false);const round2={...next,round:2};assert.equal(planTransition(next,round2).added.length,2);});
test('multi-card draws and timeouts use the deck without inventing a discard move',()=>{const a=c('a'),b=c('b'),d=c('d');const before=state([a]);const plan=planTransition(before,state([a,b,d],7,before.top,{type:'timeout',player:0}));assert.equal(plan.topChanged,false);assert.deepEqual(plan.added,[b,d]);assert.equal(plan.opponentPlayed,false);});

test('card layout ignores chat, readiness and UNO flags but detects card, seat and hand-order changes',()=>{
  const before=state([c('a'),c('b')]),same=structuredClone(before);same.players[0].uno=true;same.players[1].ready=true;same.players[1].online=false;same.turn=1;
  assert.equal(cardLayoutChanged(before,same),false);
  const change=edit=>{const next=structuredClone(before);edit(next);assert.equal(cardLayoutChanged(before,next),true);};
  change(s=>s.players[0].hand.reverse());change(s=>s.players[1].count++);change(s=>s.players[1].name='New player');change(s=>s.round++);change(s=>s.top=c('new-top'));change(s=>s.players[0].hand.push(c('new')));
});

test('unchanged multiplayer cards update controls and reveals without reading or rebuilding layout',async t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});t.after(()=>old?Object.defineProperty(globalThis,'matchMedia',old):Reflect.deleteProperty(globalThis,'matchMedia'));
  const motion=new MultiTableMotion({seats:{top:{hand:{}}}}),before=state([c('a')]);let interactions=0,reveals=0;
  motion.capture=()=>{throw new Error('Unchanged cards must not read layout');};motion.reconcile=()=>{throw new Error('Unchanged cards must keep their DOM');};
  motion.updateInteraction=()=>interactions++;motion.syncReveals=()=>reveals++;
  for(let i=0;i<20;i++)await motion.update(before,structuredClone(before));
  assert.equal(interactions,20);assert.equal(reveals,20);
});
test('host snapshots remain immutable so a real draw is recognized as an incoming card',()=>{const room=new RoomAuthority('Masa','Umut',crypto.randomUUID());room.join('Deniz',crypto.randomUUID());const before=room.snapshot(0);room.play(0,{type:'draw'},room.revision);const after=room.snapshot(0);assert.equal(before.state.players[0].hand.length,7);assert.equal(after.state.players[0].hand.length,8);assert.equal(planTransition(before.state,after.state).added.length,1);});
