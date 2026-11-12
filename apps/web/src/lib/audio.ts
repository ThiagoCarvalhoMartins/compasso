import type { AlertSound } from "@compasso/shared";

/**
 * Sons sintetizados com a Web Audio API — sino, tigela tibetana e um tom suave, nada de bipes.
 * Navegadores só liberam áudio depois de um gesto do usuário: `unlockAudio()` roda no clique em "Iniciar meu dia".
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): boolean {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  // Um som mudo de 1 amostra garante o desbloqueio no Safari/iOS.
  const buffer = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return true;
}

export const isAudioUnlocked = () => ctx !== null && ctx.state === "running";

const GESTURE_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

/**
 * Depois de um recarregamento não há gesto recente, então o navegador mantém o áudio bloqueado.
 * Tenta destravar já (alguns navegadores permitem em sites usados com frequência) e, se não der,
 * destrava no primeiro toque ou tecla em qualquer lugar da página. Retorna a função de limpeza.
 */
export function unlockAudioOnFirstGesture(): () => void {
  try {
    unlockAudio();
  } catch {
    // Sem gesto alguns navegadores recusam criar o contexto; o primeiro gesto tenta de novo.
  }
  const onGesture = () => {
    unlockAudio();
    if (isAudioUnlocked()) cleanup();
  };
  const cleanup = () => GESTURE_EVENTS.forEach((e) => window.removeEventListener(e, onGesture, true));
  if (!isAudioUnlocked()) GESTURE_EVENTS.forEach((e) => window.addEventListener(e, onGesture, true));
  return cleanup;
}

interface Partial {
  ratio: number;
  gain: number;
  decay: number;
  detune?: number;
}

const VOICES: Record<AlertSound, { base: number; attack: number; partials: Partial[] }> = {
  sino: {
    base: 784,
    attack: 0.005,
    partials: [
      { ratio: 1, gain: 0.5, decay: 2.8 },
      { ratio: 2.76, gain: 0.18, decay: 1.6 },
      { ratio: 5.4, gain: 0.07, decay: 0.8 },
    ],
  },
  tigela: {
    base: 220,
    attack: 0.04,
    partials: [
      { ratio: 1, gain: 0.5, decay: 6 },
      { ratio: 1, gain: 0.3, decay: 6, detune: 6 },
      { ratio: 2.71, gain: 0.2, decay: 4 },
      { ratio: 5.12, gain: 0.06, decay: 2.5 },
    ],
  },
  suave: {
    base: 523.25,
    attack: 0.12,
    partials: [
      { ratio: 1, gain: 0.45, decay: 1.8 },
      { ratio: 2, gain: 0.1, decay: 1.2 },
    ],
  },
};

function strike(sound: AlertSound, volume: number, at: number, pitch = 1) {
  if (!ctx) return;
  const voice = VOICES[sound];
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(ctx.destination);
  for (const p of voice.partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = voice.base * p.ratio * pitch;
    if (p.detune) osc.detune.value = p.detune;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(p.gain, at + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + p.decay);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + p.decay + 0.05);
  }
}

/** Início de bloco: uma batida. Aviso de fim: duas batidas mais graves. */
export function playAlert(kind: "start" | "end" | "qp", sound: AlertSound, volume: number) {
  // Com o áudio ainda bloqueado o som ficaria na fila e tocaria atrasado no primeiro gesto.
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime + 0.02;
  if (kind === "start") strike(sound, volume, now);
  else if (kind === "end") {
    strike(sound, volume * 0.8, now, 0.84);
    strike(sound, volume * 0.6, now + 0.45, 0.84);
  } else strike("tigela", volume * 0.6, now, 1.5);
}

// ---------- Som de fundo das Repetições QP: mar e vento no ritmo de uma respiração calma ----------

export const AMBIENT_SOUNDS = ["mar", "vento"] as const;
export type AmbientSound = (typeof AMBIENT_SOUNDS)[number];

/** Seis respirações por minuto. A animação `breath` (theme.css) usa este mesmo ciclo: 40% subindo, 60% descendo. */
const INHALE_SECONDS = 4;
const EXHALE_SECONDS = 6;
const CYCLE_SECONDS = INHALE_SECONDS + EXHALE_SECONDS;

export const isInhaling = (elapsedSeconds: number) => elapsedSeconds % CYCLE_SECONDS < INHALE_SECONDS;

/** Intensidade da respiração de 0 a 1, com subida e descida suaves. */
function breathIntensity(elapsedSeconds: number) {
  const t = elapsedSeconds % CYCLE_SECONDS;
  return t < INHALE_SECONDS
    ? 0.5 - 0.5 * Math.cos((Math.PI * t) / INHALE_SECONDS)
    : 0.5 + 0.5 * Math.cos((Math.PI * (t - INHALE_SECONDS)) / EXHALE_SECONDS);
}

type NoiseColor = "branco" | "rosa" | "marrom";

const NOISE_LOOP_SECONDS = 6;
const NOISE_FADE_SECONDS = 1;
const noiseCache = new Map<NoiseColor, AudioBuffer>();

function fillNoise(out: Float32Array, color: NoiseColor) {
  let brown = 0;
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    let sample = white;
    if (color === "marrom") {
      brown = (brown + 0.02 * white) / 1.02;
      sample = brown;
    } else if (color === "rosa") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }
    out[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.9;
}

/** Ruído estéreo em loop. O fim do trecho é misturado ao começo para a emenda não estalar. */
function noiseBuffer(audio: AudioContext, color: NoiseColor) {
  const cached = noiseCache.get(color);
  if (cached) return cached;
  const length = Math.floor(NOISE_LOOP_SECONDS * audio.sampleRate);
  const fade = Math.floor(NOISE_FADE_SECONDS * audio.sampleRate);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  const raw = new Float32Array(length + fade);
  for (let channel = 0; channel < 2; channel++) {
    fillNoise(raw, color);
    const out = buffer.getChannelData(channel);
    out.set(raw.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      const mix = i / fade;
      out[i] = raw[i] * Math.sqrt(mix) + raw[length + i] * Math.sqrt(1 - mix);
    }
  }
  noiseCache.set(color, buffer);
  return buffer;
}

let reverbCache: AudioBuffer | null = null;

/** Resposta de um espaço aberto: ruído que some aos poucos, diferente em cada canal para soar amplo. */
function reverbImpulse(audio: AudioContext) {
  if (reverbCache) return reverbCache;
  const seconds = 2.5;
  const length = Math.floor(seconds * audio.sampleRate);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const out = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  reverbCache = buffer;
  return buffer;
}

export interface AmbientHandle {
  /** Silencia sem interromper o ciclo, para o som voltar no ritmo certo. */
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

/** Inicia o som de fundo. Volume e timbre seguem a respiração durante `seconds`. */
export function startAmbient(sound: AmbientSound, volume: number, seconds: number): AmbientHandle | null {
  if (!ctx) return null;
  const audio = ctx;
  // Gerar o ruído leva tempo: precisa vir antes de marcar o início, ou o agendamento já nasce no passado.
  const colors: NoiseColor[] = sound === "mar" ? ["marrom", "branco"] : ["rosa"];
  colors.forEach((color) => noiseBuffer(audio, color));
  const start = audio.currentTime + 0.1;
  const level = Math.max(0, Math.min(1, volume)) * 0.42;
  const master = audio.createGain();
  master.gain.setValueAtTime(0, start);
  master.gain.linearRampToValueAtTime(level, start + 1);
  master.connect(audio.destination);

  // Distância: menos agudos, como o ar faz com um som longínquo, e parte dele chegando só pelo reverb.
  const distance = audio.createBiquadFilter();
  distance.type = "highshelf";
  distance.frequency.value = 1200;
  distance.gain.value = -10;
  const direct = audio.createGain();
  direct.gain.value = 0.65;
  const reverb = audio.createConvolver();
  reverb.buffer = reverbImpulse(audio);
  const reflected = audio.createGain();
  reflected.gain.value = 0.9;
  distance.connect(direct).connect(master);
  distance.connect(reverb).connect(reflected).connect(master);

  const stoppable: AudioScheduledSourceNode[] = [];

  /** Faz o parâmetro acompanhar a respiração, indo de `low` (expirado) a `high` (inspirado). */
  const followBreath = (param: AudioParam, low: number, high: number, curvePower = 1) => {
    // Um ciclo de folga cobre o intervalo entre o fim do cronômetro e o encerramento da sessão.
    const duration = (Math.ceil(seconds / CYCLE_SECONDS) + 1) * CYCLE_SECONDS;
    const points = duration * 50;
    const curve = new Float32Array(points);
    for (let i = 0; i < points; i++) {
      const intensity = breathIntensity((i / (points - 1)) * duration);
      curve[i] = low + (high - low) * intensity ** curvePower;
    }
    // Uma única curva para a sessão inteira: curvas seguidas podem se sobrepor e o navegador recusa.
    param.setValueCurveAtTime(curve, start, duration);
  };

  const noiseSource = (color: NoiseColor) => {
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer(audio, color);
    source.loop = true;
    source.start(start);
    stoppable.push(source);
    return source;
  };

  /** Uma camada: ruído → filtro → volume, os dois últimos no ritmo da respiração. */
  const layer = (
    color: NoiseColor,
    filterType: BiquadFilterType,
    q: number,
    frequency: [number, number],
    gain: [number, number],
    gainCurvePower = 1,
  ) => {
    const filter = audio.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    followBreath(filter.frequency, frequency[0], frequency[1]);
    const amp = audio.createGain();
    followBreath(amp.gain, gain[0], gain[1], gainCurvePower);
    noiseSource(color).connect(filter).connect(amp).connect(distance);
    return filter;
  };

  if (sound === "mar") {
    layer("marrom", "lowpass", 0.5, [320, 1600], [0.25, 1.6]); // o corpo da onda
    layer("branco", "highpass", 0.5, [2200, 2200], [0.002, 0.07], 3); // a espuma, só no pico
  } else {
    const body = layer("rosa", "bandpass", 0.8, [320, 850], [0.7, 3.4]); // a rajada
    const whistle = layer("rosa", "bandpass", 10, [650, 1050], [0.2, 1.25]); // o assobio
    // Uma oscilação lenta evita que o vento pareça regular demais.
    const drift = audio.createOscillator();
    const driftAmount = audio.createGain();
    drift.frequency.value = 0.09;
    driftAmount.gain.value = 140;
    drift.connect(driftAmount);
    driftAmount.connect(body.detune);
    driftAmount.connect(whistle.detune);
    drift.start(start);
    stoppable.push(drift);
  }

  let stopped = false;
  return {
    setMuted(muted) {
      if (stopped) return;
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0 : level, now, 0.2);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = audio.currentTime;
      const fade = 1.2;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + fade);
      for (const node of stoppable) node.stop(now + fade + 0.05);
    },
  };
}
