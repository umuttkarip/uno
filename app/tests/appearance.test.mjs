import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {deck} from '../src/engine.js';
import {DECKS,sceneIndex,setDeckTheme,getDeckTheme,deckFiles,deckCoverFile,FEATURED_SCENES} from '../public/card-themes.js';
import {face,card} from '../public/cards.js';
import {TABLES,DEFAULT_APPEARANCE,readAppearance,saveAppearance,chooseDeckAppearance} from '../public/appearance.js';

test('classic stays the default and does not request any illustration atlases',()=>{
  assert.equal(getDeckTheme(),'classic');assert.deepEqual(deckFiles('classic'),[]);assert.doesNotMatch(face({color:'red',value:'4'}),/<image/);assert.equal(setDeckTheme('unknown'),'classic');assert.deepEqual(deckFiles('../bad'),[]);
});
test('108 cards cover all 24 numeric scenes; paired cards vary and action scenes have dedicated slots',()=>{
  const cards=deck(),numeric=cards.filter(c=>/^\d$/.test(c.value));assert.equal(new Set(numeric.map(c=>sceneIndex(c))).size,24);
  for(const color of ['red','yellow','green','blue'])for(const value of ['1','2','3','4','5','6','7','8','9']){const pair=cards.filter(c=>c.color===color&&c.value===value);assert.notEqual(sceneIndex(pair[0]),sceneIndex(pair[1]));}
  for(const [value,indices]of Object.entries({skip:[24,25],reverse:[26,27],draw2:[28],wild:[29],wild4:[30]}))for(const c of cards.filter(c=>c.value===value))assert.ok(indices.includes(sceneIndex(c)));
});
test('every themed back is identical for all hidden cards, and front semantics remain legible',()=>{
  for(const theme of DECKS.filter(d=>d.id!=='classic')){let back;for(const c of deck()){const markup=face(c,true,theme.id);back??=markup;assert.equal(markup,back);if(theme.id==='minecraft')assert.match(markup,/>UNO<\/text>/);else assert.match(markup,new RegExp(theme.id+'-b.webp'));assert.equal(sceneIndex(c,true,theme.id),theme.id==='minecraft'?67:31);const front=face(c,false,theme.id);assert.match(front,/viewBox="0 0 100 150"/);assert.match(front,/<image/);if(/^\d$/.test(c.value))assert.match(front,new RegExp(theme.id==='minecraft'?'data-card-value="'+c.value+'"':'>'+c.value+'</text>'));}
    const old=setDeckTheme(theme.id);assert.equal(old,theme.id);assert.match(card({id:'105',color:'wild',value:'wild4'},{button:true}),/aria-label="Joker \+4"/);
  }setDeckTheme('classic');
});

test('Minecraft covers 67 active scenes with 46 number scenes and dedicated color/action artwork',()=>{
  const cards=deck(),numbers=cards.filter(c=>/^\d$/.test(c.value)),frequency=new Map();
  for(const c of numbers){const i=sceneIndex(c,false,'minecraft');assert.ok(i<40||i>=61&&i<=66);frequency.set(i,(frequency.get(i)??0)+1);assert.match(face(c,false,'minecraft'),new RegExp('>'+c.value+'</text>'));}
  assert.equal(frequency.size,46);assert.ok([...frequency.values()].every(count=>count<=2));
  for(const color of ['red','yellow','green','blue']){const sameColor=numbers.filter(c=>c.color===color);assert.equal(new Set(sameColor.map(c=>sceneIndex(c,false,'minecraft'))).size,sameColor.length);}
  for(const value of ['skip','reverse','draw2','wild','wild4'])assert.equal(new Set(cards.filter(c=>c.value===value).map(c=>sceneIndex(c,false,'minecraft'))).size,4);
  const fronts=new Set(cards.map(c=>sceneIndex(c,false,'minecraft')));assert.equal(fronts.size,66);assert.equal(fronts.has(60),false);assert.equal(fronts.has(67),false);
  const back=face(cards[0],true,'minecraft');assert.doesNotMatch(back,/data-card-value|minecraft-art-d\.webp/);assert.match(back,/>UNO<\/text>/);assert.match(back,/minecraft-art-e\.webp/);assert.equal(deckFiles('minecraft').length,5);
  assert.match(face(cards[0],true,'minecraft',{preview:true}),/minecraft-back-cover\.webp/);
});

test('Minecraft illustrations are transparent layers rather than oval or rectangular photo windows',async()=>{
  for(const sheet of ['a','b','c','d','e']){const data=await readFile(new URL('../public/assets/cards/minecraft-art-'+sheet+'.webp',import.meta.url));assert.equal(data.toString('ascii',12,16),'VP8X');assert.ok(data[20]&16,sheet+' must preserve alpha');}
  for(const c of deck()){const front=face(c,false,'minecraft');assert.doesNotMatch(front,/<clipPath|<mask|<ellipse|linearGradient|radialGradient/);assert.match(front,/<image/);}
});

test('every color has an axolotl in Minecraft and Marceline in Adventure Time',()=>{
  const cards=deck();
  for(const [theme,character] of [['minecraft','axolotl'],['adventure','marceline']])for(const color of ['red','yellow','green','blue']){
    const examples=cards.filter(c=>c.color===color&&FEATURED_SCENES[theme][character].includes(sceneIndex(c,false,theme)));
    assert.ok(examples.some(c=>/^\d$/.test(c.value)),`${color} ${character} must appear on a number card`);
  }
});

test('Adventure Time uses all 64 scenes, with no number scene appearing more than twice',()=>{
  const cards=deck(),numbers=cards.filter(c=>/^\d$/.test(c.value)),counts=new Map();
  for(const c of numbers){const index=sceneIndex(c,false,'adventure');assert.ok(index<24||index>=32&&index<=50);counts.set(index,(counts.get(index)??0)+1);}
  assert.equal(counts.size,43);assert.ok([...counts.values()].every(count=>count<=2));
  for(const color of ['red','yellow','green','blue']){const sameColor=numbers.filter(c=>c.color===color);assert.equal(new Set(sameColor.map(c=>sceneIndex(c,false,'adventure'))).size,sameColor.length);}
  for(const value of ['0','1','2','3','4','5','6','7','8','9']){const sameValue=numbers.filter(c=>c.value===value);assert.equal(new Set(sameValue.map(c=>sceneIndex(c,false,'adventure'))).size,sameValue.length);}
  const groups={skip:[24,25,51,52],reverse:[26,27,53,54],draw2:[28,55,56,57],wild:[29,58,59,60],wild4:[30,61,62,63]};
  for(const [value,indices] of Object.entries(groups))assert.deepEqual([...new Set(cards.filter(c=>c.value===value).map(c=>sceneIndex(c,false,'adventure')))].sort((a,b)=>a-b),indices);
  for(const color of ['red','yellow','green','blue'])for(const value of ['skip','reverse','draw2']){const pair=cards.filter(c=>c.color===color&&c.value===value);assert.notEqual(sceneIndex(pair[0],false,'adventure'),sceneIndex(pair[1],false,'adventure'));}
  const allCounts=new Map();for(const c of cards){const i=sceneIndex(c,false,'adventure');allCounts.set(i,(allCounts.get(i)??0)+1);}assert.ok([...allCounts.values()].every(count=>count<=2));
  const fronts=new Set(cards.map(c=>sceneIndex(c,false,'adventure')));assert.equal(fronts.size,63);assert.equal(fronts.has(31),false);
  for(let index=0;index<64;index++)assert.ok(index===31||fronts.has(index));
  assert.equal(deckFiles('adventure').length,4);
});

test('Adventure Time expansion keeps transparent artwork and uses the correct new atlas cells',async()=>{
  // VP8L: after the signature, width/height occupy 28 bits and alpha is bit 28.
  // https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification#3_riff_header
  for(const sheet of ['c','d']){const data=await readFile(new URL('../public/assets/cards/adventure-'+sheet+'.webp',import.meta.url));assert.equal(data.toString('ascii',12,16),'VP8L');assert.ok(data[24]&16,sheet+' must preserve alpha');}
  for(const c of deck()){
    const index=sceneIndex(c,false,'adventure'),sheet=['a','b','c','d'][Math.floor(index/16)],markup=face(c,false,'adventure');
    assert.match(markup,new RegExp('adventure-'+sheet+'\\.webp'));assert.doesNotMatch(markup,/<clipPath|<mask/);
  }
});
test('appearance preferences validate identifiers and tolerate disabled storage',()=>{
  assert.equal(TABLES[0].id,'green');assert.deepEqual(DEFAULT_APPEARANCE,{table:'green',deck:'classic'});
  let saved;const store={getItem:()=>saved,setItem:(key,value)=>saved=value};assert.deepEqual(readAppearance(store),{table:'green',deck:'classic'});
  for(const table of TABLES)for(const deck of DECKS){saveAppearance({table:table.id,deck:deck.id},store);assert.deepEqual(readAppearance(store),{table:table.id,deck:deck.id});}
  saved='{"table":"invalid","deck":"<script>"}';assert.deepEqual(readAppearance(store),{table:'green',deck:'classic'});const blocked={getItem(){throw 0;},setItem(){throw 0;}};assert.doesNotThrow(()=>saveAppearance({},blocked));assert.equal(readAppearance(blocked).deck,'classic');
});

test('a saved card/background pair is restored exactly, including older Minecraft preferences',()=>{
  let saved;const store={getItem:()=>saved,setItem:(key,value)=>saved=value};
  for(const version of [undefined,0,1,2])for(const table of TABLES){saved=JSON.stringify({table:table.id,deck:'minecraft',version});assert.deepEqual(readAppearance(store),{table:table.id,deck:'minecraft'});}
  saveAppearance({table:'rose',deck:'minecraft'},store);assert.deepEqual(readAppearance(store),{table:'rose',deck:'minecraft'});
});

test('selecting Minecraft suggests its table once; later independent choices survive reselecting and reopening',()=>{
  assert.deepEqual(chooseDeckAppearance({table:'wine',deck:'classic'},'minecraft'),{table:'minecraft',deck:'minecraft'});
  assert.deepEqual(chooseDeckAppearance({table:'green',deck:'classic'},'minecraft',{matchTable:false}),{table:'green',deck:'minecraft'});
  for(const table of TABLES){const personal={table:table.id,deck:'minecraft'};assert.deepEqual(chooseDeckAppearance(personal,'minecraft'),personal);for(const deck of DECKS.filter(d=>d.id!=='minecraft'))assert.equal(chooseDeckAppearance(personal,deck.id).table,table.id);}
  assert.deepEqual(chooseDeckAppearance({table:'navy',deck:'adventure'},'unknown'),{table:'navy',deck:'adventure'});
});

test('optional Minecraft backgrounds have separate mobile/desktop files within a small combined budget',async()=>{
  let total=0;for(const name of ['wide','portrait']){const path=new URL('../public/assets/tables/minecraft-'+name+'.webp',import.meta.url),data=await readFile(path);assert.equal(data.toString('ascii',8,12),'WEBP');total+=data.length;}assert.ok(total<65000,total+' bytes');
});
test('optional decks retain small media budgets, including the Minecraft expansion and chooser cover',async()=>{
  for(const theme of DECKS.filter(d=>d.id!=='classic')){let bytes=0;for(const file of [...deckFiles(theme.id),deckCoverFile(theme.id)]){const path=new URL('../public/'+file.slice(2),import.meta.url),buffer=await readFile(path);assert.equal(buffer.toString('ascii',8,12),'WEBP');bytes+=(await stat(path)).size;}assert.ok(bytes<(theme.id==='minecraft'?240000:220000),`${theme.id}: ${bytes}`);}
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
