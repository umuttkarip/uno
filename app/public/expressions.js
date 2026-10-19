import {escape} from './cards.js';
export const EXPRESSIONS = [
  {code:'😂',name:'Gülme',file:'laugh.png'},
  {code:'😭',name:'Ağlama',file:'cry.png'},
  {code:'😏',name:'Sırıtma',file:'smirk.png'},
  {code:'😡',name:'Kızgın',file:'angry.png'},
  {code:'😮',name:'Şaşkın',file:'surprise.png'},
  {code:'❤️',name:'Kalp',file:'heart.png'},
  {code:'👏',name:'Alkış',file:'clap.png'},
  {code:'💀',name:'Kafatası',file:'skull.png'},
  {code:'seal',name:'Fok',file:'seal.png',sticker:true}
];
export function expression(code) {return EXPRESSIONS.find(item=>item.code===code);}
export function expressionImage(code) {
  const item=expression(code);
  if(!item)return '';
  return `<img src="./assets/expressions/${item.file}" alt="${escape(item.name)}" width="${item.sticker?100:48}" height="${item.sticker?84:48}" draggable="false" decoding="async">`;
}
export function preloadExpressions() {for(const item of EXPRESSIONS){const img=new Image();img.src='./assets/expressions/'+item.file;}}
