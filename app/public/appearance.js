import {DECKS,setDeckTheme,deckFiles} from './card-themes.js';
import {face} from './cards.js';
import {APPEARANCE_POLICY} from './release-policy.js';
import {storageKey} from '../src/environment.js';
export const TABLES=[
  {id:'green',name:'Yeşil',felt:'#10362c',glow:'#24624460',panel:'#16382e',deep:'#0d2e25'},
  {id:'wine',name:'Bordo',felt:'#48232d',glow:'#81404c50',panel:'#4a2934',deep:'#321b24'},
  {id:'navy',name:'Lacivert',felt:'#182e46',glow:'#3f648a55',panel:'#20364e',deep:'#132438'},
  {id:'charcoal',name:'Antrasit',felt:'#292b2c',glow:'#565b6040',panel:'#323638',deep:'#202426'},
  {id:'mauve',name:'Leylak',felt:'#40334c',glow:'#80658c50',panel:'#483c54',deep:'#30273b'},
  {id:'rose',name:'Gülkurusu',felt:'#583a42',glow:'#a26c7350',panel:'#5c4048',deep:'#412c34'},
  {id:'minecraft',name:'Minecraft',felt:'#152b20',glow:'#223b2900',panel:'#1b3025',deep:'#10251b'}
];
export const DEFAULT_APPEARANCE=Object.freeze({table:TABLES[0].id,deck:DECKS[0].id});
export function readAppearance(storage){try{storage??=globalThis.localStorage;const data=JSON.parse(storage.getItem(storageKey('uno-look-v1')));return {table:TABLES.some(t=>t.id===data?.table)?data.table:DEFAULT_APPEARANCE.table,deck:DECKS.some(d=>d.id===data?.deck)?data.deck:DEFAULT_APPEARANCE.deck};}catch{return {...DEFAULT_APPEARANCE};}}
export function saveAppearance(look,storage){try{storage??=globalThis.localStorage;storage.setItem(storageKey('uno-look-v1'),JSON.stringify({...look,version:2}));}catch{}}
export function chooseDeckAppearance(look,id,{matchTable=true}={}){
  if(!DECKS.some(d=>d.id===id))return {...look};
  return {table:matchTable&&id==='minecraft'&&id!==look.deck?'minecraft':look.table,deck:id};
}
const loaded=new Map();
function loadDeck(id){
  if(loaded.has(id))return loaded.get(id);
  const job=Promise.all(deckFiles(id).map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error('Kart tasarımı yüklenemedi.'));image.src=src;})));
  loaded.set(id,job);job.catch(()=>loaded.delete(id));return job;
}
export function mountAppearance({onDeckChange,onError}){
  const $=id=>document.getElementById(id);
  if(!APPEARANCE_POLICY.tables&&!APPEARANCE_POLICY.cards){$('appearance-toggle').hidden=true;setDeckTheme('classic');return {ensureDeck:()=>Promise.resolve(),setBusy:()=>{}};}
  $('appearance-toggle').hidden=false;
  const panel=$('appearance-panel');let look=readAppearance(),built=false,loading=false,busy=false,previewDeck;
  if(!APPEARANCE_POLICY.tables)look.table='green';
  if(!APPEARANCE_POLICY.cards)look.deck='classic';
  $('table-options').hidden=!APPEARANCE_POLICY.tables;$('deck-options').hidden=!APPEARANCE_POLICY.cards;$('appearance-preview').hidden=!APPEARANCE_POLICY.cards;
  const table=()=>{const t=TABLES.find(t=>t.id===look.table);document.body.dataset.table=t.id;for(const name of ['felt','glow','panel','deep'])document.body.style.setProperty('--'+({glow:'felt-glow',deep:'table-deep'}[name]??name),t[name]);};
  const refresh=()=>{for(const b of panel.querySelectorAll('button[data-table]'))b.setAttribute('aria-pressed',String(b.dataset.table===look.table));for(const b of panel.querySelectorAll('button[data-deck]')){b.setAttribute('aria-pressed',String(b.dataset.deck===look.deck));b.disabled=loading||busy;}if(built&&previewDeck!==look.deck){previewDeck=look.deck;$('appearance-preview').innerHTML=[{id:'3',color:'red',value:'7'},{id:'24',color:'blue',value:'skip'},{id:'104',color:'wild',value:'wild4'}].map(c=>`<span class="sample-card">${face(c)}</span>`).join('');}};
  const open=value=>{panel.hidden=!value;$('appearance-toggle').setAttribute('aria-expanded',String(value));if(value&&!built){built=true;$('table-options').innerHTML=TABLES.map(t=>`<button type="button" data-table="${t.id}" aria-label="${t.name}" title="${t.name}" style="--swatch:${t.felt}"></button>`).join('');$('deck-options').innerHTML=DECKS.map(d=>`<button type="button" data-deck="${d.id}"><span class="deck-sample">${face({color:'wild'},true,d.id,{preview:true})}</span><span>${d.name}</span></button>`).join('');refresh();}if(value)void loadDeck(look.deck).then(refresh).catch(e=>onError(e.message));};
  $('appearance-toggle').onclick=()=>open(panel.hidden);$('appearance-close').onclick=()=>open(false);
  panel.addEventListener('click',async event=>{
    const swatch=event.target.closest('button[data-table]'),deck=event.target.closest('button[data-deck]');
    if(swatch){look.table=swatch.dataset.table;table();saveAppearance(look);refresh();}
    if(deck&&!loading&&!busy&&deck.dataset.deck!==look.deck){loading=true;refresh();try{await loadDeck(deck.dataset.deck);look=chooseDeckAppearance(look,deck.dataset.deck,{matchTable:APPEARANCE_POLICY.tables});table();setDeckTheme(look.deck);saveAppearance(look);onDeckChange();}catch(error){onError(error.message);}finally{loading=false;refresh();}}
  });
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!$('appearance-toggle').contains(event.target))open(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')open(false);});
  table();setDeckTheme(look.deck);saveAppearance(look);
  return {ensureDeck:()=>loadDeck(look.deck),setBusy:value=>{if(busy===value)return;busy=value;if(built)refresh();}};
}
