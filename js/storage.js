// ベストスコア・サウンド設定・チュートリアル既読状態・CPUバトル記録の端末保存
//（Phase2実装指示書 12〜13章、Phase3実装指示書 17章）。
// v1（30秒版）・v2（60秒＋フィーバー版）・v3（CPUバトル追加）は競技条件が異なるため、
// 記録を混在させない。localStorageが使えない/壊れている場合も、初期値で継続できるようにする。
import { CONFIG, CPU_LEVEL_ORDER } from './config.js';

const RECORD_KEY = 'scoreAttack60Fever10';
const LEGACY_RECORD_KEY = 'scoreAttack30';
// 'bgmOff'（表示名は「効果音のみ」）→ 'bgmRandom'（BGMをランダムに1曲再生）→
// 'bgm1'〜'bgm5'（固定の1曲を再生）→ 'off'（無音）の8択。◀▶ボタンでこの順に循環する。
const SOUND_MODES = ['bgmOff', 'bgmRandom', 'bgm1', 'bgm2', 'bgm3', 'bgm4', 'bgm5', 'off'];
const DEFAULT_SOUND_MODE = 'bgmOff';
// 旧バージョン（3択）からの読み替え：'bgm'→'bgmRandom'、'seOnly'→'bgmOff'。
const LEGACY_SOUND_MODE_MAP = { bgm: 'bgmRandom', seOnly: 'bgmOff' };
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

// ごちゃまぜバトルCPU戦はスコアバトルCPU戦（cpuBattle）とは別枠でレベル別に記録する。
function createMixedCpuRecord() {
  return {
    playCount: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestPlayerScore: 0,
    bestWinningMargin: 0,
    totalOjamaUses: 0
  };
}

function createMixedCpuRecords() {
  const records = {};
  for (const level of CPU_LEVEL_ORDER) records[level] = createMixedCpuRecord();
  return records;
}

function createTwoPlayerRecord() {
  return {
    playCount: 0,
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    bestP1Score: 0,
    bestP2Score: 0,
    highestCombinedScore: 0
  };
}

function createMixedBattleRecord() {
  return {
    playCount: 0,
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    bestP1Score: 0,
    bestP2Score: 0,
    highestCombinedScore: 0,
    totalOjamaUses: 0
  };
}

// じっくりモード（Phase 6実装指示書 23章）。ステージ別の記録は`stages`に
// idをキーとして保持し、未クリアのステージはキー自体を持たない
// （参照時はcreatePuzzleStageRecord()の初期値を返す）。
function createPuzzleStageRecord() {
  return {
    cleared: false,
    bestStars: 0,
    bestMoves: null,
    clearedWithoutHint: false,
    clearCount: 0
  };
}

function createPuzzleProgress() {
  return {
    tutorialVersion: 0,
    swapTutorialSeen: false,
    lastStageId: 'area1-stage01',
    stages: {}
  };
}

function defaultState() {
  return {
    version: 6,
    soundMode: DEFAULT_SOUND_MODE,
    tutorialVersion: 0,
    cpuBattleTutorialVersion: 0,
    twoPlayerTutorialVersion: 0,
    selectedCpuLevel: DEFAULT_CPU_LEVEL,
    records: {
      [RECORD_KEY]: { bestScore: 0, playCount: 0 },
      cpuBattle: createCpuRecords(),
      mixedCpuBattle: createMixedCpuRecords(),
      twoPlayerBattle: createTwoPlayerRecord(),
      mixedBattle: createMixedBattleRecord()
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: { bestScore: 0 }
    },
    puzzleProgress: createPuzzleProgress()
  };
}

function asNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// 8択のサウンドモード。旧バージョン（3択の文字列、またはさらに古い真偽値の
// soundEnabled）が残っていれば読み替える。
function normalizeSoundMode(mode, legacyBoolean) {
  if (SOUND_MODES.includes(mode)) return mode;
  if (LEGACY_SOUND_MODE_MAP[mode]) return LEGACY_SOUND_MODE_MAP[mode];
  if (typeof legacyBoolean === 'boolean') return legacyBoolean ? 'bgmRandom' : 'off';
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

function sanitizeMixedCpuRecord(raw) {
  const d = createMixedCpuRecord();
  if (!raw || typeof raw !== 'object') return d;
  return {
    playCount: asNumber(raw.playCount, 0),
    wins: asNumber(raw.wins, 0),
    losses: asNumber(raw.losses, 0),
    draws: asNumber(raw.draws, 0),
    bestPlayerScore: asNumber(raw.bestPlayerScore, 0),
    bestWinningMargin: asNumber(raw.bestWinningMargin, 0),
    totalOjamaUses: asNumber(raw.totalOjamaUses, 0)
  };
}

function sanitizeMixedCpuRecords(rawRecords) {
  const records = {};
  for (const level of CPU_LEVEL_ORDER) {
    records[level] = sanitizeMixedCpuRecord(rawRecords && rawRecords[level]);
  }
  return records;
}

function sanitizeTwoPlayerRecord(raw) {
  const d = createTwoPlayerRecord();
  if (!raw || typeof raw !== 'object') return d;
  return {
    playCount: asNumber(raw.playCount, 0),
    p1Wins: asNumber(raw.p1Wins, 0),
    p2Wins: asNumber(raw.p2Wins, 0),
    draws: asNumber(raw.draws, 0),
    bestP1Score: asNumber(raw.bestP1Score, 0),
    bestP2Score: asNumber(raw.bestP2Score, 0),
    highestCombinedScore: asNumber(raw.highestCombinedScore, 0)
  };
}

function sanitizeMixedBattleRecord(raw) {
  const d = createMixedBattleRecord();
  if (!raw || typeof raw !== 'object') return d;
  return {
    playCount: asNumber(raw.playCount, 0),
    p1Wins: asNumber(raw.p1Wins, 0),
    p2Wins: asNumber(raw.p2Wins, 0),
    draws: asNumber(raw.draws, 0),
    bestP1Score: asNumber(raw.bestP1Score, 0),
    bestP2Score: asNumber(raw.bestP2Score, 0),
    highestCombinedScore: asNumber(raw.highestCombinedScore, 0),
    totalOjamaUses: asNumber(raw.totalOjamaUses, 0)
  };
}

function sanitizePuzzleStageRecord(raw) {
  const d = createPuzzleStageRecord();
  if (!raw || typeof raw !== 'object') return d;
  return {
    cleared: Boolean(raw.cleared),
    bestStars: asNumber(raw.bestStars, 0),
    bestMoves: raw.bestMoves == null ? null : asNumber(raw.bestMoves, null),
    clearedWithoutHint: Boolean(raw.clearedWithoutHint),
    clearCount: asNumber(raw.clearCount, 0)
  };
}

// puzzleProgressだけが破損していても、既存のベストスコアや対戦記録には
// 影響させない（他フィールドと独立にsanitizeする、23.4章）。
function sanitizePuzzleProgress(raw) {
  const d = createPuzzleProgress();
  if (!raw || typeof raw !== 'object') return d;
  const stages = {};
  if (raw.stages && typeof raw.stages === 'object') {
    for (const [id, rec] of Object.entries(raw.stages)) {
      stages[id] = sanitizePuzzleStageRecord(rec);
    }
  }
  return {
    tutorialVersion: asNumber(raw.tutorialVersion, 0),
    swapTutorialSeen: Boolean(raw.swapTutorialSeen),
    lastStageId: typeof raw.lastStageId === 'string' ? raw.lastStageId : d.lastStageId,
    stages
  };
}

// 壊れた/型の不正なデータが来ても、既定値を土台に安全な形へ整える。
function sanitize(parsed) {
  const d = defaultState();
  if (!parsed || typeof parsed !== 'object') return d;

  const record = parsed.records && parsed.records[RECORD_KEY];
  const legacyRecord = parsed.legacyRecords && parsed.legacyRecords[LEGACY_RECORD_KEY];

  return {
    version: 6,
    soundMode: normalizeSoundMode(parsed.soundMode, parsed.soundEnabled),
    tutorialVersion: asNumber(parsed.tutorialVersion, d.tutorialVersion),
    cpuBattleTutorialVersion: asNumber(parsed.cpuBattleTutorialVersion, d.cpuBattleTutorialVersion),
    twoPlayerTutorialVersion: asNumber(parsed.twoPlayerTutorialVersion, d.twoPlayerTutorialVersion),
    selectedCpuLevel: normalizeCpuLevel(parsed.selectedCpuLevel),
    records: {
      [RECORD_KEY]: {
        bestScore: asNumber(record && record.bestScore, 0),
        playCount: asNumber(record && record.playCount, 0)
      },
      cpuBattle: sanitizeCpuRecords(parsed.records && parsed.records.cpuBattle),
      mixedCpuBattle: sanitizeMixedCpuRecords(parsed.records && parsed.records.mixedCpuBattle),
      twoPlayerBattle: sanitizeTwoPlayerRecord(parsed.records && parsed.records.twoPlayerBattle),
      mixedBattle: sanitizeMixedBattleRecord(parsed.records && parsed.records.mixedBattle)
    },
    legacyRecords: {
      [LEGACY_RECORD_KEY]: {
        bestScore: asNumber(legacyRecord && legacyRecord.bestScore, 0)
      }
    },
    puzzleProgress: sanitizePuzzleProgress(parsed.puzzleProgress)
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

// v3・v4・v5(旧storageKey)は、そのまま新形状(sanitize)に通せば2人バトル・ごちゃまぜ・
// CPU戦の追加分フィールドが初期値で補われ、そのまま最新版として扱える
// （Phase4実装指示書22.4章、Phase5実装指示書22.4章）。旧キー自体は削除しない。
function migrateFromV5() {
  const parsedV5 = readJson(CONFIG.legacyStorageKeyV5);
  if (!parsedV5) return null;
  return sanitize(parsedV5);
}

function migrateFromV4() {
  const parsedV4 = readJson(CONFIG.legacyStorageKeyV4);
  if (!parsedV4) return null;
  return sanitize(parsedV4);
}

function migrateFromV3() {
  const parsedV3 = readJson(CONFIG.legacyStorageKeyV3);
  if (!parsedV3) return null;
  return sanitize(parsedV3);
}

function load() {
  try {
    const rawV6 = localStorage.getItem(CONFIG.storageKey);
    if (rawV6) {
      return sanitize(JSON.parse(rawV6));
    }
    // v6データがまだない場合のみ、v5（なければv4、v3、v2、v1）からの一度きりの移行を行う。
    const migrated = migrateFromV5() || migrateFromV4() || migrateFromV3() || migrateFromV2() || migrateFromV1();
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

// ◀▶ボタンでSOUND_MODESの順に前後へ循環させる（delta: +1で次へ、-1で前へ）。
export function stepSoundMode(delta) {
  const currentIndex = SOUND_MODES.indexOf(state.soundMode);
  const len = SOUND_MODES.length;
  const next = SOUND_MODES[(currentIndex + delta + len) % len];
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

export function hasSeenTwoPlayerTutorial() {
  return state.twoPlayerTutorialVersion >= CONFIG.twoPlayerTutorialVersion;
}

export function markTwoPlayerTutorialSeen() {
  state.twoPlayerTutorialVersion = CONFIG.twoPlayerTutorialVersion;
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

export function getMixedCpuRecord(level) {
  const key = normalizeCpuLevel(level);
  return { ...state.records.mixedCpuBattle[key] };
}

// ごちゃまぜバトルCPU戦の結果を選択レベルの記録へ反映する。スコアバトルCPU戦の
// 記録（cpuBattle）とは別枠で管理する。途中終了時は呼び出さないこと。
export function submitMixedCpuBattleResult({ level, outcome, playerScore, cpuScore, ojamaUseCount }) {
  const key = normalizeCpuLevel(level);
  const record = state.records.mixedCpuBattle[key];
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
  record.totalOjamaUses += asNumber(ojamaUseCount, 0);
  persist();
  return isNewBest;
}

export function getTwoPlayerRecord() {
  return { ...state.records.twoPlayerBattle };
}

// 2人バトルの結果を通算成績へ反映する。タイムアップまで完了した対戦だけを対象とし、
// 途中でタイトルへ戻った場合は呼び出さないこと（Phase4実装指示書22.3章）。
// 戻り値: { isNewP1Best, isNewP2Best } この対戦でP1・P2それぞれの自己ベストを更新したか。
export function submitTwoPlayerBattleResult({ outcome, p1Score, p2Score }) {
  const record = state.records.twoPlayerBattle;
  record.playCount += 1;
  if (outcome === 'p1win') record.p1Wins += 1;
  else if (outcome === 'p2win') record.p2Wins += 1;
  else record.draws += 1;

  const isNewP1Best = p1Score > record.bestP1Score;
  if (isNewP1Best) record.bestP1Score = p1Score;
  const isNewP2Best = p2Score > record.bestP2Score;
  if (isNewP2Best) record.bestP2Score = p2Score;

  const combined = p1Score + p2Score;
  if (combined > record.highestCombinedScore) record.highestCombinedScore = combined;

  persist();
  return { isNewP1Best, isNewP2Best };
}

export function getMixedBattleRecord() {
  return { ...state.records.mixedBattle };
}

// ごちゃまぜバトルの結果を通算成績へ反映する。タイムアップまで完了した対戦だけを
// 対象とし、途中で「もどる」を押した場合は呼び出さないこと（Phase5実装指示書22.3章）。
// スコアバトルの記録（twoPlayerBattle）とは別枠で管理する。
// 戻り値: { isNewP1Best, isNewP2Best } この対戦でP1・P2それぞれの自己ベストを更新したか。
export function submitMixedBattleResult({ outcome, p1Score, p2Score, ojamaUseCount }) {
  const record = state.records.mixedBattle;
  record.playCount += 1;
  if (outcome === 'p1win') record.p1Wins += 1;
  else if (outcome === 'p2win') record.p2Wins += 1;
  else record.draws += 1;

  const isNewP1Best = p1Score > record.bestP1Score;
  if (isNewP1Best) record.bestP1Score = p1Score;
  const isNewP2Best = p2Score > record.bestP2Score;
  if (isNewP2Best) record.bestP2Score = p2Score;

  const combined = p1Score + p2Score;
  if (combined > record.highestCombinedScore) record.highestCombinedScore = combined;

  record.totalOjamaUses += asNumber(ojamaUseCount, 0);

  persist();
  return { isNewP1Best, isNewP2Best };
}

// --- じっくりモード（Phase 6実装指示書 23章） -------------------------------

export function hasSeenPuzzleTutorial() {
  return state.puzzleProgress.tutorialVersion >= CONFIG.puzzle.tutorialVersion;
}

export function markPuzzleTutorialSeen() {
  state.puzzleProgress.tutorialVersion = CONFIG.puzzle.tutorialVersion;
  persist();
}

export function hasSeenPuzzleSwapTutorial() {
  return state.puzzleProgress.swapTutorialSeen;
}

export function markPuzzleSwapTutorialSeen() {
  state.puzzleProgress.swapTutorialSeen = true;
  persist();
}

export function getPuzzleLastStageId() {
  return state.puzzleProgress.lastStageId;
}

// ステージ開始時に呼ぶ（21.1章・23.2章：「つづきから」の候補にするため）。
export function setPuzzleLastStageId(stageId) {
  state.puzzleProgress.lastStageId = stageId;
  persist();
}

export function getPuzzleStageRecord(stageId) {
  return { ...(state.puzzleProgress.stages[stageId] || createPuzzleStageRecord()) };
}

export function getAllPuzzleStageRecords() {
  return { ...state.puzzleProgress.stages };
}

// ステージクリア確定時に呼ぶ。途中退出では呼び出さないこと（23.2章）。
// 戻り値：このクリアで過去のベストスター／ベスト手数を更新したか。
export function submitPuzzleStageClear({ stageId, stars, movesUsed, hintUsed }) {
  const previous = state.puzzleProgress.stages[stageId] || createPuzzleStageRecord();
  const isNewBestStars = stars > previous.bestStars;
  const isNewBestMoves = previous.bestMoves == null || movesUsed < previous.bestMoves;

  state.puzzleProgress.stages[stageId] = {
    cleared: true,
    bestStars: Math.max(previous.bestStars ?? 0, stars),
    bestMoves: previous.bestMoves == null ? movesUsed : Math.min(previous.bestMoves, movesUsed),
    clearedWithoutHint: Boolean(previous.clearedWithoutHint) || !hintUsed,
    clearCount: (previous.clearCount ?? 0) + 1
  };
  persist();
  return { isNewBestStars, isNewBestMoves };
}
