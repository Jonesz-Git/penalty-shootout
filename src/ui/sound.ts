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

  /** Keeper's Save: a sharp glove smack, then a crowd "ooh" that rises and falls. */
  save(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Glove smack: a very short, bright burst of noise over a low thud.
    const smack = this.noise(ctx, 0.08);
    const smackFilter = ctx.createBiquadFilter();
    smackFilter.type = 'highpass';
    smackFilter.frequency.value = 1800;
    const smackGain = ctx.createGain();
    smackGain.gain.setValueAtTime(0.9, t);
    smackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    smack.connect(smackFilter).connect(smackGain).connect(ctx.destination);
    smack.start(t);

    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.frequency.setValueAtTime(220, t);
    thud.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    thudGain.gain.setValueAtTime(0.6, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    thud.connect(thudGain).connect(ctx.destination);
    thud.start(t);
    thud.stop(t + 0.11);

    // Crowd "ooh": filtered noise whose pitch swells up then sinks.
    const start = t + 0.08;
    const ooh = this.noise(ctx, 1.1);
    const oohFilter = ctx.createBiquadFilter();
    oohFilter.type = 'bandpass';
    oohFilter.Q.value = 3;
    oohFilter.frequency.setValueAtTime(350, start);
    oohFilter.frequency.linearRampToValueAtTime(650, start + 0.35);
    oohFilter.frequency.linearRampToValueAtTime(300, start + 1.0);
    const oohGain = ctx.createGain();
    oohGain.gain.setValueAtTime(0.001, start);
    oohGain.gain.exponentialRampToValueAtTime(0.6, start + 0.2);
    oohGain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);
    ooh.connect(oohFilter).connect(oohGain).connect(ctx.destination);
    ooh.start(start);
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
