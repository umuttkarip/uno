import {TableMotion,planTransition,PLAY_DURATION,FOLLOWUP_DELAY} from './table-motion.js';
import {card} from './cards.js';
import {cardSound} from './card-audio.js';
const rect=node=>node?.getBoundingClientRect();
const usable=box=>box&&box.width>1&&box.height>1;
export function seating(state){
  const count=state.capacity??state.players.length;
  return state.players.flatMap((p,index)=>{if(index===state.me)return[];const distance=(index-state.me+count)%count;return[{index,seat:count===4?({1:'left',2:'top',3:'right'})[distance]:'top'}];});
}
export class MultiTableMotion extends TableMotion {
  constructor(args){super({...args,opponent:args.seats.top.hand});this.seats=args.seats;this.rivals=new Map();}
  reset(){super.reset();for(const rival of this.rivals.values()){rival.nodes.clear();rival.container.replaceChildren();}this.rivals.clear();}
  async update(previous,state,{present=true}={}){
    const generation=this.generation,plan=planTransition(previous,state),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const placements=seating(state),narrow=matchMedia('(max-width:700px)').matches;
    for(const {index,seat}of placements){let rival=this.rivals.get(index);if(!rival){rival={nodes:new Map()};this.rivals.set(index,rival);}rival.container=this.seats[seat].hand;rival.seat=seat;}
    const beforeOwn=this.capture(this.own),beforeOther=new Map([...this.rivals].map(([index,r])=>[index,this.capture(r.nodes)]));
    const ownSource=plan.ownPlayed?this.geometry(this.own.get(plan.ownPlayed.id)?.firstElementChild):null;
    const actor=this.rivals.get(state.lastMove?.player);
    const opponentSource=plan.opponentPlayed?this.geometry([...actor?.nodes.values()??[]].at(-1)?.firstElementChild):null;
    const deckSource=this.geometry(this.deck);
    if(plan.deal){this.own.clear();this.hand.replaceChildren();for(const rival of this.rivals.values()){rival.nodes.clear();rival.container.replaceChildren();}}
    const n=state.players[state.me].hand.length;
    this.hand.style.setProperty('--overlap',(n>10?43:n>7?34:28)+'px');
    this.reconcile(this.own,this.hand,state.players[state.me].hand.map((c,i)=>({key:c.id,card:c,rotation:n<=11?(i-(n-1)/2)*1.6:0,offset:n<=11?Math.abs(i-(n-1)/2)*1.2:0})));
    for(const {index}of placements){const rival=this.rivals.get(index),count=state.players[index].count,limit=state.capacity===4?(narrow?5:9):16;const visible=Math.min(count,limit);rival.visible=visible;rival.limit=limit;
      this.reconcile(rival.nodes,rival.container,Array.from({length:visible},(_,i)=>({key:'op-'+i,rotation:(i-(visible-1)/2)*3.2,offset:Math.abs(i-(visible-1)/2)*1.1})),true);
      rival.container.setAttribute('aria-label',`${count} kapalı kart`);
    }
    if(plan.added.length&&!plan.deal&&!this.scroll.classList.contains('dragging')){const target=rect(this.own.get(plan.added.at(-1).id)),viewport=rect(this.scroll);if(usable(target)&&usable(viewport)){if(target.right>viewport.right-20)this.scroll.scrollLeft+=target.right-viewport.right+20;else if(target.left<viewport.left+20)this.scroll.scrollLeft-=viewport.left-target.left+20;}}
    this.updateInteraction(state,{blocked:true,present});
    let newTop;if(plan.topChanged){const template=document.createElement('template');template.innerHTML=card(state.top);newTop=template.content.firstElementChild;this.discard.append(newTop);}
    this.discard.classList.toggle('joker',state.top?.color==='wild');if(state.color)this.discard.style.setProperty('--chosen-color',`var(--${state.color})`);
    const ownTargets=new Map([...this.own].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]));
    const otherTargets=new Map([...this.rivals].map(([index,r])=>[index,new Map([...r.nodes].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]))]));
    const jobs=plan.deal?[]:this.layout(this.own,beforeOwn,this.capture(this.own),reduced);
    if(!plan.deal)for(const [index,rival]of this.rivals)jobs.push(...this.layout(rival.nodes,beforeOther.get(index)??new Map(),this.capture(rival.nodes),reduced));
    if(newTop){newTop.style.visibility='hidden';jobs.push(this.fly(plan.ownPlayed?ownSource:plan.opponentPlayed?opponentSource:deckSource,this.geometry(newTop),{c:state.top,reveal:!plan.ownPlayed,target:newTop,duration:PLAY_DURATION,reduced}));if(!plan.deal)cardSound('play',reduced?0:305);}
    const penaltyDelay=plan.ownPlayed||plan.opponentPlayed?FOLLOWUP_DELAY:0;
    for(let i=0;i<plan.added.length;i++){const c=plan.added[i],node=this.own.get(c.id)?.firstElementChild;if(!node)continue;node.style.visibility='hidden';const delay=plan.deal?100+i*48:penaltyDelay+i*58;jobs.push(this.fly(deckSource,ownTargets.get(c.id),{c,reveal:true,target:node,delay,duration:430,reduced}));if(!plan.deal)cardSound('draw',reduced?0:delay,plan.added.length>1?.7:1);}
    for(const change of plan.opponents){const rival=this.rivals.get(change.index);if(!rival)continue;for(let i=0;i<change.added;i++){const index=Math.min(rival.limit-1,Math.max(0,change.oldCount-(change.played?1:0)+i)),node=rival.nodes.get('op-'+index)?.firstElementChild;const delay=plan.deal?75+i*48:penaltyDelay+i*58;if(node){const target=index>=Math.min(change.oldCount,rival.limit)?node:null;if(target)target.style.visibility='hidden';jobs.push(this.fly(deckSource,otherTargets.get(change.index)?.get('op-'+index),{backOnly:true,target,delay,duration:430,reduced}));}if(!plan.deal)cardSound('draw',reduced?0:delay,.65);}}
    if(plan.deal){cardSound('draw',0,.45);cardSound('draw',150,.4);cardSound('draw',300,.4);}
    await Promise.all(jobs);if(this.generation!==generation)return;
    if(newTop)for(const node of [...this.discard.children])if(node!==newTop)node.remove();
    for(const slot of this.own.values())slot.firstElementChild.style.visibility='';for(const rival of this.rivals.values())for(const slot of rival.nodes.values())slot.firstElementChild.style.visibility='';
  }
}
