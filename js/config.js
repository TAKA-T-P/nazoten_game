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

// BGMの配置場所。ファイル名は日本語を含むため、参照時はencodeURI()で組み立てる。
export const BGM_BASE_PATH = 'assets/bgm/';

// ゲーム開始のたびにこの中から1曲をランダムに選ぶ。各曲は長さが微妙に異なるため、
// 曲ごとに再生開始タイミング（startTrigger）を変えて、曲の盛り上がりとゲーム進行を
// 合わせる。startTriggerの値はgame.jsが発火するタイミング名と対応させる。
//   countdown3 / countdown2 / countdown1 / start … カウントダウンの「3」「2」「1」「START!」と同時
//   delay3s                                    … ゲーム開始（START!）から3秒後（残り57秒）
export const BGM_TRACKS = [
  { id: 'bgm01', file: 'BGM01_焦りは禁物.mp3', startTrigger: 'countdown3' },
  { id: 'bgm02', file: 'BGM02_てんやわんやなお嬢様.mp3', startTrigger: 'countdown2' },
  { id: 'bgm03', file: 'BGM03_和風ロックBGM.mp3', startTrigger: 'countdown1' },
  { id: 'bgm04', file: 'BGM04_ColdHeart.mp3', startTrigger: 'start' },
  { id: 'bgm05', file: 'BGM05_達成！.mp3', startTrigger: 'delay3s' }
];

export const BGM_DELAY_TRIGGER_MS = 3_000;
