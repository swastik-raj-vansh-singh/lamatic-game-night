'use client';

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('gn-muted') === '1';
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem('gn-muted', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOpts = { type?: OscillatorType; vol?: number; when?: number; slideTo?: number };

function tone(freq: number, dur: number, { type = 'square', vol = 0.04, when = 0, slideTo }: ToneOpts = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock: () => void audio(),
  tick: () => tone(1500, 0.025, { vol: 0.025 }),
  count: () => tone(990, 0.08, { type: 'triangle', vol: 0.06 }),
  pop: () => tone(660, 0.09, { type: 'triangle', vol: 0.06, slideTo: 990 }),
  buzz: () => {
    tone(220, 0.28, { type: 'square', vol: 0.09 });
    tone(330, 0.28, { type: 'square', vol: 0.05 });
  },
  ding: () => {
    tone(880, 0.12, { type: 'triangle', vol: 0.07 });
    tone(1320, 0.3, { type: 'triangle', vol: 0.06, when: 0.1 });
  },
  wrong: () => {
    tone(196, 0.22, { type: 'sawtooth', vol: 0.06 });
    tone(147, 0.4, { type: 'sawtooth', vol: 0.06, when: 0.2 });
  },
  timeUp: () => tone(150, 0.7, { type: 'sawtooth', vol: 0.07 }),
  fanfare: () =>
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.16, { type: 'triangle', vol: 0.09, when: i * 0.13 })),
  wah: () =>
    ([[392, 370], [370, 349], [349, 330], [330, 247]] as const).forEach(([a, b], i) =>
      tone(a, i === 3 ? 0.95 : 0.34, { type: 'sawtooth', vol: 0.05, when: i * 0.38, slideTo: b }),
    ),
};
