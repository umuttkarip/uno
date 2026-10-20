import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {deck} from '../src/engine.js';
import {DECKS,sceneIndex,setDeckTheme,getDeckTheme,deckFiles} from '../public/card-themes.js';
import {face,card} from '../public/cards.js';
import {TABLES,readAppearance,saveAppearance} from '../public/appearance.js';

test('classic stays the default and does not request any illustration atlases',()=>{
  assert.equal(getDeckTheme(),'classic');assert.deepEqual(deckFiles('classic'),[]);assert.doesNotMatch(face({color:'red',value:'4'}),/<image/);assert.equal(setDeckTheme('unknown'),'classic');assert.deepEqual(deckFiles('../bad'),[]);
});
test('108 cards cover all 24 numeric scenes; paired cards vary and action scenes have dedicated slots',()=>{
  const cards=deck(),numeric=cards.filter(c=>/^\d$/.test(c.value));assert.equal(new Set(numeric.map(c=>sceneIndex(c))).size,24);
  for(const color of ['red','yellow','green','blue'])for(const value of ['1','2','3','4','5','6','7','8','9']){const pair=cards.filter(c=>c.color===color&&c.value===value);assert.notEqual(sceneIndex(pair[0]),sceneIndex(pair[1]));}
  for(const [value,indices]of Object.entries({skip:[24,25],reverse:[26,27],draw2:[28],wild:[29],wild4:[30]}))for(const c of cards.filter(c=>c.value===value))assert.ok(indices.includes(sceneIndex(c)));
});
test('every themed back is identical for all hidden cards, and front semantics remain legible',()=>{
  for(const theme of DECKS.filter(d=>d.id!=='classic')){let back;for(const c of deck()){const markup=face(c,true,theme.id);back??=markup;assert.equal(markup,back);assert.match(markup,new RegExp(theme.id+'-b.webp'));assert.equal(sceneIndex(c,true),31);const front=face(c,false,theme.id);assert.match(front,/viewBox="0 0 100 150"/);assert.match(front,/<image/);if(/^\d$/.test(c.value))assert.match(front,new RegExp('>'+c.value+'</text>'));}
    const old=setDeckTheme(theme.id);assert.equal(old,theme.id);assert.match(card({id:'105',color:'wild',value:'wild4'},{button:true}),/aria-label="Joker \+4"/);
  }setDeckTheme('classic');
});
test('appearance preferences validate identifiers and tolerate disabled storage',()=>{
  let saved;const store={getItem:()=>saved,setItem:(key,value)=>saved=value};assert.deepEqual(readAppearance(store),{table:'green',deck:'classic'});
  for(const table of TABLES)for(const deck of DECKS){saveAppearance({table:table.id,deck:deck.id},store);assert.deepEqual(readAppearance(store),{table:table.id,deck:deck.id});}
  saved='{"table":"invalid","deck":"<script>"}';assert.deepEqual(readAppearance(store),{table:'green',deck:'classic'});const blocked={getItem(){throw 0;},setItem(){throw 0;}};assert.doesNotThrow(()=>saveAppearance({},blocked));assert.equal(readAppearance(blocked).deck,'classic');
});
test('each optional illustrated deck stays under 220 KB including its tiny chooser cover',async()=>{
  for(const theme of DECKS.filter(d=>d.id!=='classic')){let bytes=0;for(const file of [...deckFiles(theme.id),`./assets/cards/${theme.id}-cover.webp`]){const path=new URL('../public/'+file.slice(2),import.meta.url),buffer=await readFile(path);assert.equal(buffer.toString('ascii',8,12),'WEBP');bytes+=(await stat(path)).size;}assert.ok(bytes<220000,`${theme.id}: ${bytes}`);}
});

test('Kuromi distributes 76 numeric cards across 40 scenes, at most twice each and never twice in one color',()=>{
  const cards=deck().filter(c=>/^\d$/.test(c.value)),counts=new Map();
  for(const c of cards){const index=sceneIndex(c,false,'kuromi');assert.ok(index<24||index>=32&&index<48);counts.set(index,(counts.get(index)??0)+1);}
  assert.equal(counts.size,40);assert.ok([...counts.values()].every(n=>n<=2));
  for(const color of ['red','yellow','green','blue']){const hand=cards.filter(c=>c.color===color);assert.equal(new Set(hand.map(c=>sceneIndex(c,false,'kuromi'))).size,hand.length);}
  for(const value of ['0','1','2','3','4','5','6','7','8','9']){const sameNumber=cards.filter(c=>c.value===value);assert.equal(new Set(sameNumber.map(c=>sceneIndex(c,false,'kuromi'))).size,sameNumber.length);}
  const green4=new Set(cards.filter(c=>c.color==='green'&&c.value==='4').map(c=>sceneIndex(c,false,'kuromi')));
  assert.ok(cards.filter(c=>c.color==='green'&&c.value==='8').every(c=>!green4.has(sceneIndex(c,false,'kuromi'))));
});
