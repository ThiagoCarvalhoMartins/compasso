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
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;
  if (kind === "start") strike(sound, volume, now);
  else if (kind === "end") {
    strike(sound, volume * 0.8, now, 0.84);
    strike(sound, volume * 0.6, now + 0.45, 0.84);
  } else strike("tigela", volume * 0.6, now, 1.5);
}
