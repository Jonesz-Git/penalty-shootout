/** Synthesised sound effects (no audio files). Silent while muted; the AudioContext is created lazily. */
export class Sound {
  private ctx: AudioContext | null = null;

  constructor(public muted: boolean) {}

  private audio(): AudioContext | null {
    if (this.muted) return null;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  kick(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  cheer(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = this.noise(ctx, 1.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  groan(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = this.noise(ctx, 1.0);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 1.0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }
}
