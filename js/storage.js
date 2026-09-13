// ベストスコア・サウンド設定・チュートリアル既読状態・CPUバトル記録の端末保存
//（Phase2実装指示書 12〜13章、Phase3実装指示書 17章）。
// v1（30秒版）・v2（60秒＋フィーバー版）・v3（CPUバトル追加）は競技条件が異なるため、
// 記録を混在させない。localStorageが使えない/壊れている場合も、初期値で継続できるようにする。
import { CONFIG, CPU_LEVEL_ORDER } from './config.js';

const RECORD_KEY = 'scoreAttack60Fever10';
const LEGACY_RECORD_KEY = 'scoreAttack30';
const SOUND_MODES = ['bgm', 'seOnly', 'off'];
const DEFAULT_SOUND_MODE = 'bgm';
const DEFAULT_CPU_LEVEL = '1';

function createCpuRecord() {
  return {
    playCount: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestPlayerScore: 0,
    bestWinningMargin: 0
  };
}

function createCpuRecords() {
  const records = {};
  for (const level of CPU_LEVEL_ORDER) records[level] = createCpuRecord();
  return records;
}

function defaultState() {
  return {
    version: 3,
    soundMode: DEFAULT_SOUND_MODE,
    tutorialVersion: 0,
    cpuBattleTutorialVersion: 0,
    selectedCpuLevel: DEFAULT_CPU_LEVEL,
    records: {
      [RECORD_KEY]: { bestScore: 0, playCount: 0 },
      cpuBattle: createCpuRecords()
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: { bestScore: 0 }
    }
  };
}

function asNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// 'bgm' | 'seOnly' | 'off' の三択。旧形式（真偽値のsoundEnabled）が残っていれば
// bgm/offへ読み替える。
function normalizeSoundMode(mode, legacyBoolean) {
  if (SOUND_MODES.includes(mode)) return mode;
  if (typeof legacyBoolean === 'boolean') return legacyBoolean ? 'bgm' : 'off';
  return DEFAULT_SOUND_MODE;
}

function normalizeCpuLevel(level) {
  return CPU_LEVEL_ORDER.includes(level) ? level : DEFAULT_CPU_LEVEL;
}

function sanitizeCpuRecord(raw) {
  const d = createCpuRecord();
  if (!raw || typeof raw !== 'object') return d;
  return {
    playCount: asNumber(raw.playCount, 0),
    wins: asNumber(raw.wins, 0),
    losses: asNumber(raw.losses, 0),
    draws: asNumber(raw.draws, 0),
    bestPlayerScore: asNumber(raw.bestPlayerScore, 0),
    bestWinningMargin: asNumber(raw.bestWinningMargin, 0)
  };
}

function sanitizeCpuRecords(rawRecords) {
  const records = {};
  for (const level of CPU_LEVEL_ORDER) {
    records[level] = sanitizeCpuRecord(rawRecords && rawRecords[level]);
  }
  return records;
}

// 壊れた/型の不正なデータが来ても、既定値を土台に安全な形へ整える。
function sanitize(parsed) {
  const d = defaultState();
  if (!parsed || typeof parsed !== 'object') return d;

  const record = parsed.records && parsed.records[RECORD_KEY];
  const legacyRecord = parsed.legacyRecords && parsed.legacyRecords[LEGACY_RECORD_KEY];

  return {
    version: 3,
    soundMode: normalizeSoundMode(parsed.soundMode, parsed.soundEnabled),
    tutorialVersion: asNumber(parsed.tutorialVersion, d.tutorialVersion),
    cpuBattleTutorialVersion: asNumber(parsed.cpuBattleTutorialVersion, d.cpuBattleTutorialVersion),
    selectedCpuLevel: normalizeCpuLevel(parsed.selectedCpuLevel),
    records: {
      [RECORD_KEY]: {
        bestScore: asNumber(record && record.bestScore, 0),
        playCount: asNumber(record && record.playCount, 0)
      },
      cpuBattle: sanitizeCpuRecords(parsed.records && parsed.records.cpuBattle)
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: {
        bestScore: asNumber(legacyRecord && legacyRecord.bestScore, 0)
      }
    }
  };
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function readLegacyV1() {
  const parsed = readJson(CONFIG.legacyStorageKeyV1);
  if (!parsed) return null;
  return {
    bestScore: asNumber(parsed.bestScore, 0),
    soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    tutorialSeen: typeof parsed.tutorialSeen === 'boolean' ? parsed.tutorialSeen : false
  };
}

// v1の30秒版ベストスコアはlegacyRecordsへ退避し、v1キー自体は削除しない。
// 60秒版・CPUバトルの記録は0/初期値から開始する（仕様書12.1・12.3章、Phase3 17.4章）。
function migrateFromV1() {
  const legacy = readLegacyV1();
  const state = defaultState();
  if (legacy) {
    state.soundMode = legacy.soundEnabled ? 'bgm' : 'off';
    state.tutorialVersion = legacy.tutorialSeen ? 1 : 0;
    state.legacyRecords[LEGACY_RECORD_KEY].bestScore = legacy.bestScore;
  }
  return state;
}

// v2の設定・60秒版記録・旧30秒記録をすべて引き継ぎ、CPUバトル関連のフィールドだけ
// 初期値で追加する（Phase3実装指示書 17.4章）。v2キー自体は削除しない。
function migrateFromV2() {
  const parsedV2 = readJson(CONFIG.legacyStorageKeyV2);
  if (!parsedV2) return null;
  const v2Record = parsedV2.records && parsedV2.records[RECORD_KEY];
  const v2Legacy = parsedV2.legacyRecords && parsedV2.legacyRecords[LEGACY_RECORD_KEY];

  const state = defaultState();
  state.soundMode = normalizeSoundMode(parsedV2.soundMode, parsedV2.soundEnabled);
  state.tutorialVersion = asNumber(parsedV2.tutorialVersion, 0);
  state.records[RECORD_KEY] = {
    bestScore: asNumber(v2Record && v2Record.bestScore, 0),
    playCount: asNumber(v2Record && v2Record.playCount, 0)
  };
  state.legacyRecords[LEGACY_RECORD_KEY].bestScore = asNumber(v2Legacy && v2Legacy.bestScore, 0);
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
    const rawV3 = localStorage.getItem(CONFIG.storageKey);
    if (rawV3) {
      return sanitize(JSON.parse(rawV3));
    }
    // v3データがまだない場合のみ、v2（なければv1）からの一度きりの移行を行う。
    const migrated = migrateFromV2() || migrateFromV1();
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

export function getSoundMode() {
  return state.soundMode;
}

export function setSoundMode(mode) {
  state.soundMode = normalizeSoundMode(mode);
  persist();
}

// 'BGMあり' -> '効果音のみ' -> '音なし' -> 'BGMあり' … の順で切り替える。
export function cycleSoundMode() {
  const currentIndex = SOUND_MODES.indexOf(state.soundMode);
  const next = SOUND_MODES[(currentIndex + 1) % SOUND_MODES.length];
  setSoundMode(next);
  return next;
}

// 保存済みチュートリアルバージョンが現行版以上なら既読とみなす。
export function hasSeenCurrentTutorial() {
  return state.tutorialVersion >= CONFIG.tutorialVersion;
}

export function markTutorialSeen() {
  state.tutorialVersion = CONFIG.tutorialVersion;
  persist();
}

export function hasSeenCpuBattleTutorial() {
  return state.cpuBattleTutorialVersion >= CONFIG.cpuBattleTutorialVersion;
}

export function markCpuBattleTutorialSeen() {
  state.cpuBattleTutorialVersion = CONFIG.cpuBattleTutorialVersion;
  persist();
}

export function getSelectedCpuLevel() {
  return state.selectedCpuLevel;
}

export function setSelectedCpuLevel(level) {
  state.selectedCpuLevel = normalizeCpuLevel(level);
  persist();
}

export function getCpuRecord(level) {
  const key = normalizeCpuLevel(level);
  return { ...state.records.cpuBattle[key] };
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

// CPUバトルの結果を選択レベルの記録へ反映する。途中終了（タイトルへ戻る等）では
// 呼び出さないこと（仕様書17.3章）。選択中レベル以外の記録は変更しない。
// 戻り値: この対戦でプレイヤー側の自己ベストを更新したらtrue。
export function submitCpuBattleResult({ level, outcome, playerScore, cpuScore }) {
  const key = normalizeCpuLevel(level);
  const record = state.records.cpuBattle[key];
  record.playCount += 1;
  if (outcome === 'win') {
    record.wins += 1;
    const margin = playerScore - cpuScore;
    if (margin > record.bestWinningMargin) record.bestWinningMargin = margin;
  } else if (outcome === 'lose') {
    record.losses += 1;
  } else {
    record.draws += 1;
  }
  const isNewBest = playerScore > record.bestPlayerScore;
  if (isNewBest) record.bestPlayerScore = playerScore;
  persist();
  return isNewBest;
}
