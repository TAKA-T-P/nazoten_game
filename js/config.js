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
  storageKey: 'nazoten-save-v7',
  legacyStorageKeyV6: 'nazoten-save-v6',
  legacyStorageKeyV5: 'nazoten-save-v5',
  legacyStorageKeyV4: 'nazoten-save-v4',
  legacyStorageKeyV3: 'nazoten-save-v3',
  legacyStorageKeyV2: 'nazoten-save-v2',
  legacyStorageKeyV1: 'nazoten-save-v1',
  // バトルゲージの計算に使う点差の基準値（Phase3実装指示書 9.3章）。
  gaugeFullLead: 1500,
  // オジャマ：経過20秒・40秒（＝残り40秒・20秒）の2回、自動的に発動する。
  // ボタン操作は無く、その時点で勝っている側が自動的に7秒間妨害される。
  ojama: {
    defaultEnabled: true,
    checkpointsMs: [40_000, 20_000],
    effectDurationMs: 7_000,
    types: ['turn', 'small', 'hidden', 'meteor', 'formulaHide'],
    smallScaleMin: 0.35,
    smallScaleMax: 0.75,
    // CPU戦（スコアバトル・ごちゃまぜバトル共通）：CPU側が自動オジャマの対象に
    // なった場合、見た目の種類にかかわらず、effectDurationMsの間だけCPUの
    // 思考時間・なぞり操作時間をこの倍率にする（＝遅くする）。
    cpuSlowMultiplier: 2,
    // 受けた側の残り時間表示の下にeffectDurationMsの間出す
    // 「オジャマ「〇〇」」表示用のラベル。
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
  ],
  // じっくりモード（Phase 6実装指示書）。制限時間なし・固定盤面・手数制限で
  // お題を解く1人用ステージパズル。得点・フィーバー・LV称号は使用しない。
  puzzle: {
    areas: 4,
    stagesPerArea: 6,
    minPathLength: 2,
    maxPathLength: 5,
    allowedSums: [10, 20, 30, 40],
    tutorialVersion: 1,
    hintNodeLimit: 50_000,
    hintTimeBudgetMs: 300,
    hintAnimationMs: 1_800
  },
  // スコアアタック「おてがる」モード（おてがるモード実装指示書）。2×3盤面で
  // 指定合計・指定マス数の1問形式を60秒間解き続ける。フィーバー・称号は使わない。
  easyScoreAttack: {
    rows: 2,
    cols: 3,
    durationMs: 60_000,
    transitionMs: 300,
    minPathLength: 2,
    maxPathLength: 5,
    tutorialVersion: 1,
    // ノーミス・入れかえなしで正解した問題1問につき加算するボーナス点。
    noMissNoSwapBonus: 20
  },
  // じっくりモードのランダム生成問題（Phase 6ランダム生成問題実装指示書）。
  // 各エリアのStage 6クリアで解放される、無限に遊べる生成問題。3×3・4×4のみで
  // 5×5は生成しない。正解手順を先に作り、盤面を逆算してから解法検証する。
  randomPuzzle: {
    generatorVersion: 1,
    allowedBoardSizes: ['3x3', '4x4'],
    maxGenerateAttempts: 60,
    generationTimeBudgetMs: 1_500,
    solverNodeLimit: 100_000,
    fallbackSeedCountPerArea: 10,
    difficultyWeights: {
      easy: 0.25,
      normal: 0.55,
      challenge: 0.20
    },
    // 通常生成が失敗した場合に使う検証済みseed（各エリア最低10個）。
    // scratch_find_fallback_seeds.mjs相当のツールで、実際にgenerateFromSeed()を
    // 通して合格することを確認したうえで登録している。
    fallbackSeeds: {
      area1: [0xc408fbc8, 0xe9ef4e3e, 0x75a89572, 0x36615114, 0x23cfc79d, 0x8f4b9db4, 0xf06b56ed, 0xef0fbf1f, 0x3281775c, 0x21ac7eee],
      area2: [0x37414ca1, 0x245a5e20, 0xfe31e514, 0xc37f42bb, 0x0bc79488, 0x50d6964c, 0x721d44fe, 0x62c43a9a, 0x770f97f3, 0x7fd1b7ec],
      area3: [0xf7900026, 0x92e8f063, 0x78110de9, 0x00fd387c, 0x92207578, 0xc0276769, 0xb9baceb6, 0x118655ce, 0x50c78b0b, 0x2bbb6dec],
      area4: [0x05070460, 0x64e13398, 0x04ffef84, 0xeefb1b81, 0xa259d36d, 0xb2a7d8bf, 0xbb134730, 0x292eb698, 0x488da9da, 0xef4c4a13]
    }
  }
};

// おてがるスコアアタックの10種類の出題パターン（おてがるモード実装指示書 9章）。
// scoreは合計×マス数＋フォーティボーナス（scoring.calculateScoreと同じ式）で
// 導出できる値だが、検証・表示用に定数としても持たせる。
export const EASY_PATTERNS = [
  { id: 1, targetSum: 10, cellCount: 2, score: 20 },
  { id: 2, targetSum: 10, cellCount: 3, score: 30 },
  { id: 3, targetSum: 10, cellCount: 4, score: 40 },
  { id: 4, targetSum: 10, cellCount: 5, score: 50 },
  { id: 5, targetSum: 20, cellCount: 3, score: 60 },
  { id: 6, targetSum: 20, cellCount: 4, score: 80 },
  { id: 7, targetSum: 20, cellCount: 5, score: 100 },
  { id: 8, targetSum: 30, cellCount: 4, score: 120 },
  { id: 9, targetSum: 30, cellCount: 5, score: 150 },
  { id: 10, targetSum: 40, cellCount: 5, score: 300 }
];

// スコアアタックの2モード。既存の4×4モードは名称のみ「スタンダード」に変更し、
// 保存キー・内部進行（game.js）はそのまま流用する。
export const SCORE_ATTACK_MODES = {
  easy: {
    id: 'easy',
    label: 'おてがる',
    rows: 2,
    cols: 3,
    durationMs: 60_000,
    silverFeverEnabled: false,
    millionFeverEnabled: false,
    swapEnabled: true,
    destroyBehavior: 'pass',
    showTitleResult: false,
    storageRecordKey: 'scoreAttackEasy60'
  },
  standard: {
    id: 'standard',
    label: 'スタンダード',
    rows: 4,
    cols: 4,
    durationMs: 60_000,
    silverFeverEnabled: true,
    millionFeverEnabled: true,
    swapEnabled: true,
    destroyBehavior: 'singleCell',
    showTitleResult: true,
    storageRecordKey: 'scoreAttack60Fever10'
  }
};

// BGMの配置場所。ファイル名は日本語を含むため、参照時はencodeURI()で組み立てる。
export const BGM_BASE_PATH = 'assets/bgm/';

// ゲーム開始のたびにこの中から1曲をランダムに選ぶ。各曲は長さが微妙に異なるため、
// 曲ごとに再生開始タイミング（startTrigger）を変えて、曲の盛り上がりとゲーム進行を
// 合わせる。startTriggerの値はgame.js等の各コントローラが発火するタイミング名と
// 対応させる。
//   countdown3 / countdown2 / countdown1 / start … カウントダウンの「3」「2」「1」「START!」と同時
//   bgm03Start / bgm04Start                    … 対応するカウントダウン（1秒早く）の
//                                                 タイミングより1秒早いタイミング
//                                                 （bgm03Start＝「1」の1秒前、
//                                                   bgm04Start＝「START!」の1秒前）
//   delay3s                                    … ゲーム開始（START!）から3秒後（残り57秒）
export const BGM_TRACKS = [
  { id: 'bgm01', file: 'BGM01_焦りは禁物.mp3', startTrigger: 'countdown3' },
  { id: 'bgm02', file: 'BGM02_てんやわんやなお嬢様.mp3', startTrigger: 'countdown3' },
  { id: 'bgm03', file: 'BGM03_和風ロックBGM.mp3', startTrigger: 'bgm03Start' },
  { id: 'bgm04', file: 'BGM04_ColdHeart.mp3', startTrigger: 'bgm04Start' },
  { id: 'bgm05', file: 'BGM05_達成！.mp3', startTrigger: 'start' }
];

export const BGM_DELAY_TRIGGER_MS = 3_000;

// BGM03・BGM04を、通常のカウントダウンのタイミングより早く鳴らすための前倒し量。
export const BGM_EARLY_START_OFFSET_MS = 1_000;

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
  // 強さ4〜MAXを弱体化するため、旧レベルNのパラメータを新レベルN+1にずらしている
  // （旧レベル4→新レベル5、旧レベル5→新MAX）。新レベル4は繰り上げ元がないため、
  // 旧レベル3と旧レベル4の中間の数値を設定した。旧MAXの数値はどのレベルにも
  // 引き継がれず、最強値そのものが下がる。ラベル・ニックネーム・説明文は
  // 各枠の立ち位置（初心者向け〜最強）を表すため据え置き。
  4: {
    label: '強さ4',
    name: 'つよい',
    description: 'わりと高得点の組み合わせを探す',
    thinkMinMs: 2100,
    thinkMaxMs: 3200,
    maxPathLength: 5,
    bestMoveRate: 0.38,
    mistakeRate: 0.08,
    traceStepMs: 300,
    noMoveDestroyMs: 2750
  },
  5: {
    label: '強さ5',
    name: 'めちゃつよ',
    description: 'かなり速いスピードでパネルを消す',
    thinkMinMs: 1800,
    thinkMaxMs: 2800,
    maxPathLength: 5,
    bestMoveRate: 0.50,
    mistakeRate: 0.06,
    traceStepMs: 280,
    noMoveDestroyMs: 2500
  },
  MAX: {
    label: 'MAX',
    name: '超速',
    description: '最高得点を迷わず狙う最強CPU',
    thinkMinMs: 1300,
    thinkMaxMs: 2000,
    maxPathLength: 5,
    bestMoveRate: 0.70,
    mistakeRate: 0.03,
    traceStepMs: 240,
    noMoveDestroyMs: 2000
  }
};
