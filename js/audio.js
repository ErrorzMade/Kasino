import { state } from './state.js';

let ctx = null;
let master = null;

function audio() {
  if (state.settings.muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to, type = 'sine', dur = 0.12, vol = 0.5, delay = 0, attack = 0.005 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, delay = 0, filter = 2000, q = 1 }) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = filter;
  bp.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone({ freq: 900, to: 600, type: 'triangle', dur: 0.05, vol: 0.25 }),
  chip: () => {
    tone({ freq: 2400, type: 'square', dur: 0.03, vol: 0.08 });
    tone({ freq: 3200, type: 'sine', dur: 0.06, vol: 0.12, delay: 0.015 });
  },
  whoosh: () => noise({ dur: 0.45, vol: 0.25, filter: 900, q: 0.6 }),
  ting: () => {
    tone({ freq: 2093, type: 'sine', dur: 0.5, vol: 0.25 });
    tone({ freq: 3136, type: 'sine', dur: 0.4, vol: 0.12, delay: 0.01 });
  },
  land: () => {
    tone({ freq: 180, to: 60, type: 'sine', dur: 0.18, vol: 0.6 });
    noise({ dur: 0.08, vol: 0.2, filter: 3000 });
  },
  coin: (i = 0) => tone({ freq: 1600 + (i % 5) * 180, type: 'square', dur: 0.06, vol: 0.06, delay: i * 0.035 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.3, delay: i * 0.08 })),
  bigWin: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.3, delay: i * 0.07 }));
    for (let i = 0; i < 14; i++) sfx.coin(i + 6);
  },
  lose: () => {
    tone({ freq: 392, to: 370, type: 'sawtooth', dur: 0.25, vol: 0.12 });
    tone({ freq: 311, to: 196, type: 'sawtooth', dur: 0.45, vol: 0.12, delay: 0.2 });
  },
  pay: () => [784, 988, 1175].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.25, delay: i * 0.09 })),
  alarm: () => tone({ freq: 880, type: 'square', dur: 0.08, vol: 0.06 }),

  plink: (i = 0) => tone({ freq: 1400 + (i % 8) * 120, type: 'square', dur: 0.05, vol: 0.05 }),
  scratch: () => noise({ dur: 0.07, vol: 0.12 + Math.random() * 0.06, filter: 3500 + Math.random() * 2500, q: 0.8 }),
  reveal: (i = 0) => tone({ freq: 660 + i * 70, to: 990 + i * 70, type: 'triangle', dur: 0.12, vol: 0.18 }),
  thunk: () => {
    tone({ freq: 140, to: 70, type: 'square', dur: 0.12, vol: 0.25 });
    noise({ dur: 0.05, vol: 0.25, filter: 1200 });
  },
  lever: () => {
    noise({ dur: 0.25, vol: 0.15, filter: 600, q: 3 });
    tone({ freq: 220, to: 110, type: 'sawtooth', dur: 0.2, vol: 0.08 });
  },
  engine: (m = 1) => tone({ freq: 160 + Math.min(m, 20) * 35, type: 'sawtooth', dur: 0.08, vol: 0.05 }),
  boom: () => {
    noise({ dur: 0.7, vol: 0.5, filter: 300, q: 0.5 });
    tone({ freq: 120, to: 40, type: 'sine', dur: 0.5, vol: 0.5 });
  },
  squeak: () => tone({ freq: 1500 + Math.random() * 700, to: 2400 + Math.random() * 600, type: 'sine', dur: 0.06, vol: 0.06 }),
  reelTick: () => tone({ freq: 500 + Math.random() * 200, type: 'square', dur: 0.02, vol: 0.04 }),
  peg: () => {
    tone({ freq: 1800, type: 'square', dur: 0.02, vol: 0.07 });
    noise({ dur: 0.03, vol: 0.1, filter: 5000 });
  },
  suspense: () => [0, 1, 2, 3, 4, 5].forEach((i) => tone({ freq: 300 + i * 40, type: 'triangle', dur: 0.09, vol: 0.12, delay: i * 0.12 })),
  jackpot: () => {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.16, vol: 0.12, delay: i * 0.09 }));
    for (let i = 0; i < 24; i++) sfx.coin(i + 4);
  },
};
