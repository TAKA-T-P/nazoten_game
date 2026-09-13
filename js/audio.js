// Web Audio APIによる合成音（仕様書 13章）。外部音声ファイルに依存しない。
let ctx = null;
let masterGain = null;
let enabled = true;

export function init() {
  if (ctx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  ctx = new AudioContextClass();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);
}

// モバイルの自動再生制限に対応するため、最初のユーザー操作で呼び出す。
export function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setEnabled(value) {
  enabled = Boolean(value);
}

export function isEnabled() {
  return enabled;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function tone({ freq, duration = 0.15, type = 'sine', delay = 0, volume = 0.6, freqEnd = null }) {
  if (!ctx || !enabled) return;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst({ duration = 0.08, delay = 0, volume = 0.3 }) {
  if (!ctx || !enabled) return;
  const t0 = now() + delay;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(gain);
  gain.connect(masterGain);
  source.start(t0);
}

// ド・レ・ミ・ファ・ソ（C5-G5）
const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99];

export function playTraceNote(index) {
  const freq = SCALE[Math.min(Math.max(index, 0), SCALE.length - 1)];
  tone({ freq, duration: 0.12, type: 'sine', volume: 0.5 });
}

// 通常成功：なぞり音より1オクターブ高い音を選択数ぶん高速再生。
export function playSuccess(count) {
  const n = Math.min(count, SCALE.length);
  for (let i = 0; i < n; i++) {
    tone({ freq: SCALE[i] * 2, duration: 0.14, type: 'triangle', delay: i * 0.05, volume: 0.55 });
  }
}

// 40成功：通常成功音 + 和音ときらめく上昇音。
export function playForty(count) {
  playSuccess(count);
  const chordDelay = count * 0.05 + 0.06;
  [523.25 * 2, 659.25 * 2, 783.99 * 2].forEach((freq) => {
    tone({ freq, duration: 0.35, type: 'triangle', delay: chordDelay, volume: 0.45 });
  });
  tone({ freq: 1400, freqEnd: 2200, duration: 0.3, type: 'sine', delay: chordDelay + 0.05, volume: 0.4 });
}

export function playFail() {
  tone({ freq: 130, freqEnd: 90, duration: 0.2, type: 'sawtooth', volume: 0.5 });
}

export function playCountdownTick() {
  tone({ freq: 440, duration: 0.15, type: 'square', volume: 0.5 });
}

export function playCountdownStart() {
  tone({ freq: 880, duration: 0.3, type: 'triangle', volume: 0.6 });
}

export function playLowTimeTick() {
  tone({ freq: 1000, duration: 0.08, type: 'square', volume: 0.4 });
}

export function playTimeUp() {
  tone({ freq: 300, freqEnd: 120, duration: 0.6, type: 'sawtooth', volume: 0.6 });
}

export function playResult() {
  for (let i = 0; i < 6; i++) noiseBurst({ duration: 0.06, delay: i * 0.09, volume: 0.25 });
  const chordDelay = 0.6;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    tone({ freq, duration: 0.5, type: 'triangle', delay: chordDelay, volume: 0.4 });
  });
}
