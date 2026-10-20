export const DECKS=[{id:'classic',name:'Klasik'},{id:'cats',name:'Kediler'},{id:'seal',name:'Sude'},{id:'kuromi',name:'Kuromi'},{id:'adventure',name:'Adventure Time'},{id:'minecraft',name:'Minecraft'}];
let current='classic';
export function setDeckTheme(id){current=DECKS.some(d=>d.id===id)?id:'classic';return current;}
export const getDeckTheme=()=>current;
const atlasFile=(theme,sheet)=>`./assets/cards/${theme==='minecraft'?'minecraft-art':theme}-${sheet}.webp${theme==='cats'&&sheet==='b'?'?v=3':''}`;
export const deckCoverFile=id=>`./assets/cards/${id==='minecraft'?'minecraft-back-cover':id+'-cover'}.webp`;
export const deckFiles=id=>id==='classic'||!DECKS.some(d=>d.id===id)?[]:(id==='minecraft'?['a','b','c','d','e'].map(sheet=>atlasFile(id,sheet)):id==='adventure'?['a','b','c','d'].map(sheet=>atlasFile(id,sheet)):[atlasFile(id,'a'),atlasFile(id,'b'),...(id==='kuromi'?[atlasFile(id,'c')]:[])]);
export const FEATURED_SCENES={minecraft:{axolotl:[6,64,65,66]},adventure:{marceline:[4,19,46,57,59]}};
// Spread the four axolotl scenes through the pool so every color includes one.
const minecraftNumbers=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,64,22,23,24,25,26,27,28,29,30,31,65,32,33,34,35,36,37,38,39,61,62,66,63];
const colors={red:'#d90b28',yellow:'#f5c400',green:'#00954c',blue:'#086bdb',wild:'#22202a'};
const family={cats:{paper:'#fff7e7',ink:'#342b28'},seal:{paper:'#fffefa',ink:'#211e24'},kuromi:{paper:'#ffeaf7',ink:'#291b30'},adventure:{paper:'#fff9df',ink:'#172c32'}};
export function sceneIndex(c,back=false,theme='classic'){
  if(theme==='minecraft'){
    if(back)return 67;
    const color=Math.max(0,['red','yellow','green','blue'].indexOf(c.color));
    if(/^\d$/.test(c.value)){const copy=(Number.parseInt(c.id,10)||0)%2,ordinal=c.value==='0'?0:Number(c.value)*2-1+copy;return minecraftNumbers[(color*19+ordinal)%minecraftNumbers.length];}
    const variant=(Number.parseInt(c.id,10)||0)%4;
    return ({skip:40+color,reverse:44+color,draw2:48+color,wild:52+variant,wild4:56+variant})[c.value]??52;
  }
  if(back)return 31;
  const color=Math.max(0,['red','yellow','green','blue'].indexOf(c.color));
  const copy=(Number.parseInt(c.id,10)||0)%2;
  if(theme==='adventure'){
    // Retain the original 24 number scenes and seven action scenes unchanged.
    // New art occupies 32–50 (numbers) and 51–63 (actions); 31 is always the back.
    if(/^\d$/.test(c.value)){
      const ordinal=c.value==='0'?0:Number(c.value)*2-1+copy,scene=(color*19+ordinal)%43;
      return scene<24?scene:scene+8;
    }
    const action=(color+copy)%4,variant=(Number.parseInt(c.id,10)||0)%4;
    return ({skip:[24,25,51,52][action],reverse:[26,27,53,54][action],draw2:[28,55,56,57][action],wild:[29,58,59,60][variant],wild4:[30,61,62,63][variant]})[c.value]??29;
  }
  if(/^\d$/.test(c.value)){
    if(theme==='kuromi'){
      const ordinal=c.value==='0'?0:Number(c.value)*2-1+copy;
      const scene=(color*19+ordinal)%40;
      return scene<24?scene:scene+8;
    }
    return (Number(c.value)*2+color*5+copy)%24;
  }
  return ({skip:24+(color+copy)%2,reverse:26+(color+copy)%2,draw2:28,wild:29,wild4:30})[c.value]??29;
}
function art(theme,index,{preview=false,x=0,y=42,size=108}={}){
  if(preview)return `<image href="./assets/cards/${theme}-cover.webp" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  const local=index%16,column=local%4,row=Math.floor(local/4),sheet=['a','b','c','d'][Math.floor(index/16)];
  // The square viewport cuts only the atlas cell. It draws no panel or frame.
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="width:${size}%;height:${size/1.5}%;overflow:hidden" viewBox="${column*100} ${row*100} 100 100" preserveAspectRatio="xMidYMid meet"><image href="${atlasFile(theme,sheet)}" x="0" y="0" width="400" height="400"/></svg>`;
}
const palette=[colors.red,colors.yellow,colors.green,colors.blue];
function glyph(value,fill,ink='none',weight=.8){
  if(value==='wild')return `<g transform="translate(6 7) rotate(-12 12 12)" stroke="#fff9ed" stroke-width="1.1">${palette.map((color,i)=>`<path d="M${i%2*12} ${Math.floor(i/2)*12}h12v12H${i%2*12}Z" fill="${color}"/>`).join('')}</g>`;
  if(value==='skip')return `<g transform="translate(18 20)" fill="none" stroke="${ink}" stroke-width="5.2"><circle r="10"/><path d="m-7 7 14-14"/></g><g transform="translate(18 20)" fill="none" stroke="${fill}" stroke-width="3.4"><circle r="10"/><path d="m-7 7 14-14"/></g>`;
  if(value==='reverse')return `<g transform="translate(7 5) rotate(-12 12 15)" fill="${fill}" stroke="${ink}" stroke-width="${weight}" stroke-linejoin="round"><path d="M0 5h15V1l9 7-9 7v-4H0Zm24 15H9v-4l-9 7 9 7v-4h15Z"/></g>`;
  const text=value==='wild4'?'+4':value==='draw2'?'+2':value;
  return `<text x="7" y="32" fill="${fill}" stroke="${ink}" stroke-width="${weight}" paint-order="stroke" stroke-linejoin="round" font-family="Arial,Helvetica,sans-serif" font-style="italic" font-size="${String(text).length>1?26:33}" font-weight="900" letter-spacing="-1.7">${text}</text>${['6','9'].includes(value)?`<path d="M9 35h17" stroke="${fill}" stroke-width="1.8"/>`:''}`;
}
const star=(x,y,size,fill,ink='none')=>`<path d="M0-${size} 2-2 ${size} 0 2 2 0 ${size}-2 2-${size} 0-2-2Z" transform="translate(${x} ${y})" fill="${fill}" stroke="${ink}" stroke-width=".7"/>`;
const paw=(x,y,scale,fill)=>`<g transform="translate(${x} ${y}) rotate(-23) scale(${scale})" fill="${fill}"><path d="M-5 3C-6-1-2-4 0-4S6 0 5 3C4 6 1 4 0 4S-4 6-5 3Z"/><ellipse cx="-6" cy="-5" rx="1.8" ry="2.7"/><ellipse cx="-2" cy="-8" rx="1.8" ry="2.7"/><ellipse cx="2.5" cy="-8" rx="1.8" ry="2.7"/><ellipse cx="6" cy="-4.5" rx="1.8" ry="2.7"/></g>`;
const skull=(x,y,scale,fill)=>`<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}"><path d="M-7 0a7 6 0 1 1 14 0c0 3-2 4-4 5v3H-3V5c-2-1-4-2-4-5Z"/><ellipse cx="-2.5" cy="0" rx="1.6" ry="2" fill="#322036"/><ellipse cx="2.5" cy="0" rx="1.6" ry="2" fill="#322036"/></g>`;

function watermark(c,color,theme){
  if(theme==='cats'||c.value==='wild')return '';
  const value=/^\d$/.test(c.value)?c.value:c.value==='wild4'?'+4':c.value==='draw2'?'+2':null;
  const fill=theme==='kuromi'?'#fff0fb':theme==='adventure'?'#fff9dc':color;
  if(value)return `<text x="${theme==='kuromi'?11:8}" y="${theme==='adventure'?83:86}" fill="${fill}" stroke="${theme==='adventure'?'#172c32':theme==='kuromi'?'#603b6d':'none'}" stroke-width="${theme==='adventure'?2:theme==='kuromi'?1.3:0}" paint-order="stroke" font-family="Arial,Helvetica,sans-serif" font-size="${value.length>1?43:68}" font-style="italic" font-weight="900" letter-spacing="-5">${value}</text>`;
  return `<g transform="translate(1 48) scale(1.45)">${glyph(c.value,fill,theme==='adventure'?'#172c32':'none',1.2)}</g>`;
}
function rainbowBands(y,width=13){return palette.map((fill,i)=>`<path d="M-20 ${y+i*width}Q44 ${y-49+i*width} 119 ${y-22+i*width}" fill="none" stroke="${fill}" stroke-width="${width+1}"/>`).join('');}
function catPrint(color,wild,index){
  const ground=wild?'#29212a':'#fff7e7';
  return `<rect width="100" height="150" fill="${ground}"/>${wild?rainbowBands(31,13):`<path d="M0 0h100v25C62 17 34 38 0 62Z" fill="${color}"/><path d="M0 129c42 13 56-21 100-24v45H0Z" fill="${color}"/>`}<g opacity="${wild ? .15 : .13}">${paw(79,29,.75,wild?'#fff8ed':color)}${paw(85,58,.58,wild?'#fff8ed':color)}${paw(9,110,.65,wild?'#fff8ed':color)}${paw(31,132,.48,wild?'#fff8ed':color)}</g><path d="M-4 120c24 6 47-3 48-12 1-8-12-9-10-1" fill="none" stroke="${wild?'#f6dcb6':color}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/><path d="M4 40Q55 3 97 15M3 143Q40 155 97 118" fill="none" stroke="${wild?'#fff4d9':'#fff7e7'}" stroke-width="1.2"/>`;
}
function sealPrint(color,wild){
  return `<rect width="100" height="150" fill="${wild?'#27232b':color}"/>${wild?rainbowBands(37,17):''}<path d="M-12 91 87 19l26 20-5 95-107 12Z" fill="#fffefa"/><path d="m-7 82 91-64m-79 127 102-28" fill="none" stroke="${wild?'#f9b3d0':'#fffefa'}" stroke-width="2.1" stroke-linecap="round"/><path d="m-3 78 72-50m-58 113 74-17" fill="none" stroke="${wild?'#f9b3d0':'#fffefa'}" stroke-width=".8" stroke-dasharray="4 2"/><path d="m71 36 2-8m7 12 6-7M9 102l-6-4m9 12-8 1" fill="none" stroke="${wild?'#e6cae2':color}" stroke-width="1.5" stroke-linecap="round"/>${star(89,59,4,wild?'#f8e89c':color)}${star(17,126,3,wild?'#f7a5bf':color)}`;
}
function kuromiPrint(color,wild){
  return `<rect width="100" height="150" fill="#291b30"/><path d="M0 0h100v66L0 105Z" fill="${wild?'#81528f':color}"/>${wild?rainbowBands(42,12):''}<path d="M98 19 27 50 92 45 10 82 95 65 19 106 100 87v44H20Z" fill="#f9d7ed"/><path d="m4 113 96-37v22L6 135Z" fill="#bc79b5"/><path d="m-4 104 107-46M-4 139l107-46" fill="none" stroke="#edafd7" stroke-width="1.1"/><g opacity=".5">${skull(78,29,.4,'#fbc6e6')}${skull(13,111,.42,'#fbc6e6')}${star(88,12,3,'#fff2fb')}${star(77,126,4,'#f7bedf')}${star(27,127,3,'#f7bedf')}${star(50,16,2,'#fff2fb')}</g><path d="M3 147h94M3 3h94" stroke="#f5b8df" stroke-width="1"/>`;
}
function adventurePrint(color,wild,index){
  const sky=wild?'#65c8dc':color;
  const horizon=wild?'#b5dce8':color===colors.blue?'#b8e9ee':color===colors.red?'#f5ae9c':color===colors.yellow?'#ffe5a0':'#b5d99b';
  const mountains=color===colors.blue?'<path d="m0 115 27-54 19 35 20-53 34 63v44H0Z" fill="#d9f4f0" stroke="#203e51" stroke-width="1.1"/><path d="m18 79 9-18 10 20-10-5Z" fill="#fff9e6"/><path d="m54 65 12-22 14 29-14-8Z" fill="#fff9e6"/>':color===colors.red?'<g fill="#fbcda5" stroke="#752c43" stroke-width="1"><path d="M77 111V60h10v51m-5-65v14M56 112V79h12v33M58 79V65h8v14"/><ellipse cx="82" cy="48" rx="10" ry="12"/><ellipse cx="62" cy="65" rx="9" ry="8"/></g>':color===colors.yellow?'<path d="m0 115 27-21 18 15 28-34 27 30v45H0Z" fill="#e1a644" stroke="#67502b" stroke-width="1.2"/>':'<path d="M85 131V68l-9-5 1-13 9-8 10 3 7 13-6 10v63Z" fill="#765d36" stroke="#24442f" stroke-width="1.4"/><path d="M69 53q-8-22 9-25 1-18 17-13 17 4 13 21 15 20-4 24Z" fill="#83b56c" stroke="#24442f" stroke-width="1.4"/>';
  return `<rect width="100" height="150" fill="${sky}"/><path d="M-5 76Q54 29 108 48v102H-5Z" fill="${horizon}"/>${wild?rainbowBands(44,11):''}<path d="M-5 118Q20 88 51 114t54-4v40H-5Z" fill="${color===colors.blue?'#85b4c9':color===colors.red?'#d56c74':color===colors.yellow?'#bd842f':'#679758'}" stroke="#203732" stroke-width="1.1"/>${mountains}<path d="M-3 145q35-25 61-9t48-12" fill="none" stroke="#fff9df" stroke-width="1.1" opacity=".65"/>${star(80,22,4,'#fff8ce','#203732')}${star(63,37,2.3,'#fff8ce','#203732')}`;
}
function backPrint(theme,preview){
  const f=family[theme];let field;
  if(theme==='cats')field=`<rect width="100" height="150" fill="#e6c29b"/><path d="m-20 42 139 60m-139-25 139 60m-139-25 139 60M0 0l100 44" stroke="#f8ead4" stroke-width="16"/>${paw(18,28,.9,'#785f48')}${paw(82,123,.9,'#785f48')}`;
  else if(theme==='seal')field=`<rect width="100" height="150" fill="#242029"/>${rainbowBands(38,16)}${rainbowBands(131,10)}<path d="m-5 94 104-65v89L5 145Z" fill="#fffefa"/><path d="m-2 84 90-57m-79 119 90-58" stroke="#fffefa" stroke-width="2" fill="none"/>`;
  else if(theme==='kuromi')field=`<rect width="100" height="150" fill="#291b30"/><path d="m-16 13 129 97-9 25L-9 37Z" fill="#ab6cae"/><path d="M113 12-10 118l9 28L109 40Z" fill="#ea9ac7"/>${[17,50,83].map(x=>skull(x,19,.4,'#f8cbe6')+skull(x,131,.4,'#f8cbe6')).join('')}`;
  else field=`${adventurePrint(colors.green,false,31)}<path d="M-10 60Q45 13 109 27" stroke="#fff2be" stroke-width="3" fill="none"/>`;
  return `${field}${art(theme,31,{preview,x:-6,y:20,size:112})}<path d="M12 138h76" stroke="${f.ink}" stroke-width="1" opacity=".5"/>${palette.map((fill,i)=>`<path d="m${34+i*9} 137 4 4-4 4-4-4Z" fill="${fill}" stroke="${f.paper}" stroke-width=".7"/>`).join('')}`;
}
export function themedFace(c,back,theme,{preview=false}={}){
  if(theme==='minecraft')return minecraftFace(c,back,preview);
  const f=family[theme];if(!f)return '';
  const color=colors[c.color]??colors.wild,wild=c.color==='wild',index=sceneIndex(c,back,theme);
  const prints={cats:catPrint,seal:sealPrint,kuromi:kuromiPrint,adventure:adventurePrint};
  const wideCats=new Set([0,1,7,12,15,18,19,20,21,23,26,27,30]);
  const placement=theme==='cats'?{x:index===24?-4:wideCats.has(index)?-7:2,y:index===24?24:wideCats.has(index)?34:30,size:index===24?121:114}:theme==='seal'?{x:1,y:40,size:108}:theme==='kuromi'?{x:8,y:43,size:105}:{x:-1,y:43,size:110};
  const face=back?backPrint(theme,preview):`${prints[theme](color,wild,index)}${watermark(c,color,theme)}${art(theme,index,placement)}`;
  const ink=f.ink;
  const cornerFill=c.color==='yellow'?'#30252b':f.paper;
  const corners=back?'':`<g transform="translate(1 0)">${glyph(c.value,cornerFill,ink,theme==='seal'?1.4:1.2)}</g>`;
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-deck="${theme}" style="overflow:hidden;border-radius:9% / 6%">${face}${corners}<g transform="rotate(180 50 75)">${corners}</g><rect x="1.7" y="1.7" width="96.6" height="146.6" rx="7.3" fill="none" stroke="${f.paper}" stroke-width="3.4"/><rect x="3.6" y="3.6" width="92.8" height="142.8" rx="5.4" fill="none" stroke="${f.ink}" stroke-width="${theme==='adventure'?1.1:.6}" opacity=".72"/></svg>`;
}

// Transparent character layers sit on the printed world; no image window or mask.
function minecraftArtwork(index,{x=1,y=36,size=106,preview=false}={}){
  if(preview)return `<image href="${deckCoverFile('minecraft')}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
  const grid=index>=64?2:4,local=index>=64?index-64:index%16,column=local%grid,row=Math.floor(local/grid),sheet=index>=64?'e':['a','b','c','d'][Math.floor(index/16)];
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="width:${size}%;height:${size/1.5}%;overflow:hidden" viewBox="${column*100} ${row*100} 100 100"><image href="${atlasFile('minecraft',sheet)}" width="${grid*100}" height="${grid*100}"/></svg>`;
}
function minecraftPrint(color,wild){
  const paper=wild?'#e9e2d0':'#fff5da',earth=wild?'#30273f':color===colors.blue?'#9abfc8':color===colors.red?'#bb7965':color===colors.yellow?'#cfaa61':'#739463';
  const edge='M-4 91h13v-7h14v-7h14v-7h14v-7h14v-7h14v-7h14v-7h14V155H-4Z';
  return `<rect width="100" height="150" fill="${wild?'#24202d':color}"/><path d="${edge}" fill="${paper}"/><path d="M-4 124h15v-7h18v7h18v8h20v-7h16v-8h21v34H-4Z" fill="${earth}"/><path d="M-4 139h22v-6h18v6h20v-6h18v-6h30v24H-4Z" fill="${wild?'#24202d':color}"/><path d="M47 37h10v-5h17v5h9v5H47Z" fill="${paper}" opacity=".75"/><path d="M13 103h8v7h-8m60-54h6v6h-6" fill="${earth}" opacity=".35"/>${wild?palette.map((fill,i)=>`<path d="M${5+i*25} ${132-i*5}h25v7h-25Z" fill="${fill}"/>`).join(''):''}`;
}
function minecraftFace(c,back,preview){
  const color=colors[c.color]??'#24202d',paper='#fff7e3',ink='#253127',wild=c.color==='wild';let print;
  if(back){
    print='<rect width="100" height="150" fill="#122e37"/><path d="M-4 81h13v-7h14v-7h14v-7h14v-7h14v-7h14v-7h25v67H91v7H77v7H63v7H49v7H35v7H-4Z" fill="#f5edcf"/><path d="M8 30h7v7H8m77 79h7v7h-7M19 25h4v4h-4m58 100h4v4h-4" fill="#8ab78d"/>'+minecraftArtwork(67,{x:0,y:31,size:100,preview})+'<text x="49" y="25" text-anchor="middle" fill="#fff7e3" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="900" font-style="italic" letter-spacing="-.9">UNO</text>'+palette.map((fill,i)=>`<path d="M${32+i*10} 138h7v4h-7Z" fill="${fill}"/>`).join('');
  }else{
    const index=sceneIndex(c,false,'minecraft'),special=['skip','reverse','draw2','wild','wild4'].includes(c.value);
    print=minecraftPrint(color,wild)+minecraftArtwork(index,{x:special?-4:0,y:special?27:35,size:special?112:106});
    const corner=glyph(c.value,c.color==='yellow'?ink:paper,ink,.65);
    print+=corner+`<g transform="rotate(180 50 75)">${corner}</g>`;
  }
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-deck="minecraft"${back?'':` data-card-value="${c.value}"`} style="overflow:hidden;border-radius:9% / 6%">${print}<rect x="1.7" y="1.7" width="96.6" height="146.6" rx="7.3" fill="none" stroke="${paper}" stroke-width="3.4"/><rect x="3.6" y="3.6" width="92.8" height="142.8" rx="5.4" fill="none" stroke="${ink}" stroke-width=".7" opacity=".65"/></svg>`;
}
