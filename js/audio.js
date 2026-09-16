// Web Audio APIによる合成SEと、HTMLAudioElementによるBGM再生（仕様書 13章）。
import { BGM_TRACKS, BGM_BASE_PATH } from './config.js';

let ctx = null;
let masterGain = null;
let seEnabled = true;
let bgmEnabled = true;
let soundMode = 'bgmRandom';

// サウンドモードのうちbgm1〜bgm5は、対応するBGM_TRACKSのidを固定で選ぶ。
const FIXED_TRACK_IDS = { bgm1: 'bgm01', bgm2: 'bgm02', bgm3: 'bgm03', bgm4: 'bgm04', bgm5: 'bgm05' };

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

// mode: 'bgmOff'（効果音のみ）| 'bgmRandom'（BGMランダム＋効果音）|
//       'bgm1'〜'bgm5'（固定の1曲＋効果音）| 'off'（無音）
export function setSoundMode(mode) {
  soundMode = mode;
  seEnabled = mode !== 'off';
  bgmEnabled = mode !== 'off' && mode !== 'bgmOff';
  if (!bgmEnabled) stopBgm();
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function tone({ freq, duration = 0.15, type = 'sine', delay = 0, volume = 0.6, freqEnd = null }) {
  if (!ctx || !seEnabled) return;
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
  if (!ctx || !seEnabled) return;
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

// 破壊（ダブルタップ消去）：ガラスが割れるような短い「ペキッ」という音。
// 高音のノイズバーストに、砕ける音を思わせる甲高いクリック音を重ねる。
export function playDestroy() {
  noiseBurst({ duration: 0.05, delay: 0, volume: 0.5 });
  tone({ freq: 3200, freqEnd: 4800, duration: 0.05, type: 'square', volume: 0.4 });
  tone({ freq: 4600, duration: 0.03, type: 'triangle', delay: 0.025, volume: 0.3 });
}

// 数字入れかえ：1つ目の数字を選んだときの短い「ピッ」という音。
export function playSwapSelect() {
  tone({ freq: 700, duration: 0.08, type: 'sine', volume: 0.4 });
}

// 数字入れかえ：2つの数字を入れ替えた瞬間の短い「ピポッ」という音。
export function playSwap() {
  tone({ freq: 600, duration: 0.06, type: 'triangle', volume: 0.45 });
  tone({ freq: 900, duration: 0.07, type: 'triangle', delay: 0.05, volume: 0.4 });
}

export function playCountdownTick() {
  tone({ freq: 440, duration: 0.15, type: 'square', volume: 0.5 });
}

export function playCountdownStart() {
  tone({ freq: 880, duration: 0.3, type: 'triangle', volume: 0.6 });
}

// ミリオン・フィーバー開始：上昇アルペジオ+和音+きらめきの豪華なファンファーレ。
export function playFeverStart() {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((freq, i) => {
    tone({ freq, duration: 0.16, type: 'triangle', delay: i * 0.06, volume: 0.5 });
  });
  const chordDelay = notes.length * 0.06 + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    tone({ freq, duration: 0.5, type: 'sawtooth', delay: chordDelay, volume: 0.32 });
  });
  tone({ freq: 1200, freqEnd: 2400, duration: 0.4, type: 'sine', delay: chordDelay, volume: 0.4 });
}

// フィーバー中のラスト10秒カウント音。残り3秒以下は音を強めて終了間際を伝える。
export function playFeverTick(seconds) {
  if (seconds <= 3) {
    tone({ freq: 1300, duration: 0.1, type: 'square', volume: 0.55 });
  } else {
    tone({ freq: 1000, duration: 0.08, type: 'square', volume: 0.4 });
  }
}

// フィーバー中の成功音：通常成功音よりさらに高く華やかに。40成功時は専用の1音列にまとめる。
export function playFeverSuccess(count, isForty) {
  const n = Math.min(count, SCALE.length);
  for (let i = 0; i < n; i++) {
    tone({ freq: SCALE[i] * 3, duration: 0.12, type: 'triangle', delay: i * 0.045, volume: 0.55 });
  }
  const chordDelay = n * 0.045 + 0.05;
  const chordFreqs = isForty
    ? [523.25 * 3, 659.25 * 3, 783.99 * 3, 1046.5 * 3]
    : [523.25 * 3, 659.25 * 3, 783.99 * 3];
  chordFreqs.forEach((freq) => {
    tone({ freq, duration: 0.4, type: 'triangle', delay: chordDelay, volume: 0.4 });
  });
  tone({ freq: 1600, freqEnd: 2600, duration: 0.35, type: 'sine', delay: chordDelay + 0.05, volume: 0.4 });
  if (isForty) {
    tone({ freq: 2000, freqEnd: 3200, duration: 0.3, type: 'sine', delay: chordDelay + 0.15, volume: 0.35 });
  }
}

// シルバー・フィーバー開始：ミリオン・フィーバーより控えめな、金属的な2音のチャイム。
export function playSilverFeverStart() {
  tone({ freq: 1046.5, duration: 0.14, type: 'triangle', volume: 0.45 });
  tone({ freq: 1568, duration: 0.22, type: 'sine', delay: 0.08, volume: 0.4 });
}

// シルバー・フィーバー中の成功音：通常成功音よりやや高く、銀色らしい澄んだ響き。
export function playSilverFeverSuccess(count, isForty) {
  const n = Math.min(count, SCALE.length);
  for (let i = 0; i < n; i++) {
    tone({ freq: SCALE[i] * 2.2, duration: 0.12, type: 'sine', delay: i * 0.045, volume: 0.5 });
  }
  if (isForty) {
    const chordDelay = n * 0.045 + 0.05;
    tone({ freq: 1568, freqEnd: 2093, duration: 0.3, type: 'sine', delay: chordDelay, volume: 0.35 });
  }
}

// --- CPUバトル専用SE ------------------------------------------------------
// プレイヤーと同じ音階を使いながら音量を抑え、プレイヤーの判断を妨げないようにする
// （Phase3実装指示書 12.3章）。1マスごとのなぞり音は省略し、成功・失敗・破壊音のみ。
export function playCpuSuccess(count, isForty) {
  const n = Math.min(count, SCALE.length);
  for (let i = 0; i < n; i++) {
    tone({ freq: SCALE[i] * 1.5, duration: 0.1, type: 'triangle', delay: i * 0.04, volume: 0.22 });
  }
  if (isForty) {
    const chordDelay = n * 0.04 + 0.05;
    tone({ freq: 1046.5, freqEnd: 1568, duration: 0.25, type: 'sine', delay: chordDelay, volume: 0.2 });
  }
}

export function playCpuFail() {
  tone({ freq: 110, freqEnd: 80, duration: 0.15, type: 'sawtooth', volume: 0.2 });
}

export function playCpuDestroy() {
  noiseBurst({ duration: 0.04, delay: 0, volume: 0.22 });
  tone({ freq: 2400, freqEnd: 3600, duration: 0.04, type: 'square', volume: 0.18 });
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

// --- BGM（実音源ファイル） -----------------------------------------------
// 5曲はいずれも長さが微妙に異なるため、曲ごとに開始タイミングをずらして
// カウントダウン〜ゲーム序盤の進行と自然に噛み合うようにする。
// 曲の選択自体は毎回行うが、実際の再生はtriggerBgmStart()で該当タイミングが
// 来たときにだけ開始する。

let bgmAudioEl = null;
let currentTrackId = null;
let firedTriggers = new Set();

function getBgmAudioElement() {
  if (!bgmAudioEl) {
    bgmAudioEl = new Audio();
    bgmAudioEl.preload = 'auto';
    bgmAudioEl.volume = 0.33; // 従来値0.55の60%。効果音の音量は変更しない。
  }
  return bgmAudioEl;
}

// 新しいプレイ開始時に1曲を選ぶ。まだ再生はしない。
// サウンドモードがbgm1〜bgm5のときはその固定曲を、bgmRandomのときはランダムに1曲選ぶ
// （bgmOff/offのときは選んでも再生されない）。
export function chooseRandomBgmTrack(rng = Math.random) {
  const fixedId = FIXED_TRACK_IDS[soundMode];
  const track = fixedId
    ? BGM_TRACKS.find((t) => t.id === fixedId)
    : BGM_TRACKS[Math.min(Math.floor(rng() * BGM_TRACKS.length), BGM_TRACKS.length - 1)];
  currentTrackId = track.id;
  firedTriggers = new Set();

  if (bgmEnabled) {
    const el = getBgmAudioElement();
    el.pause();
    el.currentTime = 0;
    el.src = encodeURI(BGM_BASE_PATH + track.file);
    el.load();
  }
  return currentTrackId;
}

// カウントダウンの各ラベルやゲーム開始からの経過時間に応じて呼ばれる。
// 選ばれている曲の開始タイミング（startTrigger）と一致したときだけ再生を始める。
export function triggerBgmStart(trigger) {
  if (!bgmEnabled || !currentTrackId) return;
  if (firedTriggers.has(trigger)) return;
  const track = BGM_TRACKS.find((t) => t.id === currentTrackId);
  if (!track || track.startTrigger !== trigger) return;

  firedTriggers.add(trigger);
  const el = getBgmAudioElement();
  el.currentTime = 0;
  el.play().catch(() => {
    // 自動再生が拒否された場合も、SEやゲーム進行は継続する。
  });
}

export function stopBgm() {
  if (!bgmAudioEl) return;
  bgmAudioEl.pause();
  bgmAudioEl.currentTime = 0;
}
