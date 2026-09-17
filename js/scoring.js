// 成功判定・得点計算・記録更新（仕様書 6章、Phase2実装指示書 11章）。
import { CONFIG } from './config.js';

export function calcSum(values) {
  return values.reduce((a, b) => a + b, 0);
}

export function isValidSum(sum) {
  return CONFIG.validSums.includes(sum);
}

// 得点 = 合計 × マス数 × 倍率 + フォーティボーナス。
// フォーティボーナス（合計40のときだけ加算する定額100点）には倍率がかからない。
// 倍率（multiplier）はミリオン・フィーバー中は3、シルバー・フィーバー中は2、
// どちらでもなければ1を呼び出し側で決めて渡す。
// isFeverはミリオン・フィーバー中かどうかのフラグで、記録の内訳集計にのみ使う。
export function calculateScore({ sum, pathLength, multiplier = 1, isFever = false }) {
  const isForty = sum === 40;
  const fortyBonus = isForty ? CONFIG.fortyBonus : 0;
  const points = sum * pathLength * multiplier + fortyBonus;

  return {
    points,
    sum,
    pathLength,
    isForty,
    isFever: Boolean(isFever),
    multiplier,
    fortyBonus
  };
}

// シルバー・フィーバー発動条件：ちょうどsilverFeverPathLengthマスで合計が
// silverFeverSumになる成功（例：5マスで合計10）。ミリオン・フィーバー中は
// 発動しない（呼び出し側でisMillionFeverを渡して判定する）。
export function isSilverFeverTrigger(pathLength, sum, isMillionFever) {
  if (isMillionFever) return false;
  return pathLength === CONFIG.silverFeverPathLength && sum === CONFIG.silverFeverSum;
}

export function createStats() {
  return {
    successCount: 0,
    failureCount: 0,
    destroyCount: 0,
    swapCount: 0,
    silverFeverCount: 0,
    sumCounts: { 10: 0, 20: 0, 30: 0, 40: 0 },
    clearedCellCount: 0,
    highestNormalScore: 0,
    normalScore: 0,
    feverScore: 0,
    feverSuccessCount: 0,
    highestFeverScore: 0
  };
}

// 成功確定時にresult（calculateScoreの戻り値）から記録を更新する。
// 最高得点は通常タイムとフィーバータイムを別々に記録する（結果画面で内訳表示するため）。
export function applySuccess(stats, result) {
  stats.successCount += 1;
  stats.sumCounts[result.sum] += 1;
  stats.clearedCellCount += result.pathLength;

  if (result.isFever) {
    stats.feverScore += result.points;
    stats.feverSuccessCount += 1;
    if (result.points > stats.highestFeverScore) stats.highestFeverScore = result.points;
  } else {
    stats.normalScore += result.points;
    if (result.points > stats.highestNormalScore) stats.highestNormalScore = result.points;
  }
}

// 失敗判定時は失敗回数だけを増やす。1マス選択・pointercancel・タイムアップによる
// 選択解除は失敗に含めないため、呼び出し側で判定してからこの関数を呼ぶこと。
export function recordFailure(stats) {
  stats.failureCount += 1;
}

// ダブルタップ破壊は得点にも成功・失敗回数にも含めないため、専用の回数として数える。
export function recordDestroy(stats) {
  stats.destroyCount += 1;
}

// 数字入れかえの成立回数。結果画面では破壊回数と合算して「入れ替え・破壊回数」として表示する。
export function recordSwap(stats) {
  stats.swapCount += 1;
}

// シルバー・フィーバーの発動（突入）回数。
export function recordSilverFeverTrigger(stats) {
  stats.silverFeverCount += 1;
}

// 成功率(%)。試行回数が0の場合はnullを返す（表示側で「—」等にする）。
export function calcSuccessRate(stats) {
  const attempts = stats.successCount + stats.failureCount;
  if (attempts === 0) return null;
  return (stats.successCount / attempts) * 100;
}

// LV = floor(sqrt(score / 10))。下限は1（上限なし。LV.21以降は超速ナゾテン王+Nとして続く）。
export function getTitleLevel(score) {
  const raw = Math.floor(Math.sqrt(Math.max(score, 0) / 10));
  return Math.max(raw, 1);
}

// LV.1〜LV.20はCONFIG.titleLevelsの固有称号、LV.21以降は
// 「超速ナゾテン王+N」（N = 称号レベル - 20）として上限なく続く。
export function getTitleNameForScore(score) {
  const level = getTitleLevel(score);
  const maxNamedLevel = CONFIG.titleLevels.length;
  return level <= maxNamedLevel
    ? CONFIG.titleLevels[level - 1]
    : `${CONFIG.titleLevels[maxNamedLevel - 1]}+${level - maxNamedLevel}`;
}

export function getTitleForScore(score) {
  return `LV.${getTitleLevel(score)}　${getTitleNameForScore(score)}`;
}
