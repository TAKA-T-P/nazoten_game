// 成功判定・得点計算・記録更新（仕様書 6章）。
import { CONFIG } from './config.js';

export function calcSum(values) {
  return values.reduce((a, b) => a + b, 0);
}

export function isValidSum(sum) {
  return CONFIG.validSums.includes(sum);
}

// 基本得点 = 合計 × マス数。合計40のみ2倍（フォーティボーナス）。
export function calcPoints(sum, count) {
  const multiplier = sum === 40 ? CONFIG.fortyMultiplier : 1;
  return sum * count * multiplier;
}

export function createStats() {
  return {
    successCount: 0,
    sumCounts: { 10: 0, 20: 0, 30: 0, 40: 0 },
    clearedCellCount: 0,
    highestSingleScore: 0
  };
}

export function applySuccess(stats, sum, count, points) {
  stats.successCount += 1;
  stats.sumCounts[sum] += 1;
  stats.clearedCellCount += count;
  if (points > stats.highestSingleScore) stats.highestSingleScore = points;
}

export function getTitleForScore(score) {
  const found = CONFIG.titles.find((t) => score >= t.min && score <= t.max);
  return found ? found.name : CONFIG.titles[0].name;
}
