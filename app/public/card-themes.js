export const DECKS=[{id:'classic',name:'Klasik'},{id:'cats',name:'Kediler'},{id:'seal',name:'Fok'},{id:'kuromi',name:'Kuromi'},{id:'adventure',name:'Adventure Time'}];
let current='classic';
export function setDeckTheme(id){current=DECKS.some(d=>d.id===id)?id:'classic';return current;}
export const getDeckTheme=()=>current;
export const deckFiles=id=>id==='classic'||!DECKS.some(d=>d.id===id)?[]:[`./assets/cards/${id}-a.webp`,`./assets/cards/${id}-b.webp`];
const colors={red:'#df1837',yellow:'#efc50e',green:'#139854',blue:'#087ddd',wild:'#23212c'};
const family={cats:{paper:'#fff9ef',ink:'#3d302a'},seal:{paper:'#fffdfa',ink:'#232225'},kuromi:{paper:'#fff7fe',ink:'#302238'},adventure:{paper:'#fffce9',ink:'#172e36'}};
export function sceneIndex(c,back=false){
  if(back)return 31;
  const color=Math.max(0,['red','yellow','green','blue'].indexOf(c.color));
  const copy=(Number.parseInt(c.id,10)||0)%2;
  if(/^\d$/.test(c.value))return (Number(c.value)*2+color*5+copy)%24;
  return ({skip:24+(color+copy)%2,reverse:26+(color+copy)%2,draw2:28,wild:29,wild4:30})[c.value]??29;
}
function art(theme,index,{preview=false}={}){
  if(preview)return `<image href="./assets/cards/${theme}-cover.webp" x="9" y="29" width="82" height="95" preserveAspectRatio="xMidYMid meet"/>`;
  const local=index%16,column=local%4,row=Math.floor(local/4),sheet=index<16?'a':'b';
  return `<svg x="7" y="34" width="86" height="86" style="width:86%;height:57.333333%;overflow:hidden" viewBox="${column*100} ${row*100} 100 100" preserveAspectRatio="xMidYMid meet"><image href="./assets/cards/${theme}-${sheet}.webp" x="0" y="0" width="400" height="400"/></svg>`;
}
const multicolor='<path d="M15 6a9 9 0 0 1 9 9h-9Z" fill="#df1837"/><path d="M24 15a9 9 0 0 1-9 9v-9Z" fill="#087ddd"/><path d="M15 24a9 9 0 0 1-9-9h9Z" fill="#139854"/><path d="M6 15a9 9 0 0 1 9-9v9Z" fill="#efc50e"/>';
function glyph(value,fill){
  if(value==='wild')return `<g transform="translate(3 3)">${multicolor}<circle cx="15" cy="15" r="9.6" fill="none" stroke="#fffdfa" stroke-width="1.4"/></g>`;
  if(value==='skip')return `<g transform="translate(17 19)" fill="none" stroke="${fill}" stroke-width="3.2"><circle r="9"/><path d="m-6 6 12-12"/></g>`;
  if(value==='reverse')return `<g transform="translate(7 8)" fill="${fill}"><path d="M0 8V3h13V0l9 7-9 7v-4H4v3H0Zm22 7v5H9v3l-9-7 9-7v4h9v-3h4Z"/></g>`;
  const text=value==='wild4'?'+4':value==='draw2'?'+2':value;
  return `<text x="9" y="29" fill="${fill}" font-family="Arial,Helvetica,sans-serif" font-style="italic" font-size="${String(text).length>1?21:27}" font-weight="800">${text}</text>${['6','9'].includes(value)?`<path d="M9 32h16" stroke="${fill}" stroke-width="1.5"/>`:''}`;
}
export function themedFace(c,back,theme,{preview=false}={}){
  const f=family[theme];if(!f)return '';
  const color=back?({cats:'#c99c73',seal:'#242126',kuromi:'#68517e',adventure:'#2b7181'})[theme]:colors[c.color]??colors.wild;
  const wild=c.color==='wild'&&!back;
  const frame=theme==='adventure'?`<rect x="12" y="31" width="76" height="88" rx="12" fill="${f.paper}" stroke="${f.ink}" stroke-width="1.4"/>`:theme==='kuromi'?`<rect x="13" y="29" width="74" height="94" rx="28" fill="${f.paper}" stroke="#c6a3d5" stroke-width="1.3"/>`:`<ellipse cx="50" cy="76" rx="37" ry="55" transform="rotate(24 50 76)" fill="${f.paper}" stroke="${f.ink}" stroke-width="1.2"/>`;
  const stripes=wild||back?['#df1837','#efc50e','#139854','#087ddd'].map((fill,i)=>`<path d="M${52+i*9} 5h13L95 ${29-i*6}v12Z" fill="${fill}" opacity=".9"/><path d="M${48-i*9} 145H${35-i*9}L5 ${116+i*6}v-12Z" fill="${fill}" opacity=".9"/>`).join(''):'';
  const corners=back?'':glyph(c.value,c.color==='yellow'?f.ink:'#fffdfa');
  const dots=back?['#df1837','#efc50e','#139854','#087ddd'].map((fill,i)=>`<circle cx="${35+i*10}" cy="134" r="2.6" fill="${fill}" stroke="${f.paper}" stroke-width=".5"/>`).join(''):'';
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-deck="${theme}"><rect x=".7" y=".7" width="98.6" height="148.6" rx="9" fill="${f.paper}" stroke="${f.ink}" stroke-width="1.4"/><rect x="5" y="5" width="90" height="140" rx="5.5" fill="${color}"/>${stripes}${frame}${art(theme,sceneIndex(c,back),{preview})}${corners}<g transform="rotate(180 50 75)">${corners}</g>${dots}<path d="M10 5h78" fill="none" stroke="#fff" opacity=".25"/></svg>`;
}
