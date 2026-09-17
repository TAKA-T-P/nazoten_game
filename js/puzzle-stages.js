// じっくりモードの全24ステージ固定データ（Phase 6実装指示書 16〜17章）。
// 数字配置・お題・公式解法はすべてtests/puzzle-validation.htmlで自動検証する。
export const PUZZLE_AREAS = [
  { id: 'area1', name: '10の入口' },
  { id: 'area2', name: 'ぴったりルート' },
  { id: 'area3', name: 'ぜんぶ消しの森' },
  { id: 'area4', name: 'いれかえ研究所' }
];

export const PUZZLE_STAGES = [
  // --- エリア1：10の入口（3×3・指定合計の基本） ---------------------------
  {
    id: 'area1-stage01',
    areaId: 'area1',
    stageNumber: 1,
    title: '10を作ろう！',
    rows: 3,
    cols: 3,
    cells: [3, 7, 2, 5, 1, 8, 6, 4, 9],
    mission: { type: 'makeSum', targetSum: 10, exactLength: null },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1] }]
  },
  {
    id: 'area1-stage02',
    areaId: 'area1',
    stageNumber: 2,
    title: '3マスで20！',
    rows: 3,
    cols: 3,
    cells: [8, 5, 1, 2, 7, 4, 6, 3, 9],
    mission: { type: 'makeSum', targetSum: 20, exactLength: 3 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 4] }]
  },
  {
    id: 'area1-stage03',
    areaId: 'area1',
    stageNumber: 3,
    title: '4マスで30！',
    rows: 3,
    cols: 3,
    cells: [9, 8, 2, 3, 6, 5, 4, 7, 1],
    mission: { type: 'makeSum', targetSum: 30, exactLength: 4 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 4, 7] }]
  },
  {
    id: 'area1-stage04',
    areaId: 'area1',
    stageNumber: 4,
    title: '5マスで10！',
    rows: 3,
    cols: 3,
    cells: [1, 2, 1, 9, 3, 3, 8, 6, 4],
    mission: { type: 'makeSum', targetSum: 10, exactLength: 5 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 2, 5, 4] }]
  },
  {
    id: 'area1-stage05',
    areaId: 'area1',
    stageNumber: 5,
    title: '5マスで40！',
    rows: 3,
    cols: 3,
    cells: [9, 8, 9, 1, 7, 7, 2, 3, 4],
    mission: { type: 'makeSum', targetSum: 40, exactLength: 5 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 2, 5, 4] }]
  },
  {
    id: 'area1-stage06',
    areaId: 'area1',
    stageNumber: 6,
    title: '10のあと20！',
    rows: 3,
    cols: 3,
    cells: [3, 7, 2, 9, 6, 5, 1, 8, 4],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 10, exactLength: null },
        { sum: 20, exactLength: null }
      ]
    },
    moveLimit: 2,
    parMoves: 2,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1] },
      { type: 'trace', cells: [3, 4, 5] }
    ]
  },

  // --- エリア2：ぴったりルート（指定マス数・順番） --------------------------
  {
    id: 'area2-stage01',
    areaId: 'area2',
    stageNumber: 1,
    title: '4マスで20！',
    rows: 3,
    cols: 3,
    cells: [5, 6, 9, 5, 4, 8, 7, 3, 2],
    mission: { type: 'makeSum', targetSum: 20, exactLength: 4 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 4, 3] }]
  },
  {
    id: 'area2-stage02',
    areaId: 'area2',
    stageNumber: 2,
    title: '5マスで10！',
    rows: 4,
    cols: 4,
    cells: [1, 2, 1, 9, 8, 3, 3, 7, 6, 5, 4, 9, 8, 7, 6, 5],
    mission: { type: 'makeSum', targetSum: 10, exactLength: 5 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 2, 6, 5] }]
  },
  {
    // 元の設計表は「3マスで30」だが、3マスの最大合計は27（9+9+9）のため
    // 数学的に不可能。難易度帯を保ったまま「3マスで20」へ変更した
    // （16.3章：難易度調整の理由をここに残す）。
    id: 'area2-stage03',
    areaId: 'area2',
    stageNumber: 3,
    title: '3マスで20！',
    rows: 4,
    cols: 4,
    cells: [9, 8, 3, 2, 4, 6, 1, 5, 9, 7, 8, 6, 2, 3, 4, 1],
    mission: { type: 'makeSum', targetSum: 20, exactLength: 3 },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: [0, 1, 2] }]
  },
  {
    id: 'area2-stage04',
    areaId: 'area2',
    stageNumber: 4,
    title: '10のあと30！',
    rows: 4,
    cols: 4,
    cells: [3, 7, 2, 1, 9, 8, 6, 7, 4, 5, 2, 3, 1, 6, 8, 9],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 10, exactLength: null },
        { sum: 30, exactLength: null }
      ]
    },
    moveLimit: 2,
    parMoves: 2,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1] },
      { type: 'trace', cells: [4, 5, 6, 7] }
    ]
  },
  {
    id: 'area2-stage05',
    areaId: 'area2',
    stageNumber: 5,
    title: '20→10→30！',
    rows: 4,
    cols: 4,
    cells: [9, 8, 3, 2, 4, 6, 1, 5, 9, 7, 8, 6, 2, 3, 4, 1],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 20, exactLength: null },
        { sum: 10, exactLength: null },
        { sum: 30, exactLength: null }
      ]
    },
    moveLimit: 3,
    parMoves: 3,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2] },
      { type: 'trace', cells: [4, 5] },
      { type: 'trace', cells: [8, 9, 10, 11] }
    ]
  },
  {
    id: 'area2-stage06',
    areaId: 'area2',
    stageNumber: 6,
    title: '40→20→10！',
    rows: 4,
    cols: 4,
    cells: [9, 8, 9, 2, 1, 7, 7, 3, 9, 8, 3, 4, 4, 6, 5, 1],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 40, exactLength: null },
        { sum: 20, exactLength: null },
        { sum: 10, exactLength: null }
      ]
    },
    moveLimit: 3,
    parMoves: 3,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2, 6, 5] },
      { type: 'trace', cells: [8, 9, 10] },
      { type: 'trace', cells: [12, 13] }
    ]
  },

  // --- エリア3：ぜんぶ消しの森（全消去・先読み） -----------------------------
  {
    id: 'area3-stage01',
    areaId: 'area3',
    stageNumber: 1,
    title: '全部消そう！',
    rows: 3,
    cols: 3,
    cells: [1, 2, 1, 9, 3, 3, 8, 7, 6],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 3,
    parMoves: 2,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2, 5, 4] },
      { type: 'trace', cells: [3, 6, 7, 8] }
    ]
  },
  {
    id: 'area3-stage02',
    areaId: 'area3',
    stageNumber: 2,
    title: '全部消そう！',
    rows: 3,
    cols: 3,
    cells: [2, 3, 5, 9, 6, 5, 8, 7, 5],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 4,
    parMoves: 3,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2] },
      { type: 'trace', cells: [3, 4, 5] },
      { type: 'trace', cells: [6, 7, 8] }
    ]
  },
  {
    id: 'area3-stage03',
    areaId: 'area3',
    stageNumber: 3,
    title: '全部消そう！',
    rows: 4,
    cols: 4,
    cells: [9, 8, 9, 2, 9, 7, 7, 3, 8, 2, 9, 5, 6, 7, 4, 5],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 5,
    parMoves: 4,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2, 6, 5] },
      { type: 'trace', cells: [4, 8, 12, 13] },
      { type: 'trace', cells: [9, 10, 14, 15] },
      { type: 'trace', cells: [3, 7, 11] }
    ]
  },
  {
    id: 'area3-stage04',
    areaId: 'area3',
    stageNumber: 4,
    title: '全部消そう！',
    rows: 4,
    cols: 4,
    cells: [2, 3, 5, 9, 2, 3, 5, 8, 8, 7, 5, 3, 9, 8, 6, 7],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 6,
    parMoves: 5,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1, 2] },
      { type: 'trace', cells: [3, 7, 11] },
      { type: 'trace', cells: [4, 5, 6] },
      { type: 'trace', cells: [8, 9, 10] },
      { type: 'trace', cells: [12, 13, 14, 15] }
    ]
  },
  {
    id: 'area3-stage05',
    areaId: 'area3',
    stageNumber: 5,
    title: '全部消そう！',
    rows: 4,
    cols: 4,
    cells: [3, 7, 4, 6, 9, 8, 3, 9, 2, 3, 5, 6, 9, 7, 4, 5],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 7,
    parMoves: 6,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1] },
      { type: 'trace', cells: [2, 3] },
      { type: 'trace', cells: [4, 5, 6] },
      { type: 'trace', cells: [7, 11, 15] },
      { type: 'trace', cells: [8, 9, 10] },
      { type: 'trace', cells: [12, 13, 14] }
    ]
  },
  {
    id: 'area3-stage06',
    areaId: 'area3',
    stageNumber: 6,
    title: '最終チャレンジ！',
    rows: 4,
    cols: 4,
    cells: [3, 7, 4, 6, 2, 8, 1, 9, 5, 5, 9, 8, 9, 7, 4, 3],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 7,
    parMoves: 7,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [
      { type: 'trace', cells: [0, 1] },
      { type: 'trace', cells: [2, 3] },
      { type: 'trace', cells: [4, 5] },
      { type: 'trace', cells: [6, 7] },
      { type: 'trace', cells: [8, 9] },
      { type: 'trace', cells: [10, 11, 15] },
      { type: 'trace', cells: [12, 13, 14] }
    ]
  },

  // --- エリア4：いれかえ研究所（入れかえ・総合問題） -------------------------
  {
    id: 'area4-stage01',
    areaId: 'area4',
    stageNumber: 1,
    title: '入れかえて全消去！',
    rows: 4,
    cols: 4,
    cells: [2, 6, 4, 5, 9, 8, 6, 7, 1, 2, 3, 4, 8, 7, 3, 5],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 6,
    parMoves: 5,
    allowSwap: true,
    swapLimit: 1,
    officialSolution: [
      { type: 'swap', a: 0, b: 15 },
      { type: 'trace', cells: [0, 1, 2, 3] },
      { type: 'trace', cells: [4, 5, 6, 7] },
      { type: 'trace', cells: [8, 9, 10, 11] },
      { type: 'trace', cells: [12, 13, 14, 15] }
    ]
  },
  {
    id: 'area4-stage02',
    areaId: 'area4',
    stageNumber: 2,
    title: '入れかえて20→30！',
    rows: 4,
    cols: 4,
    cells: [9, 8, 5, 2, 9, 8, 6, 7, 1, 2, 3, 4, 5, 6, 7, 3],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 20, exactLength: null },
        { sum: 30, exactLength: null }
      ]
    },
    moveLimit: 4,
    parMoves: 3,
    allowSwap: true,
    swapLimit: 1,
    officialSolution: [
      { type: 'swap', a: 2, b: 15 },
      { type: 'trace', cells: [0, 1, 2] },
      { type: 'trace', cells: [4, 5, 6, 7] }
    ]
  },
  {
    id: 'area4-stage03',
    areaId: 'area4',
    stageNumber: 3,
    title: '入れかえて全消去！',
    rows: 4,
    cols: 4,
    cells: [2, 6, 4, 5, 4, 8, 6, 7, 1, 2, 3, 9, 8, 7, 3, 5],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 7,
    parMoves: 6,
    allowSwap: true,
    swapLimit: 2,
    officialSolution: [
      { type: 'swap', a: 0, b: 15 },
      { type: 'swap', a: 4, b: 11 },
      { type: 'trace', cells: [0, 1, 2, 3] },
      { type: 'trace', cells: [4, 5, 6, 7] },
      { type: 'trace', cells: [8, 9, 10, 11] },
      { type: 'trace', cells: [12, 13, 14, 15] }
    ]
  },
  {
    id: 'area4-stage04',
    areaId: 'area4',
    stageNumber: 4,
    title: '10→20→30！',
    rows: 5,
    cols: 5,
    cells: [
      3, 7, 9, 8, 5,
      9, 8, 6, 7, 1,
      2, 4, 6, 9, 1,
      2, 4, 6, 9, 1,
      2, 4, 6, 9, 3
    ],
    mission: {
      type: 'sequence',
      steps: [
        { sum: 10, exactLength: null },
        { sum: 20, exactLength: null },
        { sum: 30, exactLength: null }
      ]
    },
    moveLimit: 5,
    parMoves: 4,
    allowSwap: true,
    swapLimit: 1,
    officialSolution: [
      { type: 'swap', a: 4, b: 24 },
      { type: 'trace', cells: [0, 1] },
      { type: 'trace', cells: [2, 3, 4] },
      { type: 'trace', cells: [5, 6, 7, 8] }
    ]
  },
  {
    id: 'area4-stage05',
    areaId: 'area4',
    stageNumber: 5,
    title: '全部消そう！',
    rows: 5,
    cols: 5,
    cells: [
      4, 2, 3, 5, 9,
      1, 8, 6, 4, 3,
      9, 2, 1, 3, 3,
      9, 8, 9, 7, 7,
      1, 5, 6, 3, 2
    ],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 8,
    parMoves: 7,
    allowSwap: true,
    swapLimit: 2,
    officialSolution: [
      { type: 'swap', a: 0, b: 20 },
      { type: 'swap', a: 5, b: 10 },
      { type: 'trace', cells: [0, 1, 2, 3, 4] },
      { type: 'trace', cells: [5, 6, 7, 8, 9] },
      { type: 'trace', cells: [10, 11, 12, 13, 14] },
      { type: 'trace', cells: [15, 16, 17, 18, 19] },
      { type: 'trace', cells: [20, 21, 22, 23, 24] }
    ]
  },
  {
    id: 'area4-stage06',
    areaId: 'area4',
    stageNumber: 6,
    title: '最終チャレンジ！',
    rows: 5,
    cols: 5,
    cells: [
      3, 2, 3, 5, 9,
      8, 8, 6, 4, 3,
      4, 6, 6, 8, 6,
      9, 9, 9, 7, 7,
      1, 7, 9, 7, 4
    ],
    mission: { type: 'clearAll', allowedSums: [10, 20, 30, 40] },
    moveLimit: 9,
    parMoves: 9,
    allowSwap: true,
    swapLimit: 2,
    officialSolution: [
      { type: 'swap', a: 0, b: 20 },
      { type: 'swap', a: 5, b: 16 },
      { type: 'trace', cells: [0, 1, 2, 3, 4] },
      { type: 'trace', cells: [5, 6, 7, 8, 9] },
      { type: 'trace', cells: [10, 11] },
      { type: 'trace', cells: [12, 13, 14] },
      { type: 'trace', cells: [15, 16, 17, 18, 19] },
      { type: 'trace', cells: [20, 21] },
      { type: 'trace', cells: [22, 23, 24] }
    ]
  }
];
