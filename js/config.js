// ゲーム全体の設定値。数値はここで一元管理する。
export const CONFIG = {
  boardRows: 4,
  boardCols: 4,
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
  // 得点式: 合計×マス数×倍率 + フォーティボーナス（合計40のときだけ加算、倍率の影響を受けない）。
  fortyBonus: 100,
  // シルバー・フィーバー：5マスで合計10を作ると発動。10秒間、盤面が銀色になり得点2倍。
  // ミリオン・フィーバー中は発動しない。両方の条件を満たす場合はミリオン・フィーバーを優先する。
  silverFeverDurationMs: 10_000,
  silverFeverMultiplier: 2,
  silverFeverPathLength: 5,
  silverFeverSum: 10,
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
  // 2人バトル専用チュートリアルのバージョン（Phase4実装指示書23章）。
  twoPlayerTutorialVersion: 1,
  storageKey: 'nazoten-save-v5',
  legacyStorageKeyV4: 'nazoten-save-v4',
  legacyStorageKeyV3: 'nazoten-save-v3',
  legacyStorageKeyV2: 'nazoten-save-v2',
  legacyStorageKeyV1: 'nazoten-save-v1',
  // バトルゲージの計算に使う点差の基準値（Phase3実装指示書 9.3章）。
  gaugeFullLead: 1500,
  // オジャマ（Phase5実装指示書16〜19章）。残り40秒・20秒の2回、劣勢側に
  // 5秒間だけボタンを表示する。押すと相手側の表示だけに5秒間の視覚効果を出す。
  ojama: {
    defaultEnabled: true,
    checkpointsMs: [40_000, 20_000],
    buttonDurationMs: 5_000,
    effectDurationMs: 5_000,
    types: ['turn', 'small', 'hidden', 'meteor', 'formulaHide'],
    smallScaleMin: 0.35,
    smallScaleMax: 0.75,
    // 受けた側の残り時間表示の下に5秒間出す「オジャマ「〇〇」」表示用のラベル。
    typeLabels: {
      turn: 'ターン',
      small: 'スモール',
      hidden: 'スマイル',
      meteor: 'メテオ',
      formulaHide: 'ハイド'
    }
  },
  // 称号はLV.1〜LV.20が固有の名前を持つ。レベルはスコアから
  // floor(sqrt(score / 10))（下限1、上限なし）で決まる。
  // 配列の添字0がLV.1、添字19がLV.20に対応する。
  // LV.21以降は上限なく続き、「超速ナゾテン王+N」（N = レベル - 20）と表示する
  // （例：6250点でLV.25「超速ナゾテン王+5」）。
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

// 強さを1段階ずつ弱くするため、旧レベルNのパラメータを新レベルN+1にずらしている
// （旧レベル1→新レベル2、旧レベル2→新レベル3、…、旧レベル5→新MAX）。
// 新レベル1は繰り上げ元がないため、旧レベル1よりさらに弱い専用の数値を設定した。
// ラベル・ニックネーム・説明文は各枠の立ち位置（初心者向け〜最強）を表すため据え置き。
export const CPU_LEVELS = {
  1: {
    label: '強さ1',
    name: 'のんびり',
    description: 'のんびりプレイする最弱CPU',
    thinkMinMs: 3000,
    thinkMaxMs: 4400,
    maxPathLength: 3,
    bestMoveRate: 0.10,
    mistakeRate: 0.15,
    traceStepMs: 360,
    noMoveDestroyMs: 3500
  },
  2: {
    label: '強さ2',
    name: 'やさしい',
    description: '少しずつ得点してくる相手',
    thinkMinMs: 2700,
    thinkMaxMs: 4000,
    maxPathLength: 4,
    bestMoveRate: 0.18,
    mistakeRate: 0.13,
    traceStepMs: 340,
    noMoveDestroyMs: 3250
  },
  3: {
    label: '強さ3',
    name: 'ふつう',
    description: 'バランスの取れた標準レベル',
    thinkMinMs: 2400,
    thinkMaxMs: 3600,
    maxPathLength: 4,
    bestMoveRate: 0.25,
    mistakeRate: 0.10,
    traceStepMs: 320,
    noMoveDestroyMs: 3000
  },
  4: {
    label: '強さ4',
    name: 'つよい',
    description: 'わりと高得点の組み合わせを探す',
    thinkMinMs: 1800,
    thinkMaxMs: 2800,
    maxPathLength: 5,
    bestMoveRate: 0.50,
    mistakeRate: 0.06,
    traceStepMs: 280,
    noMoveDestroyMs: 2500
  },
  5: {
    label: '強さ5',
    name: 'めちゃつよ',
    description: 'かなり速いスピードでパネルを消す',
    thinkMinMs: 1300,
    thinkMaxMs: 2000,
    maxPathLength: 5,
    bestMoveRate: 0.70,
    mistakeRate: 0.03,
    traceStepMs: 240,
    noMoveDestroyMs: 2000
  },
  MAX: {
    label: 'MAX',
    name: '超速',
    description: '最高得点を迷わず狙う最強CPU',
    thinkMinMs: 900,
    thinkMaxMs: 1500,
    maxPathLength: 5,
    bestMoveRate: 0.90,
    mistakeRate: 0.01,
    traceStepMs: 180,
    noMoveDestroyMs: 1600
  }
};
