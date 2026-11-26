// All sound is synthesised live with WebAudio — no audio files, no network.
// The engine hum follows the throttle, rings chime, landings sing, crashes thud.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windGain = null;
    this.started = false;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.buildEngine();
    } catch (err) {
      this.ctx = null;
    }
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(ctx.destination);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    this.engineOsc.connect(this.engineGain);
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 104;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.engineOsc2.connect(g2);
    g2.connect(this.engineGain);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Wind: looped noise through a low-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    src.start();
    this.started = true;
  }

  /** Called every frame with the plane's throttle and speed. */
  update(throttle, speed, airborne) {
    if (!this.ctx || this.muted || !this.started) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const hum = airborne ? 0.05 + throttle * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(hum, t, 0.08);
    const freq = 46 + throttle * 68 + speed * 0.35;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(freq * 2, t, 0.1);
    this.windGain.gain.setTargetAtTime(airborne ? Math.min(0.05, speed * 0.0009) : 0, t, 0.2);
  }

  tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this.tone(880, 0.22, 'sine', 0.14);
    this.tone(1318, 0.34, 'sine', 0.1, 0.07);
  }

  drop() {
    this.tone(520, 0.18, 'triangle', 0.14);
    this.tone(392, 0.26, 'triangle', 0.12, 0.08);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
    this.tone(70, 0.5, 'sine', 0.3);
  }

  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.13, i * 0.11));
  }

  warn() {
    this.tone(660, 0.12, 'square', 0.06);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.engineGain) {
      this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
    }
    return this.muted;
  }
}
