let context;
const buffers=new Map();
const samples={draw:['card-slide-1','card-slide-2','card-slide-3'],play:['card-place-1','card-place-2','card-place-3']};
const raw=new Map();
const counters={draw:0,play:0};
for(const names of Object.values(samples))for(const name of names)raw.set(name,fetch('./assets/audio/'+name+'.wav').then(r=>r.ok?r.arrayBuffer():null).catch(()=>null));
function decode() {
  if(!context)return;
  for(const [name,data] of raw)if(!buffers.has(name))buffers.set(name,data.then(b=>b?context.decodeAudioData(b):null).catch(()=>null));
}
export function unlockAudio() {
  try {
    context??=new (window.AudioContext||window.webkitAudioContext)();
    if(context.state!=='running')context.resume().catch(()=>{});
    decode();
  }catch{}
}
export function cardSound(type='play',delay=0,volume=1) {
  if(!context||context.state!=='running')return;
  const names=samples[type]??samples.play;
  const name=names[(counters[type]++||0)%names.length];
  const requestedAt=context.currentTime+delay/1000;
  buffers.get(name)?.then(buffer=>{
    if(!buffer||context.state!=='running'||context.currentTime-requestedAt>.18)return;
    const source=context.createBufferSource();source.buffer=buffer;
    const gain=context.createGain();gain.gain.value=(type==='draw'?.5:.62)*volume;
    source.connect(gain);gain.connect(context.destination);
    source.start(Math.max(context.currentTime,requestedAt));
    source.onended=()=>{source.disconnect();gain.disconnect();};
  });
}
