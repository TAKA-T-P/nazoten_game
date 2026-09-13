// 成功判定・得点計算・記録更新（仕様書 6章、Phase2実装指示書 11章）。
import { CONFIG } from './config.js';

export function calcSum(values) {
  return values.reduce((a, b) => a + b, 0);
}

export function isValidSum(sum) {
  return CONFIG.validSums.includes(sum);
}

// 得点 = 合計 × マス数 × フォーティ倍率（合計40のみ2倍） × フィーバー倍率（フィーバー中のみ3倍）。
// 倍率は加算ではなく乗算する。
export function calculateScore({ sum, pathLength, isFever }) {
  const fortyMultiplier = sum === 40 ? CONFIG.fortyMultiplier : 1;
  const feverMultiplier = isFever ? CONFIG.feverMultiplier : 1;
  const points = sum * pathLength * fortyMultiplier * feverMultiplier;

  return {
    points,
    sum,
    pathLength,
    isForty: sum === 40,
    isFever: Boolean(isFever),
    fortyMultiplier,
    feverMultiplier,
    totalMultiplier: fortyMultiplier * feverMultiplier
  };
}

export function createStats() {
  return {
    successCount: 0,
    failureCount: 0,
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

// 成功率(%)。試行回数が0の場合はnullを返す（表示側で「—」等にする）。
export function calcSuccessRate(stats) {
  const attempts = stats.successCount + stats.failureCount;
  if (attempts === 0) return null;
  return (stats.successCount / attempts) * 100;
}

export function getTitleForScore(score) {
  const found = CONFIG.titles.find((t) => score >= t.min && score <= t.max);
  return found ? found.name : CONFIG.titles[0].name;
}
