import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {face} from '../public/cards.js';
import {DECKS,sceneIndex} from '../public/card-themes.js';
import {deck} from '../src/engine.js';

export async function writeDesignGallery(output){
  const themes=DECKS.filter(d=>d.id!=='classic'),cards=deck().sort((a,b)=>Number(a.id)-Number(b.id));
  const examples=Array.from({length:31},(_,i)=>cards.find(c=>sceneIndex(c)===i));
  const nav=themes.map(t=>`<a href="#${t.id}">${t.name}</a>`).join('');
  const sections=themes.map(t=>`<section id="${t.id}"><h2>${t.name}</h2><div class="cards">${examples.map(c=>`<div class="sample">${face(c,false,t.id)}</div>`).join('')}<div class="sample">${face({color:'wild'},true,t.id)}</div></div></section>`).join('');
  await writeFile(join(output,'desteler.html'),`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deste önizlemesi</title><style>*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px;background:#123229;color:#edf0e3;font:14px/1.5 "Segoe UI",Arial,sans-serif}body{max-width:1060px;margin:auto;padding:20px 24px 60px}header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e5ecd226;padding-bottom:16px}h1{font-size:20px;font-weight:500;margin:0}nav{display:flex;flex-wrap:wrap;gap:18px}a{color:#dce4d2;text-decoration:none;font-size:13px}a:hover{text-decoration:underline}a:focus-visible{outline:2px solid #f3f1d8;outline-offset:5px}section{margin:34px 0 50px}h2{font-size:17px;font-weight:500;margin:0 0 18px}.cards{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:18px 14px}.sample{aspect-ratio:2/3;filter:drop-shadow(0 3px 3px #00170e55)}.sample>svg{display:block;width:100%;height:100%}@media(max-width:680px){body{padding:18px 16px 36px}.cards{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 12px}nav{gap:12px}a{font-size:12px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}</style></head><body><header><h1>Deste önizlemesi</h1><nav aria-label="Desteler">${nav}</nav></header>${sections}</body></html>`);
}
