// Sound, all synthesised with WebAudio — no audio files, no network.
// One job: the engine that rises with the throttle, the wind that rises
// with speed, and a small vocabulary of chimes and thumps for the events
// the missions report. Created lazily on the first user gesture, as the
// browser's autoplay rules demand.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // Engine: two detuned saws through a lowpass, pitch follows the prop.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();

    // Wind: a looped noise buffer through a bandpass.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 640;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq = 900) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock,
    /** Continuous engine and wind, called every frame while flying. */
    engine(throttle, speed, airborne) {
      if (!ctx) return;
      const rpm = 42 + throttle * 68 + (airborne ? 12 : 0);
      engineOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, ctx.currentTime, 0.08);
      const eGain = (0.015 + throttle * 0.075) * (muted ? 0 : 1);
      engineGain.gain.setTargetAtTime(eGain, ctx.currentTime, 0.1);
      const wGain = Math.min(0.16, Math.max(0, (speed - 18) / 70) * 0.16) * (muted ? 0 : 1);
      windGain.gain.setTargetAtTime(wGain, ctx.currentTime, 0.15);
    },
    silence() {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    click() { tone(660, 0.07, 'triangle', 0.15); },
    ring(centre) {
      tone(centre ? 1046 : 880, 0.16, 'sine', 0.22);
      tone(centre ? 1568 : 1174, 0.22, 'sine', 0.18, 0.07);
    },
    pickup(kind) {
      if (kind === 'star') { tone(1318, 0.12, 'triangle', 0.2); tone(1760, 0.2, 'triangle', 0.18, 0.08); }
      else tone(520, 0.14, 'triangle', 0.2, 0, 780);
    },
    balloon() { noiseBurst(0.16, 0.3, 1600); tone(220, 0.2, 'sawtooth', 0.1, 0, 90); },
    damage() { noiseBurst(0.22, 0.32, 500); },
    stall() { tone(196, 0.16, 'square', 0.07); },
    land() {
      noiseBurst(0.18, 0.2, 300);
      tone(392, 0.14, 'triangle', 0.16, 0.05);
      tone(523, 0.16, 'triangle', 0.16, 0.16);
      tone(659, 0.3, 'triangle', 0.16, 0.27);
    },
    crash() {
      noiseBurst(0.7, 0.5, 700);
      tone(110, 0.6, 'sawtooth', 0.22, 0, 38);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
