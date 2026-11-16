class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopEngine();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore speech errors
        }
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // Ignore speech errors
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  public updateEngine(speedRatio: number, gasPressed: boolean, active: boolean) {
    if (this.muted || !active) {
      this.stopEngine();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    if (!this.engineOsc || !this.engineGain || !this.engineFilter) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = 55;

      filter.type = 'lowpass';
      filter.frequency.value = 180;

      gain.gain.value = 0.015;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.engineOsc = osc;
      this.engineFilter = filter;
      this.engineGain = gain;
    }

    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1.3, speedRatio));
    const targetFreq = 48 + clamped * 92 + (gasPressed ? 24 : 0);
    const targetFilter = 160 + clamped * 320 + (gasPressed ? 140 : 0);
    const targetGain = gasPressed ? 0.032 : 0.014;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.06);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.engineOsc = null;
    }
    if (this.engineFilter) {
      this.engineFilter.disconnect();
      this.engineFilter = null;
    }
    if (this.engineGain) {
      this.engineGain.disconnect();
      this.engineGain = null;
    }
  }

  public playCoin(combo = 0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const pitchShift = Math.min(combo, 6) * 45;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(880 + pitchShift, now);
    osc1.frequency.exponentialRampToValueAtTime(1320 + pitchShift, now + 0.09);

    osc2.frequency.setValueAtTime(1320 + pitchShift, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1760 + pitchShift, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  public playSpecialCoin() {
    if (this.muted) return;

    // 1. Celebratory sparkling chime
    const ctx = this.ensureContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const notes = [783.99, 987.77, 1174.66, 1567.98];
      notes.forEach((freq, i) => {
        const now = ctx.currentTime + i * 0.05;
        const osc = ctx.createOscillator();
        const shimmer = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        shimmer.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        shimmer.frequency.setValueAtTime(freq * 2, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

        osc.connect(gain);
        shimmer.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        shimmer.start(now);
        osc.stop(now + 0.36);
        shimmer.stop(now + 0.36);
      });
    }

    // 2. Clear voice announcement saying "EarnOS!"
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance('Earn O S!');
        const voices = synth.getVoices();
        const preferredVoice =
          voices.find(
            (v) => v.lang.startsWith('en') && v.localService
          ) || voices.find((v) => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        utterance.rate = 1.05;
        utterance.pitch = 1.15;
        utterance.volume = 1.0;
        synth.speak(utterance);
      } catch {
        // Ignore if speech synthesis is unavailable
      }
    }
  }

  public playLand(intensity: number) {
    if (this.muted || intensity < 0.15) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);

    const vol = Math.min(0.16, 0.04 + intensity * 0.08);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playStunt() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playJump() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playBoost() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playCrash() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.35);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playVictory() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }
}

export const soundEngine = new SoundEngine();
