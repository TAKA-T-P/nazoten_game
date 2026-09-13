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
  // Phase 2: 30秒 -> 60秒。ラスト10秒はミリオン・フィーバーで得点3倍。
  gameDurationMs: 60_000,
  feverDurationMs: 10_000,
  feverMultiplier: 3,
  refillDelayMs: 1_000,
  fortyMultiplier: 2,
  countdownStepMs: 700,
  // チュートリアルのバージョン。保存値がこれ未満なら再表示する。
  tutorialVersion: 2,
  storageKey: 'nazoten-save-v2',
  legacyStorageKey: 'nazoten-save-v1',
  // 60秒＋フィーバー版に合わせた称号基準（Phase 1比 約2.7倍の暫定値）。
  titles: [
    { min: 0, max: 799, name: 'はじめてのナゾテン！' },
    { min: 800, max: 1799, name: 'ひらめきルーキー' },
    { min: 1800, max: 3199, name: '10の倍数ハンター' },
    { min: 3200, max: 4799, name: 'なぞりの達人' },
    { min: 4800, max: 6499, name: 'ナゾテンマスター' },
    { min: 6500, max: Infinity, name: '超速ナゾテン王' }
  ]
};
