import {TableMotion,planTransition,cardLayoutChanged,PLAY_DURATION,FOLLOWUP_DELAY} from './table-motion.js';
import {card,face} from './cards.js';
import {cardSound,bombSound} from './card-audio.js';
import {LABELS,COLOR_NAMES} from '../src/engine.js';
const rect=node=>node?.getBoundingClientRect();
const usable=box=>box&&box.width>1&&box.height>1;
export function seating(state){
  const count=state.players.length;
  const places={2:['top'],3:['upperLeft','upperRight'],4:['left','top','right'],5:['left','upperLeft','upperRight','right'],6:['left','upperLeft','top','upperRight','right']};
  return state.players.flatMap((p,index)=>{if(index===state.me)return[];const distance=(index-state.me+count)%count;return[{index,seat:places[count]?.[distance-1]??'top'}];});
}
export class MultiTableMotion extends TableMotion {
  constructor(args){super({...args,opponent:args.seats.top.hand});this.seats=args.seats;this.rivals=new Map();}
  reset(){super.reset();for(const rival of this.rivals.values()){rival.nodes.clear();rival.container.replaceChildren();}this.rivals.clear();}
  restyle(state){super.restyle(state);for(const rival of this.rivals.values())for(const slot of rival.nodes.values()){slot.firstElementChild.innerHTML=face({color:'wild'},true);slot.dataset.revealed='restyle';}this.syncReveals(state);}
  syncReveals(state){
    for(const [index,rival]of this.rivals){const known=(state.revealed??[]).filter(item=>item.player===index);let i=0;
      rival.container.setAttribute('aria-label',known.length?`${state.players[index].count} kart, ${known.length} kart açık`:`${state.players[index].count} kapalı kart`);
      for(const slot of rival.nodes.values()){const item=known[i++],id=item?.card.id??'';if(slot.dataset.revealed!==id){slot.firstElementChild.innerHTML=item?face(item.card):face({color:'wild'},true);slot.dataset.revealed=id;}slot.classList.toggle('revealed-card',!!item);if(item){slot.setAttribute('role','img');slot.setAttribute('aria-label',state.players[index].name+' · '+COLOR_NAMES[item.card.color]+' '+(LABELS[item.card.value]??item.card.value));}else{slot.removeAttribute('role');slot.removeAttribute('aria-label');}}
    }
  }
  async update(previous,state,{present=true}={}){
    this.compact=matchMedia('(max-width:700px), (pointer:coarse)').matches;
    const generation=this.generation,plan=planTransition(previous,state),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!cardLayoutChanged(previous,state,plan)){this.updateInteraction(state,{blocked:true,present});this.syncReveals(state);return;}
    const placements=seating(state),narrow=matchMedia('(max-width:700px)').matches;
    for(const {index,seat}of placements){let rival=this.rivals.get(index);if(!rival){rival={nodes:new Map()};this.rivals.set(index,rival);}rival.container=this.seats[seat].hand;rival.seat=seat;}
    const beforeOwn=this.capture(this.own),beforeOther=new Map([...this.rivals].map(([index,r])=>[index,this.capture(r.nodes)]));
    const ownSource=plan.ownPlayed?this.geometry(this.own.get(plan.ownPlayed.id)?.firstElementChild):null;
    const actor=this.rivals.get(state.lastMove?.player);
    const opponentSource=plan.opponentPlayed?this.geometry([...actor?.nodes.values()??[]].at(-1)?.firstElementChild):null;
    const deckSource=this.geometry(this.deck);
    const transferSources=new Map(state.players.map((_,index)=>[index,index===state.me?this.geometry([...this.own.values()][0]?.firstElementChild):this.geometry([...this.rivals.get(index)?.nodes.values()??[]].at(-1)?.firstElementChild)]));
    // Keep the old hands on the table until the transfer card actually lands.
    let stagedTop;
    if(plan.transfers.length&&plan.topChanged){
      const template=document.createElement('template');template.innerHTML=card(state.top);stagedTop=template.content.firstElementChild;this.discard.append(stagedTop);stagedTop.style.visibility='hidden';
      const playedNode=plan.ownPlayed?this.own.get(plan.ownPlayed.id)?.firstElementChild:[...actor?.nodes.values()??[]].at(-1)?.firstElementChild;if(playedNode)playedNode.style.visibility='hidden';
      cardSound('play',reduced?0:305);
      await this.fly(plan.ownPlayed?ownSource:opponentSource,this.geometry(stagedTop),{c:state.top,reveal:!plan.ownPlayed,target:stagedTop,duration:PLAY_DURATION,reduced});
      if(this.generation!==generation)return;
      for(const node of [...this.discard.children])if(node!==stagedTop)node.remove();
    }
    if(plan.deal){this.own.clear();this.hand.replaceChildren();for(const rival of this.rivals.values()){rival.nodes.clear();rival.container.replaceChildren();}}
    const n=state.players[state.me].hand.length;
    this.hand.style.setProperty('--overlap',(n>10?43:n>7?34:28)+'px');
    this.reconcile(this.own,this.hand,state.players[state.me].hand.map((c,i)=>({key:c.id,card:c,rotation:n<=11?(i-(n-1)/2)*1.6:0,offset:n<=11?Math.abs(i-(n-1)/2)*1.2:0})));
    for(const {index}of placements){const rival=this.rivals.get(index),count=state.players[index].count,limit=state.players.length>=5?(narrow?3:6):state.players.length>=3?(narrow?5:9):16;const visible=Math.min(count,limit);rival.visible=visible;rival.limit=limit;
      this.reconcile(rival.nodes,rival.container,Array.from({length:visible},(_,i)=>({key:'op-'+i,rotation:(i-(visible-1)/2)*3.2,offset:Math.abs(i-(visible-1)/2)*1.1})),true);
      rival.container.setAttribute('aria-label',`${count} kapalı kart`);
    }
    if(plan.added.length&&!plan.deal&&!this.scroll.classList.contains('dragging')){const target=rect(this.own.get(plan.added.at(-1).id)),viewport=rect(this.scroll);if(usable(target)&&usable(viewport)){if(target.right>viewport.right-20)this.scroll.scrollLeft+=target.right-viewport.right+20;else if(target.left<viewport.left+20)this.scroll.scrollLeft-=viewport.left-target.left+20;}}
    this.updateInteraction(state,{blocked:true,present});
    let newTop;if(plan.topChanged&&!stagedTop){const template=document.createElement('template');template.innerHTML=card(state.top);newTop=template.content.firstElementChild;this.discard.append(newTop);}
    this.discard.classList.toggle('joker',state.top?.color==='wild');if(state.color)this.discard.style.setProperty('--chosen-color',`var(--${state.color})`);
    const ownTargets=new Map([...this.own].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]));
    const otherTargets=new Map([...this.rivals].map(([index,r])=>[index,new Map([...r.nodes].map(([id,slot])=>[id,this.geometry(slot.firstElementChild)]))]));
    const jobs=plan.deal?[]:this.layout(this.own,beforeOwn,this.capture(this.own),reduced);
    if(!plan.deal)for(const [index,rival]of this.rivals)jobs.push(...this.layout(rival.nodes,beforeOther.get(index)??new Map(),this.capture(rival.nodes),reduced));
    if(newTop){newTop.style.visibility='hidden';jobs.push(this.fly(plan.ownPlayed?ownSource:plan.opponentPlayed?opponentSource:deckSource,this.geometry(newTop),{c:state.top,reveal:!plan.ownPlayed,target:newTop,duration:PLAY_DURATION,reduced}));if(!plan.deal){cardSound('play',reduced?0:305);if(state.top.value==='bomb')bombSound(reduced?0:305);}}
    const penaltyDelay=stagedTop?0:plan.ownPlayed||plan.opponentPlayed?FOLLOWUP_DELAY:0;
    let dealStep=0;
    if(plan.deal){
      const groups=[plan.added.map(c=>({c,target:this.own.get(c.id)?.firstElementChild,to:ownTargets.get(c.id)})),...plan.opponents.map(change=>{const rival=this.rivals.get(change.index);return Array.from({length:rival?.visible??0},(_,i)=>({backOnly:true,target:rival.nodes.get('op-'+i)?.firstElementChild,to:otherTargets.get(change.index)?.get('op-'+i)}));})];
      // Deal once to each visible slot; never fly seven copies into the same capped slot.
      for(let i=0;i<Math.max(...groups.map(g=>g.length));i++)for(const group of groups){const item=group[i];if(!item?.target)continue;item.target.style.visibility='hidden';jobs.push(this.fly(deckSource,item.to,{...item,reveal:!item.backOnly,delay:75+dealStep++*(this.compact?52:30),duration:this.compact?240:330,reduced}));}
    }
    const incoming=plan.transfers.find(t=>t.to===state.me);
    for(let i=0;!plan.deal&&i<plan.added.length;i++){
      const c=plan.added[i],node=this.own.get(c.id)?.firstElementChild;if(!node)continue;node.style.visibility='hidden';
      // Full hand changes use a bounded number of flights on phones.
      if(incoming&&i>=(this.compact?3:5))continue;
      const delay=penaltyDelay+i*58,source=incoming?transferSources.get(incoming.from):deckSource;
      jobs.push(this.fly(source,ownTargets.get(c.id),{c,reveal:true,target:node,delay,duration:430,reduced}));
      if(!incoming)cardSound('draw',reduced?0:delay,plan.added.length>1?.7:1);
    }
    for(const transfer of plan.transfers){
      if(transfer.to===state.me)continue;
      const rival=this.rivals.get(transfer.to),node=[...rival?.nodes.values()??[]].at(-1)?.firstElementChild;
      const to=this.geometry(node);
      for(let i=0;i<Math.min(transfer.count,this.compact?2:4);i++)jobs.push(this.fly(transferSources.get(transfer.from),to,{backOnly:true,delay:penaltyDelay+i*62,duration:430,reduced}));
    }
    for(const change of plan.opponents){if(plan.deal)continue;const rival=this.rivals.get(change.index);if(!rival)continue;for(let i=0;i<change.added;i++){const index=Math.min(rival.limit-1,Math.max(0,change.oldCount-(change.played?1:0)+i)),node=rival.nodes.get('op-'+index)?.firstElementChild;const delay=penaltyDelay+i*58;if(node){const target=index>=Math.min(change.oldCount,rival.limit)?node:null;if(target)target.style.visibility='hidden';jobs.push(this.fly(deckSource,otherTargets.get(change.index)?.get('op-'+index),{backOnly:true,target,delay,duration:430,reduced}));}cardSound('draw',reduced?0:delay,.65);}}
    if(plan.deal){cardSound('draw',0,.45);cardSound('draw',150,.4);cardSound('draw',300,.4);}
    await Promise.all(jobs);if(this.generation!==generation)return;
    if(newTop)for(const node of [...this.discard.children])if(node!==newTop)node.remove();
    for(const slot of this.own.values())slot.firstElementChild.style.visibility='';for(const rival of this.rivals.values())for(const slot of rival.nodes.values())slot.firstElementChild.style.visibility='';this.syncReveals(state);
  }
}
