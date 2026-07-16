// Synthesized audio: pogo spring boing, mushroom sproing, wall bonk, bone clatter, wind, music loop.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.musicOn = true;
    this._musicTimer = null;
    this._nextBeat = 0;
    this._step = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windFilter).connect(this.windGain).connect(this.master);
    windSrc.start();

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this._startMusic();
  }

  _env(gainNode, t, peak, dur) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + 0.01);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _blip(type, f0, f1, dur, peak, when = 0, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, peak, dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, peak, freq, q, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, peak, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  boing(power = 0.5, weight = 1) {
    if (!this.ctx) return;
    const f = 420 + power * 260;
    this._blip('triangle', f, f * 0.32, 0.22 + power * 0.1, 0.5 * weight + 0.12);
    this._blip('sine', f * 1.9, f * 0.6, 0.12, 0.14);
    this._noise(0.05, 0.16 * weight, 2400, 1.2);
  }

  shroom() {
    this._blip('triangle', 240, 900, 0.28, 0.5);
    this._blip('sine', 480, 1500, 0.22, 0.2, 0.03);
  }

  bonk() {
    this._blip('square', 180, 70, 0.12, 0.3);
    this._noise(0.08, 0.25, 900, 1);
  }

  clatter() {
    for (let i = 0; i < 7; i++) {
      this._noise(0.04, 0.3, 1400 + Math.random() * 1800, 6, i * 0.07 + Math.random() * 0.03);
      if (i % 2 === 0) this._blip('square', 500 + Math.random() * 500, 200, 0.05, 0.1, i * 0.07);
    }
  }

  setWind(v) {
    if (this.windGain) this.windGain.gain.setTargetAtTime(Math.min(0.28, v * 0.28), this.ctx.currentTime, 0.15);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.16 : 0, this.ctx.currentTime, 0.1);
    return this.musicOn;
  }

  _startMusic() {
    const bpm = 128;
    const spb = 60 / bpm / 2;
    const lead = [0, 4, 7, 12, 7, 4, 9, 7, 5, 9, 12, 16, 12, 9, 7, 4, 0, 4, 7, 12, 14, 12, 9, 7, 5, 2, 5, 9, 7, 4, 2, 0];
    const bass = [0, 0, -5, -5, -7, -7, -3, -3];
    const root = 220;
    this._nextBeat = this.ctx.currentTime + 0.1;
    this._musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this._nextBeat < this.ctx.currentTime + 0.25) {
        const s = this._step;
        const when = this._nextBeat - this.ctx.currentTime;
        if (this.musicOn) {
          const n = lead[s % lead.length];
          if (s % 2 === 0 || Math.random() < 0.4) {
            const f = root * Math.pow(2, n / 12);
            this._blip('square', f, f, spb * 0.9, 0.10, when, this.musicGain);
          }
          if (s % 4 === 0) {
            const b = root / 2 * Math.pow(2, bass[(s / 4) % bass.length] / 12);
            this._blip('triangle', b, b, spb * 3.2, 0.16, when, this.musicGain);
          }
          if (s % 2 === 1) this._noise(0.03, 0.05, 6000, 1, when);
        }
        this._nextBeat += spb;
        this._step++;
      }
    }, 100);
  }
}
