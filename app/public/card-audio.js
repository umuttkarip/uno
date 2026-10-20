let context;
let warmed=false;
const buffers=new Map();
const samples={draw:['card-slide-1','card-slide-2','card-slide-3'],play:['card-place-1','card-place-2','card-place-3']};
const raw=new Map();
const counters={draw:0,play:0};
export function prepareAudio() {
  if(raw.size)return;
  for(const names of Object.values(samples))for(const name of names)raw.set(name,fetch('./assets/audio/'+name+'.mp3').then(r=>r.ok?r.arrayBuffer():null).catch(()=>null));
  decode();
}
function decode() {
  if(!context)return;
  for(const [name,data] of raw)if(!buffers.has(name))buffers.set(name,data.then(b=>b?context.decodeAudioData(b):null).catch(()=>null));
}
export function unlockAudio() {
  try {
    if(!context||context.state==='closed'){context=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});warmed=false;}
    // WebKit can otherwise route game effects through the phone's silent switch.
    try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback';}catch{}
    if(context.state!=='running'){context.resume().catch(()=>{});warmed=false;}
    if(!warmed){const silent=context.createBufferSource();silent.buffer=context.createBuffer(1,1,context.sampleRate);silent.connect(context.destination);silent.start();silent.onended=()=>silent.disconnect();warmed=true;}
    decode();
  }catch{}
}
export function installAudioUnlock(target=document,host=window){
  const options={capture:true,passive:true};
  for(const event of ['pointerdown','pointerup','touchend','keydown'])target.addEventListener(event,unlockAudio,options);
  const restore=()=>{if(context&&target.visibilityState!=='hidden')unlockAudio();};
  target.addEventListener('visibilitychange',restore);host.addEventListener('pageshow',restore);
}
export function cardSound(type='play',delay=0,volume=1) {
  if(!context||context.state!=='running')return;
  const names=samples[type]??samples.play;
  const name=names[(counters[type]++||0)%names.length];
  const requestedAt=context.currentTime+delay/1000;
  buffers.get(name)?.then(buffer=>{
    if(!buffer||context.state!=='running'||context.currentTime-requestedAt>.65)return;
    const source=context.createBufferSource();source.buffer=buffer;
    const gain=context.createGain();gain.gain.value=(type==='draw'?.5:.62)*volume;
    source.connect(gain);gain.connect(context.destination);
    source.start(Math.max(context.currentTime,requestedAt));
    source.onended=()=>{source.disconnect();gain.disconnect();};
  });
}
