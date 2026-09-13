// ゲーム全体の設定値。数値はここで一元管理する。
export const CONFIG = {
  boardRows: 5,
  boardCols: 5,
  numberMin: 1,
  numberMax: 9,
  maxSameNumber: 5,
  minPathLength: 2,
  maxPathLength: 5,
  validSums: [10, 20, 30, 40],
  gameDurationMs: 30_000,
  refillDelayMs: 1_000,
  fortyMultiplier: 2,
  lowTimeThresholdSec: 5,
  storageKey: 'nazoten-save-v1',
  countdownStepMs: 700,
  titles: [
    { min: 0, max: 299, name: 'はじめてのナゾテン！' },
    { min: 300, max: 699, name: 'ひらめきルーキー' },
    { min: 700, max: 1199, name: '10の倍数ハンター' },
    { min: 1200, max: 1799, name: 'なぞりの達人' },
    { min: 1800, max: 2499, name: 'ナゾテンマスター' },
    { min: 2500, max: Infinity, name: '超速ナゾテン王' }
  ]
};
