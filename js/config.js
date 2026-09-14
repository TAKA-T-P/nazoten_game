// ゲーム全体の設定値。数値はここで一元管理する。
export const CONFIG = {
  boardRows: 4,
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
  // 「TIME UP!」表示から結果画面へ遷移するまでの待ち時間。
  resultTransitionDelayMs: 2_000,
  // 同じマスをこの時間以内に連続タップすると「破壊」（得点なしで消去）になる。
  doubleTapThresholdMs: 350,
  // 1マスをこの時間以上押し続けると長押しとみなし、入れかえ選択を解除する。
  longPressThresholdMs: 500,
  // チュートリアルのバージョン。保存値がこれ未満なら再表示する。
  tutorialVersion: 2,
  // CPUバトル専用チュートリアルのバージョン。
  cpuBattleTutorialVersion: 1,
  storageKey: 'nazoten-save-v3',
  legacyStorageKeyV2: 'nazoten-save-v2',
  legacyStorageKeyV1: 'nazoten-save-v1',
  // バトルゲージの計算に使う点差の基準値（Phase3実装指示書 9.3章）。
  gaugeFullLead: 1500,
  // 称号はLV.1〜LV.20の20段階。レベルはスコアから
  // floor(sqrt(score / 10))（1〜20にクランプ、4000点以上でLV.20）で決まる。
  // 配列の添字0がLV.1、添字19がLV.20に対応する。
  titleLevels: [
    'はじめてのナゾテン！',
    'なぞりのたまご',
    'たし算みならい',
    '10づくりチャレンジャー',
    'ひらめきルーキー',
    'なぞりファイター',
    'たし算ハンター',
    'ひらめきエース',
    '10の倍数ハンター',
    'なぞりテクニシャン',
    'フォーティハンター',
    '10の倍数エース',
    'なぞりの達人',
    'ひらめき名人',
    'フォーティマスター',
    '超速ナゾリスト',
    'ナゾテンマスター',
    'ナゾテンチャンピオン',
    '伝説のナゾリスト',
    '超速ナゾテン王'
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

// CPUバトルの強さ別パラメータ（Phase3実装指示書 11章）。実装後のテストプレイで調整する仮値。
export const CPU_LEVEL_ORDER = ['1', '2', '3', '4', '5', 'MAX'];

export const CPU_LEVELS = {
  1: {
    label: '強さ1',
    name: 'ゆっくり',
    description: 'はじめてのCPUバトルにおすすめ',
    thinkMinMs: 1500,
    thinkMaxMs: 2200,
    maxPathLength: 3,
    bestMoveRate: 0.10,
    mistakeRate: 0.15,
    traceStepMs: 180,
    noMoveDestroyMs: 3500
  },
  2: {
    label: '強さ2',
    name: 'やさしい',
    description: '少しずつ得点してくる相手',
    thinkMinMs: 1200,
    thinkMaxMs: 1800,
    maxPathLength: 4,
    bestMoveRate: 0.25,
    mistakeRate: 0.10,
    traceStepMs: 160,
    noMoveDestroyMs: 3000
  },
  3: {
    label: '強さ3',
    name: 'ふつう',
    description: 'バランスの取れた標準レベル',
    thinkMinMs: 900,
    thinkMaxMs: 1400,
    maxPathLength: 5,
    bestMoveRate: 0.50,
    mistakeRate: 0.06,
    traceStepMs: 140,
    noMoveDestroyMs: 2500
  },
  4: {
    label: '強さ4',
    name: 'つよい',
    description: '高得点の組み合わせをよく見つける',
    thinkMinMs: 650,
    thinkMaxMs: 1000,
    maxPathLength: 5,
    bestMoveRate: 0.70,
    mistakeRate: 0.03,
    traceStepMs: 120,
    noMoveDestroyMs: 2000
  },
  5: {
    label: '強さ5',
    name: 'すごくつよい',
    description: '素早く正確な上級者向け',
    thinkMinMs: 450,
    thinkMaxMs: 750,
    maxPathLength: 5,
    bestMoveRate: 0.90,
    mistakeRate: 0.01,
    traceStepMs: 90,
    noMoveDestroyMs: 1600
  },
  MAX: {
    label: 'MAX',
    name: '超速',
    description: '最高得点を迷わず狙う最強CPU',
    thinkMinMs: 250,
    thinkMaxMs: 450,
    maxPathLength: 5,
    bestMoveRate: 1,
    mistakeRate: 0,
    traceStepMs: 70,
    noMoveDestroyMs: 1200
  }
};
