// ベストスコア・サウンド設定・チュートリアル既読状態の端末保存（Phase2実装指示書 12〜13章）。
// v1（30秒版）とv2（60秒＋フィーバー版）は競技条件が異なるため、記録を混在させない。
// localStorageが使えない/壊れている場合も、初期値で継続できるようにする。
import { CONFIG } from './config.js';

const RECORD_KEY = 'scoreAttack60Fever10';
const LEGACY_RECORD_KEY = 'scoreAttack30';

function defaultState() {
  return {
    version: 2,
    soundEnabled: true,
    tutorialVersion: 0,
    records: {
      [RECORD_KEY]: { bestScore: 0, playCount: 0 }
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: { bestScore: 0 }
    }
  };
}

function asNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// 壊れた/型の不正なデータが来ても、既定値を土台に安全な形へ整える。
function sanitize(parsed) {
  const d = defaultState();
  if (!parsed || typeof parsed !== 'object') return d;

  const record = parsed.records && parsed.records[RECORD_KEY];
  const legacyRecord = parsed.legacyRecords && parsed.legacyRecords[LEGACY_RECORD_KEY];

  return {
    version: 2,
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : d.soundEnabled,
    tutorialVersion: asNumber(parsed.tutorialVersion, d.tutorialVersion),
    records: {
      [RECORD_KEY]: {
        bestScore: asNumber(record && record.bestScore, 0),
        playCount: asNumber(record && record.playCount, 0)
      }
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: {
        bestScore: asNumber(legacyRecord && legacyRecord.bestScore, 0)
      }
    }
  };
}

function readLegacyV1() {
  try {
    const raw = localStorage.getItem(CONFIG.legacyStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      bestScore: asNumber(parsed.bestScore, 0),
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      tutorialSeen: typeof parsed.tutorialSeen === 'boolean' ? parsed.tutorialSeen : false
    };
  } catch (e) {
    return null;
  }
}

// v1の30秒版ベストスコアはlegacyRecordsへ退避し、v1キー自体は削除しない。
// 60秒版ベストスコアは0から開始する（仕様書12.1・12.3章）。
function migrateFromLegacy() {
  const legacy = readLegacyV1();
  const state = defaultState();
  if (legacy) {
    state.soundEnabled = legacy.soundEnabled;
    state.tutorialVersion = legacy.tutorialSeen ? 1 : 0;
    state.legacyRecords[LEGACY_RECORD_KEY].bestScore = legacy.bestScore;
  }
  return state;
}

function persistState(s) {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}

function load() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      return sanitize(JSON.parse(raw));
    }
    // v2データがまだない場合のみ、v1からの一度きりの移行を行う。
    const migrated = migrateFromLegacy();
    persistState(migrated);
    return migrated;
  } catch (e) {
    return defaultState();
  }
}

let state = load();

function persist() {
  persistState(state);
}

export function getBestScore() {
  return state.records[RECORD_KEY].bestScore;
}

export function getLegacyBestScore() {
  return state.legacyRecords[LEGACY_RECORD_KEY].bestScore;
}

export function getPlayCount() {
  return state.records[RECORD_KEY].playCount;
}

export function isSoundEnabled() {
  return state.soundEnabled;
}

export function setSoundEnabled(value) {
  state.soundEnabled = Boolean(value);
  persist();
}

// 保存済みチュートリアルバージョンが現行版以上なら既読とみなす。
export function hasSeenCurrentTutorial() {
  return state.tutorialVersion >= CONFIG.tutorialVersion;
}

export function markTutorialSeen() {
  state.tutorialVersion = CONFIG.tutorialVersion;
  persist();
}

// スコアを提出する。60秒＋フィーバー版の自己ベストを更新した場合はtrueを返す。
// 30秒版の記録とは独立して判定する。
export function submitScore(score) {
  const record = state.records[RECORD_KEY];
  record.playCount += 1;
  const isNewBest = score > record.bestScore;
  if (isNewBest) record.bestScore = score;
  persist();
  return isNewBest;
}
