// ベストスコア・サウンド設定・チュートリアル既読フラグの端末保存。
// localStorageが使えない/壊れている場合も、初期値で継続できるようにする。
import { CONFIG } from './config.js';

const DEFAULTS = {
  version: 1,
  bestScore: 0,
  soundEnabled: true,
  tutorialSeen: false
};

function readRaw() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS };
    return {
      version: 1,
      bestScore: Number.isFinite(parsed.bestScore) ? parsed.bestScore : DEFAULTS.bestScore,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULTS.soundEnabled,
      tutorialSeen: typeof parsed.tutorialSeen === 'boolean' ? parsed.tutorialSeen : DEFAULTS.tutorialSeen
    };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

let state = readRaw();

function persist() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function getBestScore() {
  return state.bestScore;
}

export function isSoundEnabled() {
  return state.soundEnabled;
}

export function hasTutorialSeen() {
  return state.tutorialSeen;
}

export function setSoundEnabled(value) {
  state.soundEnabled = Boolean(value);
  persist();
}

export function setTutorialSeen(value) {
  state.tutorialSeen = Boolean(value);
  persist();
}

// スコアを提出する。自己ベストを更新した場合はtrueを返す。
export function submitScore(score) {
  const isNewBest = score > state.bestScore;
  if (isNewBest) {
    state.bestScore = score;
    persist();
  }
  return isNewBest;
}
