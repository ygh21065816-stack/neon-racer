// audio.js - Web Audio API sound engine

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.enabled = true;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Engine sound: two oscillators detuned
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.08;
      this.engineGain.connect(this.ctx.destination);

      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this._makeDistortionCurve(80);
      distortion.oversample = '4x';
      distortion.connect(this.engineGain);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineOsc.connect(distortion);
      this.engineOsc.start();

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 120;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.4;
      this.engineOsc2.connect(g2);
      g2.connect(this.engineGain);
      this.engineOsc2.start();

      this._initialized = true;
    } catch(e) {
      console.warn('Audio init failed:', e);
      this.enabled = false;
    }
  }

  _makeDistortionCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  setEngineRPM(speed, maxSpeed) {
    if (!this.enabled || !this._initialized) return;
    const ratio = Math.max(0.1, Math.abs(speed) / maxSpeed);
    const freq = 60 + ratio * 200;
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(freq * 2, now, 0.1);
    this.engineGain.gain.setTargetAtTime(0.06 + ratio * 0.04, now, 0.1);
  }

  playCollision() {
    if (!this.enabled || !this._initialized) return;
    try {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = 0.3;
      src.connect(g);
      g.connect(this.ctx.destination);
      src.start();
    } catch(e) {}
  }

  playLapComplete() {
    if (!this.enabled || !this._initialized) return;
    try {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.15, this.ctx.currentTime + i * 0.12, 0.01);
        g.gain.setTargetAtTime(0, this.ctx.currentTime + i * 0.12 + 0.1, 0.05);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.12);
        osc.stop(this.ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch(e) {}
  }

  playFinish() {
    if (!this.enabled || !this._initialized) return;
    try {
      const notes = [523, 659, 784, 1047, 1047];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'triangle';
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.2, this.ctx.currentTime + i * 0.15, 0.01);
        g.gain.setTargetAtTime(0, this.ctx.currentTime + i * 0.15 + 0.2, 0.05);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.15);
        osc.stop(this.ctx.currentTime + i * 0.15 + 0.4);
      });
    } catch(e) {}
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

export { AudioEngine };
