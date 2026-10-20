import {DECKS,setDeckTheme,deckFiles,specialDeckFiles} from './card-themes.js';
import {face} from './cards.js';
import {THEMED_TABLES,DECK_TABLES,tableBackgroundUrl} from './table-backgrounds.js';
import {APPEARANCE_POLICY} from './release-policy.js';
import {storageKey} from '../src/environment.js';
export const TABLES=[
  {id:'green',name:'Yeşil',felt:'#10362c',glow:'#24624460',panel:'#16382e',deep:'#0d2e25'},
  {id:'wine',name:'Bordo',felt:'#48232d',glow:'#81404c50',panel:'#4a2934',deep:'#321b24'},
  {id:'navy',name:'Lacivert',felt:'#182e46',glow:'#3f648a55',panel:'#20364e',deep:'#132438'},
  {id:'charcoal',name:'Antrasit',felt:'#292b2c',glow:'#565b6040',panel:'#323638',deep:'#202426'},
  {id:'mauve',name:'Leylak',felt:'#40334c',glow:'#80658c50',panel:'#483c54',deep:'#30273b'},
  {id:'rose',name:'Gülkurusu',felt:'#583a42',glow:'#a26c7350',panel:'#5c4048',deep:'#412c34'},
  ...THEMED_TABLES
];
export const DEFAULT_APPEARANCE=Object.freeze({table:TABLES[0].id,deck:DECKS[0].id,tableSource:'auto'});
const validTable=id=>TABLES.some(t=>t.id===id);
function normalizeAppearance(data,{legacy=false}={}){
  const deck=DECKS.some(d=>d.id===data?.deck)?data.deck:'classic',linked=DECK_TABLES[deck];
  if(!data||!validTable(data.table))return {table:linked,deck,tableSource:'auto'};
  if(data.tableSource==='auto')return {table:linked,deck,tableSource:'auto'};
  if(data.tableSource==='manual')return {table:data.table,deck,tableSource:'manual'};
  if(legacy&&data.table==='minecraft'&&deck!=='minecraft')return {table:linked,deck,tableSource:'auto'};
  return {table:data.table,deck,tableSource:data.table===linked?'auto':'manual'};
}
export function readAppearance(storage){try{storage??=globalThis.localStorage;return normalizeAppearance(JSON.parse(storage.getItem(storageKey('uno-look-v1'))),{legacy:true});}catch{return {...DEFAULT_APPEARANCE};}}
export function saveAppearance(look,storage){try{storage??=globalThis.localStorage;storage.setItem(storageKey('uno-look-v1'),JSON.stringify({...normalizeAppearance(look),version:4}));}catch{}}
export function chooseTableAppearance(look,id){const current=normalizeAppearance(look);return validTable(id)?{...current,table:id,tableSource:'manual'}:current;}
export function chooseDeckAppearance(look,id,{matchTable=true}={}){
  const current=normalizeAppearance(look);
  if(!DECKS.some(d=>d.id===id)||id===current.deck)return current;
  return {table:matchTable?DECK_TABLES[id]:current.table,deck:id,tableSource:matchTable?'auto':'manual'};
}
const loaded=new Map();
function loadDeck(id,rules='classic'){
  const key=id+':'+rules;if(loaded.has(key))return loaded.get(key);
  const job=Promise.all([...deckFiles(id),...(rules==='special'?specialDeckFiles(id):[])].map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>Promise.resolve(image.decode?.()).catch(()=>{}).then(resolve);image.onerror=()=>reject(new Error('Kart tasarımı yüklenemedi.'));image.src=src;})));
  loaded.set(key,job);job.catch(()=>loaded.delete(key));return job;
}
export function mountAppearance({onDeckChange,onError,rules:initialRules='classic'}){
  const $=id=>document.getElementById(id);
  if(!APPEARANCE_POLICY.tables&&!APPEARANCE_POLICY.cards){$('appearance-toggle').hidden=true;setDeckTheme('classic');return {ensureDeck:()=>Promise.resolve(),setBusy:()=>{}};}
  $('appearance-toggle').hidden=false;
  const panel=$('appearance-panel');let look=readAppearance(),built=false,loading=false,busy=false,previewDeck,rules=initialRules,tableRevision=0;
  if(!APPEARANCE_POLICY.tables)look=chooseTableAppearance(look,'green');
  if(!APPEARANCE_POLICY.cards)look.deck='classic';
  $('table-options').hidden=!APPEARANCE_POLICY.tables;$('deck-options').hidden=!APPEARANCE_POLICY.cards;$('appearance-preview').hidden=!APPEARANCE_POLICY.cards;
  const table=()=>{const t=TABLES.find(t=>t.id===look.table);document.body.dataset.table=t.id;document.body.classList.toggle('themed-table',!!t.wide);for(const name of ['felt','glow','panel','deep'])document.body.style.setProperty('--'+({glow:'felt-glow',deep:'table-deep'}[name]??name),t[name]);for(const size of ['wide','portrait']){const key='--table-art-'+size;if(t[size])document.body.style.setProperty(key,`url("${tableBackgroundUrl(t[size])}")`);else document.body.style.removeProperty(key);}};
  const refresh=()=>{for(const b of panel.querySelectorAll('button[data-table]'))b.setAttribute('aria-pressed',String(b.dataset.table===look.table));for(const b of panel.querySelectorAll('button[data-deck]')){b.setAttribute('aria-pressed',String(b.dataset.deck===look.deck));b.disabled=loading||busy;}if(built&&previewDeck!==look.deck){previewDeck=look.deck;$('appearance-preview').innerHTML=[{id:'3',color:'red',value:'7'},{id:'24',color:'blue',value:'skip'},{id:'104',color:'wild',value:'wild4'}].map(c=>`<span class="sample-card">${face(c)}</span>`).join('');}};
  const open=value=>{panel.hidden=!value;$('appearance-toggle').setAttribute('aria-expanded',String(value));if(value&&!built){built=true;$('table-options').innerHTML=TABLES.map(t=>`<button type="button" data-table="${t.id}" aria-label="${t.name}" title="${t.name}" style="--swatch:${t.felt}"></button>`).join('');$('deck-options').innerHTML=DECKS.map(d=>`<button type="button" data-deck="${d.id}"><span class="deck-sample">${face({color:'wild'},true,d.id,{preview:true})}</span><span>${d.name}</span></button>`).join('');refresh();}if(value)void loadDeck(look.deck,rules).then(refresh).catch(e=>onError(e.message));};
  $('appearance-toggle').onclick=()=>open(panel.hidden);$('appearance-close').onclick=()=>open(false);
  panel.addEventListener('click',async event=>{
    const swatch=event.target.closest('button[data-table]'),deck=event.target.closest('button[data-deck]');
    if(swatch){tableRevision++;look=chooseTableAppearance(look,swatch.dataset.table);table();saveAppearance(look);refresh();}
    if(deck&&!loading&&!busy&&deck.dataset.deck!==look.deck){const revision=tableRevision;loading=true;refresh();try{await loadDeck(deck.dataset.deck,rules);look=chooseDeckAppearance(look,deck.dataset.deck,{matchTable:APPEARANCE_POLICY.tables&&revision===tableRevision});table();setDeckTheme(look.deck);saveAppearance(look);onDeckChange();}catch(error){onError(error.message);}finally{loading=false;refresh();}}
  });
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!$('appearance-toggle').contains(event.target))open(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')open(false);});
  table();setDeckTheme(look.deck);saveAppearance(look);
  void loadDeck(look.deck,rules).catch(()=>{});
  return {ensureDeck:(value=rules)=>{rules=value;return loadDeck(look.deck,rules);},setBusy:value=>{if(busy===value)return;busy=value;if(built)refresh();}};
}
