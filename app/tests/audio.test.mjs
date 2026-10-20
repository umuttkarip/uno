import test from 'node:test';
import assert from 'node:assert/strict';

async function setup(t,{deniedFirst=false}={}){
  const instances=[],starts=[],session={type:'auto'};let fetches=0;
  class AudioContext {
    constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.destination={};this.resumes=0;instances.push(this);}
    resume(){this.resumes++;if(deniedFirst&&this.resumes===1)return Promise.reject(new Error('gesture required'));this.state='running';return Promise.resolve();}
    createBuffer(){return {silent:true};}
    createBufferSource(){return {connect(){},disconnect(){},start(at){starts.push({buffer:this.buffer,at});}};}
    createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
    async decodeAudioData(){return {sample:true};}
  }
  for(const [key,value]of Object.entries({window:{AudioContext},navigator:{audioSession:session},fetch:async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}})){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});t.after(()=>old?Object.defineProperty(globalThis,key,old):Reflect.deleteProperty(globalThis,key));
  }
  const audio=await import('../public/card-audio.js?test='+crypto.randomUUID());
  return {audio,instances,starts,session,fetches:()=>fetches,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}

test('touch release can unlock audio even when the earlier pointer event was refused',async t=>{
  const q=await setup(t,{deniedFirst:true}),doc=new EventTarget(),host=new EventTarget();q.audio.installAudioUnlock(doc,host);
  assert.equal(q.instances.length,0);assert.equal(q.fetches(),0);
  doc.dispatchEvent(new Event('pointerdown'));await q.flush();assert.equal(q.instances[0].state,'suspended');
  doc.dispatchEvent(new Event('touchend'));await q.flush();assert.equal(q.instances[0].state,'running');assert.equal(q.session.type,'playback');
  assert.ok(q.starts.some(s=>s.buffer.silent));assert.equal(q.fetches(),0);
});

test('interrupted and closed mobile audio contexts recover on later game gestures',async t=>{
  const q=await setup(t),doc=new EventTarget(),host=new EventTarget();q.audio.installAudioUnlock(doc,host);doc.dispatchEvent(new Event('pointerup'));
  q.instances[0].state='interrupted';doc.dispatchEvent(new Event('pointerup'));assert.equal(q.instances[0].state,'running');assert.equal(q.instances[0].resumes,2);
  q.instances[0].state='closed';doc.dispatchEvent(new Event('keydown'));assert.equal(q.instances.length,2);assert.equal(q.instances[1].state,'running');
});

test('sound samples load once on demand and a short first-decode delay does not silence the effect',async t=>{
  const q=await setup(t);q.audio.prepareAudio();q.audio.unlockAudio();q.audio.cardSound('draw');q.instances[0].currentTime=.4;await q.flush();
  assert.equal(q.fetches(),6);assert.equal(q.starts.filter(s=>s.buffer.sample).length,1);q.audio.prepareAudio();assert.equal(q.fetches(),6);
  q.instances[0].currentTime=1;q.audio.cardSound('play');q.instances[0].currentTime=2;await q.flush();assert.equal(q.starts.filter(s=>s.buffer.sample).length,1);
});

test('returning from the background resumes an existing context without creating audio before first interaction',async t=>{
  const q=await setup(t),doc=new EventTarget(),host=new EventTarget();q.audio.installAudioUnlock(doc,host);host.dispatchEvent(new Event('pageshow'));assert.equal(q.instances.length,0);
  doc.dispatchEvent(new Event('touchend'));q.instances[0].state='interrupted';host.dispatchEvent(new Event('pageshow'));assert.equal(q.instances[0].state,'running');
});
