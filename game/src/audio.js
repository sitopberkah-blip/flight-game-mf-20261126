// Sound, all synthesised with WebAudio oscillators — no audio files, no
// network. The engine hums with the throttle, rings chime, landings thump
// and crashes crunch. Created lazily on the first user gesture.

export function createAudio() {
  const audio = {
    ctx: null,
    engine: null,
    engineGain: null,
    muted: false,
    enabled: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      // Engine: two detuned sawtooths through a low-pass filter.
      audio.engine = audio.ctx.createOscillator();
      audio.engine.type = 'sawtooth';
      audio.engine.frequency.value = 55;
      const second = audio.ctx.createOscillator();
      second.type = 'sawtooth';
      second.frequency.value = 55.7;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engine.connect(filter);
      second.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engine.start();
      second.start();
      audio.second = second;
      audio.filter = filter;
      audio.enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const start = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    get muted() { return audio.muted; },
    unlock() {
      if (ensure() && audio.ctx.state === 'suspended') audio.ctx.resume();
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.engineGain) audio.engineGain.gain.value = audio.muted ? 0 : 0.05;
      return audio.muted;
    },
    /** Engine hum follows the throttle and the airspeed. */
    engine(throttle, speed, airborne) {
      if (!audio.ctx || audio.muted || !audio.enabled) return;
      const freq = 42 + throttle * 58 + speed * 0.12;
      audio.engine.frequency.value = freq;
      audio.second.frequency.value = freq * 1.013;
      audio.filter.frequency.value = 300 + throttle * 700;
      const target = airborne ? 0.028 + throttle * 0.05 : 0.012 + throttle * 0.03;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
    },
    ring(perfect) {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.4, 'sine', 0.12, 0.07);
      if (perfect) tone(1760, 0.5, 'sine', 0.1, 0.14);
    },
    land() {
      tone(140, 0.3, 'sine', 0.22);
      tone(660, 0.3, 'sine', 0.1, 0.1);
      tone(990, 0.45, 'sine', 0.1, 0.2);
    },
    crash() {
      if (!audio.ctx || audio.muted) return;
      const start = audio.ctx.currentTime;
      const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 0.5, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const source = audio.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.3;
      source.connect(gain);
      gain.connect(audio.ctx.destination);
      source.start(start);
      tone(70, 0.6, 'sawtooth', 0.2);
    },
    click() {
      tone(520, 0.08, 'square', 0.06);
    },
  };
}
