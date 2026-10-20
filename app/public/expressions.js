import {escape} from './cards.js';
export const EXPRESSIONS = [
  {code:'😂',name:'Gülme',file:'laugh.webp'},
  {code:'😭',name:'Ağlama',file:'cry.webp'},
  {code:'😏',name:'Sırıtma',file:'smirk.webp'},
  {code:'😡',name:'Kızgın',file:'angry.webp'},
  {code:'😮',name:'Şaşkın',file:'surprise.webp'},
  {code:'❤️',name:'Kalp',file:'heart.webp'},
  {code:'👏',name:'Alkış',file:'clap.webp'},
  {code:'💀',name:'Kafatası',file:'skull.webp'},
  {code:'seal',name:'Fok',file:'seal.webp',sticker:true},
  {code:'seal-tongue',name:'Dil çıkaran fok',file:'seal-tongue.webp',sticker:true},
  {code:'seal-happy',name:'Mutlu fok',file:'seal-happy.webp',sticker:true},
  {code:'seal-cry',name:'Ağlayan fok',file:'seal-cry.webp',sticker:true},
  {code:'seal-scream',name:'Çığlık',file:'seal-scream.webp',sticker:true}
];
export function expression(code) {return EXPRESSIONS.find(item=>item.code===code);}
export function expressionImage(code) {
  const item=expression(code);
  if(!item)return '';
  return `<img src="./assets/expressions/${item.file}" alt="${escape(item.name)}" width="${item.sticker?100:48}" height="${item.sticker?84:48}" draggable="false" decoding="async">`;
}
let preloaded=false;
export function preloadExpressions() {if(preloaded)return;preloaded=true;for(const item of EXPRESSIONS){const img=new Image();img.src='./assets/expressions/'+item.file;}}
