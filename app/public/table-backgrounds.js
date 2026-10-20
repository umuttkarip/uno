// Theme-linked tables share their review assets; the game never needs both sizes.
export const THEMED_TABLES=[
  {id:'cats',name:'Kediler',felt:'#243d34',glow:'#243d3400',panel:'#233d31',deep:'#1b3027',wide:'cats.webp',portrait:'cats-v2-portrait.webp'},
  {id:'seal',name:'Sude',felt:'#793c59',glow:'#793c5900',panel:'#613348',deep:'#4b293c',wide:'seal-v2-wide.webp',portrait:'seal-v2-portrait.webp'},
  {id:'kuromi',name:'Kuromi',felt:'#2c2636',glow:'#2c263600',panel:'#342a3e',deep:'#251f2e',wide:'kuromi.webp',portrait:'kuromi-v2-portrait.webp'},
  {id:'adventure',name:'Adventure Time',felt:'#183c35',glow:'#183c3500',panel:'#1b3b32',deep:'#122d27',wide:'adventure.webp',portrait:'adventure-v2-portrait.webp'},
  {id:'minecraft',name:'Minecraft',felt:'#1b392e',glow:'#1b392e00',panel:'#1d352b',deep:'#142b22',wide:'minecraft.webp',portrait:'minecraft-v2-portrait.webp'}
];
export const DECK_TABLES=Object.freeze({classic:'green',cats:'cats',seal:'seal',kuromi:'kuromi',adventure:'adventure',minecraft:'minecraft'});
export const tableBackgroundUrl=file=>'./proposals/backgrounds/'+file;
