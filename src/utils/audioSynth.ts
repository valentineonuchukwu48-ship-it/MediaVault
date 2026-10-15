// Instant, lightweight Web Audio API ambient music synthesizer
// Provides zero-latency background audio presets without external bandwidth

class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: number | null = null;
  private masterGain: GainNode | null = null;
  private currentPreset = 'lofi';

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public start(preset: 'lofi' | 'cinematic' | 'celebrate' | 'piano' = 'lofi') {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    this.stop();

    this.isPlaying = true;
    this.currentPreset = preset;

    // Scale notes in Hz
    const notesMap: Record<string, number[]> = {
      lofi: [261.63, 293.66, 329.63, 392.00, 440.00], // C, D, E, G, A
      cinematic: [196.00, 220.00, 261.63, 293.66, 349.23], // G, A, C, D, F
      celebrate: [329.63, 392.00, 440.00, 493.88, 523.25], // E, G, A, B, C
      piano: [220.00, 277.18, 329.63, 440.00, 554.37], // A, C#, E, A, C#
    };

    const notes = notesMap[preset] || notesMap.lofi;

    const playChord = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;

      const pickCount = preset === 'cinematic' ? 3 : 2;
      for (let i = 0; i < pickCount; i++) {
        const freq = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.5 ? 1 : 0.5);
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        osc.type = preset === 'lofi' ? 'triangle' : preset === 'cinematic' ? 'sine' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        noteGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 0.8);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 3.5);

        osc.connect(noteGain);
        noteGain.connect(this.masterGain);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 3.6);
      }
    };

    playChord();
    this.intervalId = window.setInterval(playChord, 2800);
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getPlaying() {
    return this.isPlaying;
  }
}

export const ambientMusic = new AmbientMusicEngine();
