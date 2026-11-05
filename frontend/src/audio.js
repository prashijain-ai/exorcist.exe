import React from 'react';

// Procedural horror soundscape: no audio files, nothing to license.
let ctx, master, timer, pulseTimer;
let pulseMs = null;
let noiseBuf;
let on = false;

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Low drone: two detuned saws beat against each other, plus a sub tone
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  lp.connect(master);
  [[55, "sawtooth", 0.12], [55.6, "sawtooth", 0.12], [82.4, "sine", 0.08]].forEach(([f, type, gain]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.value = gain;
    o.connect(g).connect(lp);
    o.start();
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();

  // Choir pad: dark minor cluster that slowly swells and fades
  const padLp = ctx.createBiquadFilter();
  padLp.type = "lowpass";
  padLp.frequency.value = 650;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.5;
  padLp.connect(padGain).connect(master);
  [110, 130.81, 164.81, 174.61, 220.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    o.detune.value = (i - 2) * 7;
    g.gain.value = 0.035;
    o.connect(g).connect(padLp);
    o.start();
  });
  const swell = ctx.createOscillator();
  const swellGain = ctx.createGain();
  swell.frequency.value = 0.045;
  swellGain.gain.value = 0.45;
  swell.connect(swellGain).connect(padGain.gain);
  swell.start();

  // Wind: looping noise through a slowly sweeping band-pass filter
  const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  noiseBuf = buf;
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 0.6;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  noise.connect(bp).connect(windGain).connect(master);
  noise.start();
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.frequency.value = 0.11;
  sweepGain.gain.value = 300;
  sweep.connect(sweepGain).connect(bp.frequency);
  sweep.start();
}

function bell(freq, vol, len) {
  const t = ctx.currentTime;
  [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([mult, amp]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len / Math.sqrt(mult));
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.5);
  });
}

function panner() {
  const p = ctx.createStereoPanner();
  p.pan.value = Math.random() * 2 - 1;
  p.connect(master);
  return p;
}

// A slow, detuned music-box phrase in a minor key
function musicBox() {
  const phrase = [440, 523.25, 493.88, 440, 392, 415.3, 440, 329.63];
  const out = panner();
  const t0 = ctx.currentTime + 0.05;
  phrase.forEach((f, i) => {
    const t = t0 + i * (0.55 + Math.random() * 0.12);
    const drift = (Math.random() - 0.5) * 12 + i * 3; // goes slightly out of tune
    [[1, 0.06], [2, 0.025]].forEach(([mult, amp]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = mult === 1 ? "triangle" : "sine";
      o.frequency.value = f * mult;
      o.detune.value = drift;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.7);
    });
  });
}

// A slow door creak
function creak() {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const bp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, t);
  o.frequency.linearRampToValueAtTime(150 + Math.random() * 40, t + 0.7);
  o.frequency.linearRampToValueAtTime(60, t + 1.6);
  bp.type = "bandpass";
  bp.frequency.value = 420;
  bp.Q.value = 9;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
  o.connect(bp).connect(g).connect(panner());
  o.start(t);
  o.stop(t + 1.8);
}

// Breathy whispers drifting from one side
function whisper() {
  const out = panner();
  for (let k = 0; k < 3; k++) {
    const t = ctx.currentTime + k * (0.35 + Math.random() * 0.3);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    bp.type = "bandpass";
    bp.Q.value = 5;
    bp.frequency.setValueAtTime(1100 + Math.random() * 400, t);
    bp.frequency.linearRampToValueAtTime(2200 + Math.random() * 600, t + 0.7);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.9);
  }
}

function haunt() {
  if (!on) return;
  const r = Math.random();
  if (r < 0.28) {
    const notes = [196, 207.65, 293.66, 311.13]; // clashing minor seconds
    bell(notes[Math.floor(Math.random() * notes.length)], 0.05, 6);
  } else if (r < 0.5) creak();
  else if (r < 0.75) whisper();
  else musicBox();
  timer = setTimeout(haunt, 5000 + Math.random() * 8000);
}

export async function setSound(next) {
  if (next) {
    if (!ctx) build();
    await ctx.resume();
    on = true;
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
    clearTimeout(timer);
    haunt();
    beat();
  } else if (ctx) {
    on = false;
    clearTimeout(timer);
    clearTimeout(pulseTimer);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }
}

// Deep bell strike plus a low thump, played when a ghost is banished
export function toll() {
  if (!on || !ctx) return;
  bell(65.4, 0.35, 7);
  bell(130.8, 0.2, 5);
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.5);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.7);
}

// Heartbeat: the more money bleeds, the faster it beats. Pass null to stop it.
function thump(delay, vol) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.25);
}

function beat() {
  clearTimeout(pulseTimer);
  if (!on || !ctx || !pulseMs) return;
  thump(0, 0.55);
  thump(0.2, 0.35);
  pulseTimer = setTimeout(beat, pulseMs);
}

export function setPulse(ms) {
  pulseMs = ms;
  beat();
}

// A descending wail when a spirit is banished
export function wail() {
  if (!on || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 1.5);
  lp.type = "lowpass";
  lp.frequency.value = 900;
  vib.frequency.value = 7;
  vibGain.gain.value = 14;
  vib.connect(vibGain).connect(o.frequency);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(lp).connect(g).connect(master);
  o.start(t);
  vib.start(t);
  o.stop(t + 1.7);
  vib.stop(t + 1.7);
}