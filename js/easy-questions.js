// おてがるスコアアタックの出題ロジック（おてがるモード実装指示書 9〜16章）。
// DOM・音声・保存には一切依存しない純粋関数群。盤面は2×3固定で、
// puzzle-solver.jsの経路列挙・隣接判定をそのまま流用する（重複実装しない）。
import { CONFIG, EASY_PATTERNS } from './config.js';
import { enumeratePaths, areAdjacent } from './puzzle-solver.js';

const EASY_COLS = CONFIG.easyScoreAttack.cols;
const EASY_CELL_COUNT = CONFIG.easyScoreAttack.rows * CONFIG.easyScoreAttack.cols;
const MAX_GENERATE_ATTEMPTS = 50;

function canonicalPathKey(path) {
  const forward = path.join('-');
  const reverse = [...path].reverse().join('-');
  return forward < reverse ? forward : reverse;
}

function shuffle(array, rng = Math.random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 2×3盤面上の、上下左右につながる2〜5マスの経路をすべて列挙し、長さ別に
// 分ける。なぞる向きだけが逆の経路は同じ経路とみなして1本にまとめる。
export function buildEasyPathsByLength() {
  const placeholderCells = new Array(EASY_CELL_COUNT).fill(1);
  const allPaths = enumeratePaths(placeholderCells, EASY_COLS, 2, 5);
  const byLength = { 2: [], 3: [], 4: [], 5: [] };
  const seen = new Set();
  for (const { cells } of allPaths) {
    const key = canonicalPathKey(cells);
    if (seen.has(key)) continue;
    seen.add(key);
    byLength[cells.length].push(cells.slice());
  }
  return byLength;
}

export const EASY_PATHS_BY_LENGTH = buildEasyPathsByLength();

// 生成上限（50回）に達した場合に使う、検証済みの固定フォールバック盤面。
export const EASY_FALLBACK_QUESTIONS = {
  1: { values: [3, 7, 1, 2, 4, 5], path: [0, 1] },
  2: { values: [2, 3, 5, 1, 4, 6], path: [0, 1, 2] },
  3: { values: [1, 2, 3, 5, 6, 4], path: [0, 1, 2, 5] },
  4: { values: [1, 1, 2, 9, 3, 3], path: [0, 1, 2, 5, 4] },
  5: { values: [5, 7, 8, 1, 2, 3], path: [0, 1, 2] },
  6: { values: [2, 4, 6, 1, 3, 8], path: [0, 1, 2, 5] },
  7: { values: [2, 3, 4, 1, 6, 5], path: [0, 1, 2, 5, 4] },
  8: { values: [6, 7, 8, 1, 2, 9], path: [0, 1, 2, 5] },
  9: { values: [4, 5, 6, 1, 8, 7], path: [0, 1, 2, 5, 4] },
  10: { values: [6, 8, 8, 1, 9, 9], path: [0, 1, 2, 5, 4] }
};

export function getEasyPatternById(patternId) {
  return EASY_PATTERNS.find((p) => p.id === patternId) || null;
}

// 各10問ブロックの1・2・6・10番目を①・②・⑨・⑩に固定し、③〜⑧をシャッフルして
// 残りの6枠へ配置する（おてがるモード実装指示書 10.1章）。
export function createEasyPatternBlock(rng = Math.random) {
  const block = Array(10).fill(null);
  block[0] = 1;
  block[1] = 2;
  block[5] = 9;
  block[9] = 10;

  const patternIds = shuffle([3, 4, 5, 6, 7, 8], rng);
  const positions = [2, 3, 4, 6, 7, 8];
  positions.forEach((position, index) => {
    block[position] = patternIds[index];
  });
  return block;
}

// 残り合計から配置可能な範囲を都度求める制約付き乱択で、合計targetSum・
// 要素数cellCountの数字列（各1〜9）を作る（12.1章）。
export function generateNumbersForPattern({ targetSum, cellCount, rng = Math.random }) {
  const values = [];
  let remainingSum = targetSum;
  let remainingCells = cellCount;
  for (let i = 0; i < cellCount; i++) {
    remainingCells -= 1;
    const min = Math.max(1, remainingSum - remainingCells * 9);
    const max = Math.min(9, remainingSum - remainingCells * 1);
    if (min > max) return null;
    const value = min + Math.floor(rng() * (max - min + 1));
    values.push(value);
    remainingSum -= value;
  }
  return shuffle(values, rng);
}

function findValidPaths(values, pattern) {
  return enumeratePaths(values, EASY_COLS, 2, 5)
    .filter((p) => p.cells.length === pattern.cellCount && p.sum === pattern.targetSum);
}

// 盤面を1つ生成する（14.1章の手順）。50回試みても条件を満たせない場合は
// 検証済みフォールバックを返す。
export function generateEasyQuestion(pattern, previousValues = null, rng = Math.random) {
  const candidatePaths = EASY_PATHS_BY_LENGTH[pattern.cellCount];

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const path = candidatePaths[Math.floor(rng() * candidatePaths.length)];
    const pathNumbers = generateNumbersForPattern({ targetSum: pattern.targetSum, cellCount: pattern.cellCount, rng });
    if (!pathNumbers) continue;

    const values = new Array(EASY_CELL_COUNT).fill(null);
    path.forEach((cellIndex, i) => { values[cellIndex] = pathNumbers[i]; });
    for (let i = 0; i < EASY_CELL_COUNT; i++) {
      if (values[i] == null) values[i] = 1 + Math.floor(rng() * 9);
    }

    if (values.every((v) => v === values[0])) continue;
    if (previousValues && values.every((v, i) => v === previousValues[i])) continue;

    const validPaths = findValidPaths(values, pattern);
    if (validPaths.length === 0) continue;

    return {
      patternId: pattern.id,
      targetSum: pattern.targetSum,
      cellCount: pattern.cellCount,
      values,
      guaranteedPath: path.slice(),
      validPaths: validPaths.map((p) => p.cells)
    };
  }

  const fallback = EASY_FALLBACK_QUESTIONS[pattern.id];
  const values = fallback.values.slice();
  return {
    patternId: pattern.id,
    targetSum: pattern.targetSum,
    cellCount: pattern.cellCount,
    values,
    guaranteedPath: fallback.path.slice(),
    validPaths: findValidPaths(values, pattern).map((p) => p.cells)
  };
}

// 生成された問題が仕様どおりか検証する（テスト・起動時チェック用、18.1相当）。
export function validateEasyQuestion(question) {
  const errors = [];
  const pattern = getEasyPatternById(question.patternId);
  if (!pattern) {
    errors.push('unknown patternId');
    return { valid: false, errors };
  }
  if (question.values.length !== EASY_CELL_COUNT) errors.push('values.length must be 6');
  for (const v of question.values) {
    if (!Number.isInteger(v) || v < 1 || v > 9) errors.push(`invalid value: ${v}`);
  }
  if (question.values.every((v) => v === question.values[0])) errors.push('all six values are identical');
  if (!question.validPaths || question.validPaths.length === 0) errors.push('no valid no-swap path exists');
  for (const path of question.validPaths || []) {
    if (path.length !== pattern.cellCount) errors.push('validPaths entry has wrong length');
    if (new Set(path).size !== path.length) errors.push('validPaths entry reuses a cell');
    let sum = 0;
    for (let i = 0; i < path.length; i++) {
      sum += question.values[path[i]];
      if (i > 0 && !areAdjacent(path[i - 1], path[i], EASY_COLS)) {
        errors.push('validPaths entry not orthogonally connected');
      }
    }
    if (sum !== pattern.targetSum) errors.push('validPaths entry does not sum to targetSum');
  }
  return { valid: errors.length === 0, errors };
}

// 指を離した時点の盤面値から正解判定する（16章）。合計・マス数の両方が一致し、
// 経路が上下左右に連結・重複なしのときだけ正解。
export function isEasyAnswerCorrect({ path, boardValues, pattern }) {
  if (path.length !== pattern.cellCount) return false;
  if (new Set(path).size !== path.length) return false;
  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(path[i - 1], path[i], EASY_COLS)) return false;
  }
  const sum = path.reduce((total, cellId) => total + boardValues[cellId], 0);
  return sum === pattern.targetSum;
}
