import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {nextPlayChoice} from '../public/play-choice.js';
import {planTransition} from '../public/table-motion.js';
import {face} from '../public/cards.js';
import {DECKS,deckFiles,specialDeckFiles} from '../public/card-themes.js';
import {deck,SPECIAL_VALUES} from '../src/engine.js';
import {specialSceneIndex} from '../public/special-cards.js';
const c=(id,value='3',color='red')=>({id,value,color});
const state=(hand,counts=[hand.length,5,4],top=c('top'),lastMove=null)=>({me:0,round:1,direction:1,top,lastMove,players:counts.map((count,i)=>i?{count,name:'P'+i}:{count,hand}),playable:hand.map(c=>c.id)});

test('target, gift and color choices use only the latest own hand and masked opponent counts',()=>{
  const hand=[c('a','gift'),c('b','swap','wild'),c('d')],s=state(hand);
  assert.deepEqual(nextPlayChoice(s,{cardId:'a'}),{type:'target',players:[{index:1,name:'P1',count:5},{index:2,name:'P2',count:4}]});
  assert.deepEqual(nextPlayChoice(s,{cardId:'a',target:1}),{type:'gift',cards:hand.slice(1)});
  assert.equal(nextPlayChoice(s,{cardId:'a',target:1,giftId:'d'}).type,'ready');
  assert.equal(nextPlayChoice(s,{cardId:'b',target:1}).type,'color');
  assert.equal(nextPlayChoice(s,{cardId:'b',target:1,color:'green'}).type,'ready');
  s.playable=[];assert.equal(nextPlayChoice(s,{cardId:'b',target:1,color:'green'}).type,'invalid');
});
test('defensive special cards preserve the chosen color without opening a color picker',()=>{
  const s=state([c('a','shield','wild')]);s.pendingDraw={count:6};assert.equal(nextPlayChoice(s,{cardId:'a'}).type,'ready');
  s.pendingDraw=null;assert.equal(nextPlayChoice(s,{cardId:'a'}).type,'color');
});
test('swap, gift and rotation move between hands rather than inventing deck draws',()=>{
  const a=c('a','swap','wild'),own=[a,c('b'),c('c')],old=state(own,[3,5,4]);
  let next=state(Array.from({length:5},(_,i)=>c('n'+i)),[5,2,4],a,{type:'play',player:0,effect:'swap',target:1});
  let plan=planTransition(old,next);assert.deepEqual(plan.transfers,[{from:0,to:1,count:2},{from:1,to:0,count:5}]);assert.equal(plan.opponentAdded,0);
  next=state([own[2]],[1,6,4],a,{type:'play',player:0,effect:'gift',target:1});plan=planTransition(old,next);assert.deepEqual(plan.transfers,[{from:0,to:1,count:1}]);assert.equal(plan.opponentAdded,0);
  next=state([c('x'),c('y'),c('z'),c('w')],[4,2,5],a,{type:'play',player:0,effect:'rotate'});plan=planTransition(old,next);assert.equal(plan.transfers.length,3);assert.equal(plan.opponentAdded,0);
  next.direction=-1;next.players[1].count=4;next.players[2].count=2;next.players[0].count=5;assert.deepEqual(planTransition(old,next).transfers,[{from:0,to:2,count:2},{from:1,to:0,count:5},{from:2,to:1,count:4}]);
});
test('all seven special faces have distinct symbols, dedicated scenes and unchanged hidden backs',async()=>{
  const cards=deck('special').filter(c=>SPECIAL_VALUES.includes(c.value));
  for(const theme of DECKS){
    const rendered=new Set(SPECIAL_VALUES.map(value=>face(cards.find(c=>c.value===value),false,theme.id)));assert.equal(rendered.size,7);
    const backs=new Set(cards.map(c=>face(c,true,theme.id)));assert.equal(backs.size,1);
    for(const card of cards){const svg=face(card,false,theme.id);assert.equal(svg.includes('undefined'),false);assert.equal(svg.includes('NaN'),false);if(theme.id!=='classic'){assert.ok(svg.includes(theme.id+'-special.webp'));assert.ok(svg.includes(`viewBox="${specialSceneIndex(card)%4*100} ${Math.floor(specialSceneIndex(card)/4)*100} 100 100"`));}}
    assert.equal(deckFiles(theme.id).some(f=>f.includes('-special')),false);
    for(const file of specialDeckFiles(theme.id)){const path=new URL('../public/'+file,import.meta.url);assert.ok((await stat(path)).size<110000);const bytes=await readFile(path);assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  }
});
