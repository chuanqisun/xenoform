/**
 * Audio engine — Web Audio ambient soundscape that reacts to pin movement.
 */

const VOICES = 16;

export interface AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  voices: Voice[];
}

interface Voice {
  gain: GainNode;
  filter: BiquadFilterNode;
  osc: OscillatorNode;
  baseFreq: number;
  vary: number;
}

/** Initialize the Web Audio engine. Call on first user interaction. */
export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  ctx.resume();

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(ctx.destination);

  // Shared noise buffer
  const bufLen = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;

  const voices: Voice[] = [];
  for (let i = 0; i < VOICES; i++) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const baseFreq = 120 + Math.random() * 280;
    osc.frequency.value = baseFreq;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    noise.playbackRate.value = 0.2 + Math.random() * 0.4;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 150;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.3 + Math.random() * 2.5;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.15;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start();
    noise.start();
    lfo.start();

    voices.push({ gain, filter, osc, baseFreq, vary: 0.5 + Math.random() * 0.8 });
  }

  return { ctx, masterGain, voices };
}

/** Update voice parameters based on movement intensity. */
export function updateAudio(engine: AudioEngine, intensity: number, maxP: number): void {
  const now = engine.ctx.currentTime;
  const audioScale = 180 / maxP;
  const scaledIntensity = intensity * audioScale;

  for (const v of engine.voices) {
    const g = Math.min(scaledIntensity * 0.6 * v.vary, 0.35);
    v.gain.gain.setTargetAtTime(g, now, 0.04);
    v.osc.frequency.setTargetAtTime(v.baseFreq + scaledIntensity * 180, now, 0.1);
    v.filter.frequency.setTargetAtTime(150 + scaledIntensity * 1500, now, 0.1);
  }
}

/** Mute audio smoothly (e.g. when tab hidden). */
export function muteAudio(engine: AudioEngine): void {
  engine.masterGain.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.1);
}

/** Restore audio smoothly (e.g. when tab visible). */
export function unmuteAudio(engine: AudioEngine): void {
  engine.masterGain.gain.setTargetAtTime(0.12, engine.ctx.currentTime, 0.3);
  if (engine.ctx.state === "suspended") engine.ctx.resume();
}
