import {card,back,face} from './cards.js';
import {cardSound} from './card-audio.js';

const EASE='cubic-bezier(.22,.8,.25,1)';
const rect=node=>node?.getBoundingClientRect();
const usable=box=>box&&box.width>1&&box.height>1;
// A draw included in the same update must follow the card landing on the pile.
export const PLAY_DURATION=360;
export const FOLLOWUP_DELAY=PLAY_DURATION+60;

export function planTransition(previous,next) {
  const self=next.players[next.me];
  const oldSelf=previous?.players[previous.me];
  const deal=next.round>0&&(!previous||previous.round!==next.round);
  const before=deal?[]:oldSelf?.hand??[];
  const beforeIds=new Set(before.map(c=>c.id));
  const afterIds=new Set(self.hand.map(c=>c.id));
  const topChanged=!!next.top&&(deal||previous?.top?.id!==next.top.id);
  const played=topChanged&&!deal&&next.lastMove?.type==='play';
  const ownPlayed=played?before.find(c=>c.id===next.top.id):null;
  const opponentPlayed=!!played&&!ownPlayed;
  const transfers=[];
  if(played){
    const actor=next.lastMove.player,target=next.lastMove.target,count=next.players.length;
    const remaining=(previous.players[actor]?.count??0)-1;
    const add=(from,to,n)=>{if(n>0)transfers.push({from,to,count:n});};
    if(next.lastMove.effect==='swap'&&remaining>0&&Number.isInteger(target)){add(actor,target,remaining);add(target,actor,previous.players[target].count);}
    if(next.lastMove.effect==='gift'&&remaining>0&&Number.isInteger(target))add(actor,target,1);
    if(next.lastMove.effect==='rotate'&&remaining>0)for(let from=0;from<count;from++)add(from,(from+(next.direction??1)+count)%count,previous.players[from].count-(from===actor?1:0));
  }
  const opponents=next.players.flatMap((p,index)=>index===next.me?[]:[{index,count:p.count,oldCount:deal?0:previous?.players[index]?.count??0,played:opponentPlayed&&next.lastMove.player===index}]).map(p=>({...p,added:Math.max(0,p.count-p.oldCount+(p.played?1:0)-transfers.filter(t=>t.to===p.index).reduce((n,t)=>n+t.count,0)+transfers.filter(t=>t.from===p.index).reduce((n,t)=>n+t.count,0))}));
  return {
    deal,topChanged,ownPlayed,opponentPlayed,transfers,
    added:self.hand.filter(c=>!beforeIds.has(c.id)),
    removed:before.filter(c=>!afterIds.has(c.id)),
    opponents,opponentAdded:opponents.reduce((n,p)=>n+p.added,0)
  };
}

export class TableMotion {
  constructor({hand,opponent,discard,deck,scroll}) {
    Object.assign(this,{hand,opponent,discard,deck,scroll});
    this.own=new Map();this.other=new Map();this.flights=new Set();this.layoutAnimations=new Set();
    this.generation=0;
  }

  reset() {
    this.generation++;
    for(const item of this.flights)item.cancel();
    for(const animation of this.layoutAnimations)animation.cancel();
    this.flights.clear();this.layoutAnimations.clear();this.own.clear();this.other.clear();
    this.hand.replaceChildren();this.opponent.replaceChildren();this.discard.replaceChildren();
  }

  geometry(node) {
    if(!node)return null;
    const box=rect(node);
    const transform=getComputedStyle(node).transform;
    let angle=0;
    if(transform!=='none'){const matrix=new DOMMatrixReadOnly(transform);angle=Math.atan2(matrix.b,matrix.a)*180/Math.PI;}
    return {box,width:node.offsetWidth||box.width,height:node.offsetHeight||box.height,angle};
  }

  capture(map) {return new Map([...map].map(([id,slot])=>[id,rect(slot)]));}

  restyle(state) {
    for(const c of state.players[state.me].hand){const button=this.own.get(c.id)?.firstElementChild;if(button)button.innerHTML=face(c);}
    for(const slot of this.other.values())slot.firstElementChild.innerHTML=face({color:'wild'},true);
    if(state.top&&this.discard.lastElementChild)this.discard.lastElementChild.innerHTML=face(state.top);
  }

  reconcile(map,container,items,opponent=false) {
    const keep=new Set(items.map(item=>item.key));
    for(const [id,slot] of map)if(!keep.has(id)){slot.remove();map.delete(id);}
    let cursor=container.firstElementChild;
    for(const item of items){
      let slot=map.get(item.key);
      if(!slot){
        slot=document.createElement('div');
        slot.className=opponent?'opponent-slot':'card-slot';
        slot.dataset.cardKey=item.key;
        const template=document.createElement('template');
        template.innerHTML=opponent?back():card(item.card,{button:true});
        slot.append(template.content.firstElementChild);
        map.set(item.key,slot);
      }
      slot.style.setProperty('--rotation',item.rotation+'deg');
      slot.style.setProperty('--offset',item.offset+'px');
      if(slot!==cursor)container.insertBefore(slot,cursor);
      cursor=slot.nextElementSibling;
    }
  }

  updateInteraction(state,{blocked=false,present=true}={}) {
    const eligible=new Set(present?state.playable:[]);
    for(const [id,slot] of this.own){
      const button=slot.firstElementChild;
      const allowed=eligible.has(id);
      button.classList.toggle('playable',allowed);
      button.classList.toggle('drawn',state.drawnId===id);
      button.disabled=blocked||!allowed;
    }
  }

  layout(map,before,after,reduced) {
    const jobs=[];
    if(reduced)return jobs;
    for(const [id,slot] of map){
      const from=before.get(id),to=after.get(id);
      if(!usable(from)||!usable(to))continue;
      const x=from.left-to.left,y=from.top-to.top;
      if(Math.abs(x)<.4&&Math.abs(y)<.4)continue;
      const animation=slot.animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:360,easing:EASE});
      this.layoutAnimations.add(animation);
      jobs.push(animation.finished.catch(()=>{}).finally(()=>this.layoutAnimations.delete(animation)));
    }
    return jobs;
  }

  fly(from,to,{c,backOnly=false,reveal=false,target,delay=0,duration=420,reduced=false,flat=this.compact}={}) {
    if(!usable(from?.box)||!usable(to?.box)){if(target)target.style.visibility='';return Promise.resolve();}
    if(reduced){
      if(target){target.style.visibility='';const fade=target.animate([{opacity:.3},{opacity:1}],{duration:130});return fade.finished.catch(()=>{});}
      return Promise.resolve();
    }
    // Delayed flights should not allocate GPU layers or parse SVG until they move.
    if(delay>0)return new Promise(resolve=>{
      const pending={cancel:()=>{clearTimeout(timer);this.flights.delete(pending);resolve();}};
      const timer=setTimeout(()=>{this.flights.delete(pending);resolve(this.fly(from,to,{c,backOnly,reveal,target,duration,reduced,flat}));},delay);
      this.flights.add(pending);
    });
    if(flat)reveal=false;
    const ghost=document.createElement('div');ghost.className='card-flight';
    const w=to.width,h=to.height;
    ghost.style.width=w+'px';ghost.style.height=h+'px';
    const backFace=face({color:'wild'},true);
    ghost.innerHTML=`<div class="flight-flip"><div class="flight-front">${backOnly?backFace:face(c)}</div>${reveal?`<div class="flight-back">${backFace}</div>`:''}</div>`;
    document.body.append(ghost);
    const start={x:from.box.left+from.box.width/2-w/2,y:from.box.top+from.box.height/2-h/2};
    const end={x:to.box.left+to.box.width/2-w/2,y:to.box.top+to.box.height/2-h/2};
    const fromScale=from.width/w;
    const at=(p,angle,scale=1)=>`translate3d(${p.x}px,${p.y}px,0) rotate(${angle}deg) scale(${scale})`;
    const middle={x:start.x+(end.x-start.x)*.55,y:start.y+(end.y-start.y)*.55-Math.min(38,Math.abs(end.y-start.y)*.12+12)};
    const animation=ghost.animate([
      {transform:at(start,from.angle,fromScale),opacity:1,offset:0},
      {transform:at(middle,(from.angle+to.angle)/2-3,(fromScale+1)/2*1.025),opacity:1,offset:.55},
      {transform:at(end,to.angle),opacity:1,offset:1}
    ],{duration,delay,easing:EASE,fill:'both'});
    let flip;
    if(reveal)flip=ghost.firstElementChild.animate([{transform:'rotateY(180deg)'},{transform:'rotateY(0)'}],{duration:duration*.62,delay:delay+duration*.2,easing:EASE,fill:'both'});
    let cleaned=false;
    const clean=()=>{if(cleaned)return;cleaned=true;if(target)target.style.visibility='';ghost.remove();flip?.cancel();this.flights.delete(item);};
    const item={cancel:()=>{animation.cancel();clean();}};this.flights.add(item);
    return animation.finished.catch(()=>{}).finally(clean);
  }

  async update(previous,state,{present=true}={}) {
    this.compact=matchMedia('(max-width:700px), (pointer:coarse)').matches;
    const generation=this.generation;
    const plan=planTransition(previous,state);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const beforeOwn=this.capture(this.own),beforeOther=this.capture(this.other);
    const ownSource=plan.ownPlayed?this.geometry(this.own.get(plan.ownPlayed.id)?.firstElementChild):null;
    const opponentSource=plan.opponentPlayed?this.geometry([...this.other.values()].at(-1)?.firstElementChild):null;
    const deckSource=this.geometry(this.deck);
    const n=state.players[state.me].hand.length;
    if(plan.deal){this.own.clear();this.other.clear();this.hand.replaceChildren();this.opponent.replaceChildren();}
    this.hand.style.setProperty('--overlap',(n>10?43:n>7?34:28)+'px');
    this.reconcile(this.own,this.hand,state.players[state.me].hand.map((c,i)=>({key:c.id,card:c,rotation:n<=11?(i-(n-1)/2)*1.6:0,offset:n<=11?Math.abs(i-(n-1)/2)*1.2:0})));
    const opponentCount=state.players[1-state.me]?.count??0;
    const visibleCount=Math.min(opponentCount,16);
    this.reconcile(this.other,this.opponent,Array.from({length:visibleCount},(_,i)=>({key:'op-'+i,rotation:(i-(visibleCount-1)/2)*3.2,offset:Math.abs(i-(visibleCount-1)/2)*1.1})),true);
    this.opponent.setAttribute('aria-label',`${opponentCount} kapalı kart`);
    if(plan.added.length&&!plan.deal&&!this.scroll.classList.contains('dragging')){
      const newest=this.own.get(plan.added.at(-1).id);
      const viewport=rect(this.scroll),target=rect(newest);
      if(usable(target)&&usable(viewport)){
        if(target.right>viewport.right-20)this.scroll.scrollLeft+=target.right-viewport.right+20;
        else if(target.left<viewport.left+20)this.scroll.scrollLeft-=viewport.left-target.left+20;
      }
    }
    this.updateInteraction(state,{blocked:true,present});
    let newTop;
    if(plan.topChanged){
      const template=document.createElement('template');template.innerHTML=card(state.top);
      newTop=template.content.firstElementChild;this.discard.append(newTop);
    }
    this.discard.classList.toggle('joker',state.top?.color==='wild');
    if(state.color)this.discard.style.setProperty('--chosen-color',`var(--${state.color})`);
    const ownTargets=new Map([...this.own].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]));
    const otherTargets=new Map([...this.other].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]));
    const topTarget=this.geometry(newTop);
    const afterOwn=this.capture(this.own),afterOther=this.capture(this.other);
    const jobs=plan.deal?[]:[...this.layout(this.own,beforeOwn,afterOwn,reduced),...this.layout(this.other,beforeOther,afterOther,reduced)];
    if(newTop){
      const source=plan.ownPlayed?ownSource:plan.opponentPlayed?opponentSource:deckSource;
      newTop.style.visibility='hidden';
      jobs.push(this.fly(source,topTarget,{c:state.top,reveal:!plan.ownPlayed,target:newTop,duration:PLAY_DURATION,reduced}));
      if(!plan.deal)cardSound('play',reduced?0:305);
    }
    const penaltyDelay=(plan.ownPlayed||plan.opponentPlayed)?FOLLOWUP_DELAY:0;
    for(let i=0;i<plan.added.length;i++){
      const c=plan.added[i],node=this.own.get(c.id)?.firstElementChild;
      if(!node)continue;
      node.style.visibility='hidden';
      const delay=plan.deal?100+i*48:penaltyDelay+i*58;
      jobs.push(this.fly(deckSource,ownTargets.get(c.id),{c,reveal:true,target:node,delay,duration:430,reduced}));
      if(!plan.deal)cardSound('draw',reduced?0:delay,plan.added.length>1?.7:1);
    }
    const oldOther=plan.deal?0:previous?.players[1-previous.me]?.count??0;
    for(let i=0;i<plan.opponentAdded;i++){
      const index=Math.min(15,Math.max(0,oldOther-(plan.opponentPlayed?1:0)+i));
      const node=this.other.get('op-'+index)?.firstElementChild;
      const delay=plan.deal?75+i*48:penaltyDelay+i*58;
      if(node){const target=index>=Math.min(oldOther,16)?node:null;if(target)target.style.visibility='hidden';jobs.push(this.fly(deckSource,otherTargets.get('op-'+index),{backOnly:true,target,delay,duration:430,reduced}));}
      if(!plan.deal)cardSound('draw',reduced?0:delay,.65);
    }
    if(plan.deal){cardSound('draw',0,.45);cardSound('draw',150,.4);cardSound('draw',300,.4);}
    await Promise.all(jobs);
    if(this.generation!==generation)return;
    if(newTop)for(const node of [...this.discard.children])if(node!==newTop)node.remove();
    for(const slot of [...this.own.values(),...this.other.values()])slot.firstElementChild.style.visibility='';
  }
}
