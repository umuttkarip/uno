let context, noise;
export async function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state !== 'running') await context.resume();
    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * .35), context.sampleRate);
      const samples = noise.getChannelData(0);
      let last = 0;
      for (let i=0;i<samples.length;i++) {last = (last + Math.random() * 2 - 1) / 1.55; samples[i] = last;}
    }
  } catch {}
}

export function cardSound(type='play') {
  if (!context || context.state !== 'running' || !noise) return;
  const now = context.currentTime;
  const swish = context.createBufferSource(); swish.buffer = noise;
  const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(type==='draw'?2300:1500, now); filter.frequency.exponentialRampToValueAtTime(650, now+.13); filter.Q.value=.65;
  const volume = context.createGain(); volume.gain.setValueAtTime(.001,now); volume.gain.exponentialRampToValueAtTime(type==='draw'?.15:.12,now+.018); volume.gain.exponentialRampToValueAtTime(.001,now+.16);
  swish.connect(filter); filter.connect(volume); volume.connect(context.destination); swish.start(now); swish.stop(now+.18);
  if (type==='play') {
    const tap = context.createBufferSource(); tap.buffer=noise;
    const low = context.createBiquadFilter(); low.type='lowpass'; low.frequency.value=550;
    const gain = context.createGain(); gain.gain.setValueAtTime(.001,now+.075); gain.gain.exponentialRampToValueAtTime(.32,now+.082); gain.gain.exponentialRampToValueAtTime(.001,now+.125);
    tap.connect(low); low.connect(gain); gain.connect(context.destination); tap.start(now+.075); tap.stop(now+.13);
  }
}
