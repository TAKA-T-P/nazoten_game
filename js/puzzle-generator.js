// じっくりモードのランダム生成問題（Phase 6ランダム生成問題実装指示書）。
// DOM・音声・保存には一切依存しない純粋関数群。正解手順（経路）を先に作り、
// その経路から盤面を逆算したうえで、既存ソルバー（puzzle-solver.js）で
// 必ず再検証してから出題する（9.1〜9.2章：全ランダム配置→総当たり確認は禁止）。
import { CONFIG } from './config.js';
import {
  enumeratePaths,
  validateStage,
  simulateSolution,
  findPuzzleSolution
} from './puzzle-solver.js';

export const RANDOM_GENERATOR_VERSION = CONFIG.randomPuzzle.generatorVersion;
const VALID_SUMS = [10, 20, 30, 40];
const AREA_LABELS = { area1: 'A1', area2: 'A2', area3: 'A3', area4: 'A4' };

// --- seed付き擬似乱数（mulberry32）。問題生成開始後はMath.random()を使わない --
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seedCounter = 0;
function nextSeedCounter() {
  seedCounter = (seedCounter + 1) >>> 0;
  return seedCounter;
}

export function createSeed() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return (Date.now() ^ nextSeedCounter()) >>> 0;
}

export function formatProblemId({ areaId, generatorVersion, seed }) {
  const areaLabel = AREA_LABELS[areaId] || areaId.toUpperCase();
  const seedHex = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${areaLabel}-V${generatorVersion}-${seedHex}`;
}

export function makeRandomStageId({ areaId, generatorVersion, seed }) {
  return `random:${generatorVersion}:${areaId}:${(seed >>> 0).toString(16)}`;
}

// --- 汎用ユーティリティ ------------------------------------------------------

export function shuffleWithRng(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickOne(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

// 合計total・要素数lengthを満たす1〜9の数字列を作る（10章）。
// 各位置で残り合計から配置可能範囲を求める制約付き乱択。
export function generateNumberComposition({ total, length, rng }) {
  const values = [];
  let remainingTotal = total;
  let remainingLength = length;
  for (let i = 0; i < length; i++) {
    remainingLength -= 1;
    const min = Math.max(1, remainingTotal - remainingLength * 9);
    const max = Math.min(9, remainingTotal - remainingLength * 1);
    if (min > max) return null;
    const value = min + Math.floor(rng() * (max - min + 1));
    values.push(value);
    remainingTotal -= value;
  }
  return shuffleWithRng(values, rng);
}

// 指定した長さの経路のうち、合計10〜40のいずれかを満たせるものだけを返す
// （length <= sum <= length*9）。
export function sumsValidForLength(length) {
  return VALID_SUMS.filter((s) => length <= s && s <= length * 9);
}

function pickSumForLength(length, rng) {
  const sums = sumsValidForLength(length);
  if (sums.length === 0) return null;
  return pickOne(sums, rng);
}

// 2〜5の範囲でtotal <= length*9かつlength<=totalを満たす長さを1つ選ぶ。
function pickLengthForSum(sum, maxLength, rng) {
  const lengths = [];
  for (let len = 2; len <= maxLength; len++) {
    if (len <= sum && sum <= len * 9) lengths.push(len);
  }
  if (lengths.length === 0) return null;
  return pickOne(lengths, rng);
}

// --- 経路生成（11章） --------------------------------------------------------

// 指定サイズの盤面上の、長さがちょうどlengthの経路をすべて列挙する
// （puzzle-solver.enumeratePathsを、値の入っていないプレースホルダー盤面へ適用）。
function enumerateExactLengthPaths(rows, cols, length) {
  const placeholder = new Array(rows * cols).fill(1);
  return enumeratePaths(placeholder, cols, length, length).map((p) => p.cells);
}

// 指定した長さの経路を1本、excludeCellsに含まれるセルを避けてランダムに選ぶ（11.1章）。
export function pickRandomPath({ rows, cols, length, rng, excludeCells = null }) {
  const all = enumerateExactLengthPaths(rows, cols, length);
  const candidates = excludeCells
    ? all.filter((path) => path.every((c) => !excludeCells.has(c)))
    : all;
  if (candidates.length === 0) return null;
  return pickOne(candidates, rng);
}

function getNeighbors(index, rows, cols) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const result = [];
  if (r > 0) result.push(index - cols);
  if (r < rows - 1) result.push(index + cols);
  if (c > 0) result.push(index - 1);
  if (c < cols - 1) result.push(index + 1);
  return result;
}

// startCellから始まる、ちょうどsizeマスの自己交差しない経路を1本、
// isUsedに含まれるセルを避けてランダムDFSで探す。
function tryBuildPath(startCell, size, rows, cols, isUsed, rng) {
  const path = [startCell];
  const visited = new Set([startCell]);

  function dfs() {
    if (path.length === size) return true;
    const last = path[path.length - 1];
    const neighbors = shuffleWithRng(
      getNeighbors(last, rows, cols).filter((n) => !visited.has(n) && !isUsed[n]),
      rng
    );
    for (const next of neighbors) {
      path.push(next);
      visited.add(next);
      if (dfs()) return true;
      path.pop();
      visited.delete(next);
    }
    return false;
  }

  return dfs() ? path.slice() : null;
}

// 盤面の全セルを、groupSizes（各2〜5、合計=セル数）で指定した経路集合へ
// ちょうど1回ずつ分割する（11.2章）。見つからない場合はnullを返す。
export function generatePathCover({ rows, cols, groupSizes, rng, maxBacktrackSteps = 20_000 }) {
  const totalCells = rows * cols;
  if (groupSizes.reduce((a, b) => a + b, 0) !== totalCells) return null;
  const isUsed = new Array(totalCells).fill(false);
  const resultPaths = [];
  let steps = 0;

  function findFirstUnused() {
    for (let i = 0; i < totalCells; i++) if (!isUsed[i]) return i;
    return -1;
  }

  function backtrack(remainingSizes) {
    steps++;
    if (steps > maxBacktrackSteps) return false;
    if (remainingSizes.length === 0) return true;
    const start = findFirstUnused();
    if (start === -1) return false;
    const order = shuffleWithRng(remainingSizes.map((_, i) => i), rng);
    for (const idx of order) {
      const size = remainingSizes[idx];
      const path = tryBuildPath(start, size, rows, cols, isUsed, rng);
      if (!path) continue;
      path.forEach((c) => { isUsed[c] = true; });
      const nextSizes = remainingSizes.slice(0, idx).concat(remainingSizes.slice(idx + 1));
      if (backtrack(nextSizes)) {
        resultPaths.push(path);
        return true;
      }
      path.forEach((c) => { isUsed[c] = false; });
    }
    return false;
  }

  return backtrack(groupSizes) ? resultPaths : null;
}

// --- 難易度・盤面サイズ選択（16章） ------------------------------------------

function pickDifficulty(rng) {
  const weights = CONFIG.randomPuzzle.difficultyWeights;
  const r = rng();
  if (r < weights.easy) return 'easy';
  if (r < weights.easy + weights.normal) return 'normal';
  return 'challenge';
}

// エリア1・4は盤面サイズ固定（1章の表・15.1章）。エリア2・3は難易度に応じて
// 3×3/4×4を選ぶ（3章）。5×5はいかなる場合も選ばない。
function pickBoardSize(areaId, difficulty, rng) {
  if (areaId === 'area1') return { rows: 3, cols: 3 };
  if (areaId === 'area4') return { rows: 4, cols: 4 };
  if (difficulty === 'easy') return { rows: 3, cols: 3 };
  if (difficulty === 'challenge') return { rows: 4, cols: 4 };
  return rng() < 0.5 ? { rows: 3, cols: 3 } : { rows: 4, cols: 4 };
}

// 盤面上のcellCount個の経路（mission判定対象）が何本あるかを数える
// （12.3章・14.4章の「正解経路が多すぎない」検証に使う）。
export function countValidPaths(cells, cols, mission) {
  const paths = enumeratePaths(cells, cols, 2, 5);
  return paths.filter((p) => {
    if (mission.type === 'makeSum') {
      return p.sum === mission.targetSum && (mission.exactLength == null || p.cells.length === mission.exactLength);
    }
    if (mission.type === 'sequence') {
      const step = mission.steps[0];
      return p.sum === step.sum && (step.exactLength == null || p.cells.length === step.exactLength);
    }
    if (mission.type === 'clearAll') {
      return mission.allowedSums.includes(p.sum);
    }
    return false;
  }).length;
}

function fillRemainingCells(cells, rng) {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] == null) cells[i] = 1 + Math.floor(rng() * 9);
  }
}

function countOccurrencesOk(cells) {
  const counts = {};
  for (const v of cells) counts[v] = (counts[v] || 0) + 1;
  return Object.values(counts).every((c) => c <= 5);
}

// --- エリア1「10の入口」：makeSum・1手・3×3限定（12章） ----------------------

function generateArea1Attempt(rng) {
  const { rows, cols } = { rows: 3, cols: 3 };
  const sum = pickOne(VALID_SUMS, rng);
  // 40は必ず5マス（12.3章）。それ以外は成立する長さからランダムに選ぶ。
  const length = sum === 40 ? 5 : pickLengthForSum(sum, Math.min(5, rows * cols), rng);
  if (!length || length > rows * cols) return null;

  const path = pickRandomPath({ rows, cols, length, rng });
  if (!path) return null;
  const numbers = generateNumberComposition({ total: sum, length, rng });
  if (!numbers) return null;

  const cells = new Array(rows * cols).fill(null);
  path.forEach((cellIndex, i) => { cells[cellIndex] = numbers[i]; });
  fillRemainingCells(cells, rng);
  if (!countOccurrencesOk(cells)) return null;

  const mission = { type: 'makeSum', targetSum: sum, exactLength: rng() < 0.5 ? length : null };
  const validCount = countValidPaths(cells, cols, mission);
  if (validCount === 0 || validCount > 6) return null;

  return {
    rows, cols, cells, mission,
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: path }]
  };
}

// --- エリア2「ぴったりルート」：指定マス数・順番（13章） ---------------------

function generateArea2MakeSum(rng, boardSize) {
  const { rows, cols } = boardSize;
  const sum = pickOne(VALID_SUMS, rng);
  const maxLen = Math.min(5, rows * cols);
  const length = sum === 40 ? 5 : pickLengthForSum(sum, maxLen, rng);
  if (!length || length > rows * cols) return null;

  const path = pickRandomPath({ rows, cols, length, rng });
  if (!path) return null;
  const numbers = generateNumberComposition({ total: sum, length, rng });
  if (!numbers) return null;

  const cells = new Array(rows * cols).fill(null);
  path.forEach((cellIndex, i) => { cells[cellIndex] = numbers[i]; });
  fillRemainingCells(cells, rng);
  if (!countOccurrencesOk(cells)) return null;

  return {
    rows, cols, cells,
    mission: { type: 'makeSum', targetSum: sum, exactLength: length },
    moveLimit: 1,
    parMoves: 1,
    allowSwap: false,
    swapLimit: 0,
    officialSolution: [{ type: 'trace', cells: path }]
  };
}

function generateArea2Sequence(rng, boardSize) {
  const { rows, cols } = boardSize;
  const totalCells = rows * cols;
  const stepCount = 2 + Math.floor(rng() * 2); // 2〜3手
  const usedCells = new Set();
  const steps = [];
  const officialSolution = [];
  const cells = new Array(totalCells).fill(null);

  for (let i = 0; i < stepCount; i++) {
    const sum = pickOne(VALID_SUMS, rng);
    const remainingFree = totalCells - usedCells.size;
    const maxLen = Math.min(5, remainingFree);
    const length = sum === 40 ? (maxLen >= 5 ? 5 : null) : pickLengthForSum(sum, maxLen, rng);
    if (!length) return null;
    const path = pickRandomPath({ rows, cols, length, rng, excludeCells: usedCells });
    if (!path) return null;
    const numbers = generateNumberComposition({ total: sum, length, rng });
    if (!numbers) return null;
    path.forEach((cellIndex, j) => {
      cells[cellIndex] = numbers[j];
      usedCells.add(cellIndex);
    });
    steps.push({ sum, exactLength: rng() < 0.5 ? length : null });
    officialSolution.push({ type: 'trace', cells: path });
  }

  fillRemainingCells(cells, rng);
  if (!countOccurrencesOk(cells)) return null;

  return {
    rows, cols, cells,
    mission: { type: 'sequence', steps },
    moveLimit: stepCount,
    parMoves: stepCount,
    allowSwap: false,
    swapLimit: 0,
    officialSolution
  };
}

function generateArea2Attempt(rng, difficulty) {
  const boardSize = pickBoardSize('area2', difficulty, rng);
  return rng() < 0.5
    ? generateArea2MakeSum(rng, boardSize)
    : generateArea2Sequence(rng, boardSize);
}

// --- エリア3「ぜんぶ消しの森」：全消去（14章） --------------------------------

function groupSizeCandidatesFor(totalCells) {
  if (totalCells === 9) return [[4, 5], [2, 3, 4], [3, 3, 3]];
  return [[4, 4, 4, 4], [3, 3, 5, 5], [2, 4, 5, 5], [3, 4, 4, 5], [2, 3, 3, 3, 5]];
}

function generateArea3Attempt(rng, difficulty, boardSizeOverride = null) {
  const boardSize = boardSizeOverride || pickBoardSize('area3', difficulty, rng);
  const { rows, cols } = boardSize;
  const totalCells = rows * cols;
  const candidates = shuffleWithRng(groupSizeCandidatesFor(totalCells), rng)
    .filter((g) => g.reduce((a, b) => a + b, 0) === totalCells);

  for (const groupSizes of candidates) {
    const cover = generatePathCover({ rows, cols, groupSizes: shuffleWithRng(groupSizes, rng), rng });
    if (!cover) continue;

    const cells = new Array(totalCells).fill(null);
    const officialSolution = [];
    let failed = false;
    for (const path of cover) {
      const sum = pickSumForLength(path.length, rng);
      if (sum == null) { failed = true; break; }
      const numbers = generateNumberComposition({ total: sum, length: path.length, rng });
      if (!numbers) { failed = true; break; }
      path.forEach((cellIndex, i) => { cells[cellIndex] = numbers[i]; });
      officialSolution.push({ type: 'trace', cells: path });
    }
    if (failed) continue;
    if (!countOccurrencesOk(cells)) continue;

    const parMoves = officialSolution.length;
    const margin = difficulty === 'challenge' && totalCells === 16 && rng() < 0.5 ? 2 : 1;
    return {
      rows, cols, cells,
      mission: { type: 'clearAll', allowedSums: VALID_SUMS },
      moveLimit: parMoves + margin,
      parMoves,
      allowSwap: false,
      swapLimit: 0,
      officialSolution
    };
  }
  return null;
}

// --- エリア4「いれかえ研究所」：4×4固定・逆向き入れかえ生成（15章） ----------

function buildBaseSolvablePuzzle(rng, difficulty) {
  // 完成盤面（入れかえ後に解ける状態）は、エリア3のclearAll手法をそのまま
  // 流用して作る（15.2章1.：「エリア2またはエリア3と同じ方法」）。
  // エリア4は4×4固定のため、盤面サイズは明示的に4×4を渡す（15.1章）。
  return generateArea3Attempt(rng, difficulty === 'easy' ? 'normal' : difficulty, { rows: 4, cols: 4 });
}

function pickDistinctPair(nonEmptyCells, rng, exclude = new Set()) {
  const pool = nonEmptyCells.filter((c) => !exclude.has(c));
  if (pool.length < 2) return null;
  const shuffled = shuffleWithRng(pool, rng);
  return [shuffled[0], shuffled[1]];
}

function generateArea4Attempt(rng, difficulty) {
  const base = buildBaseSolvablePuzzle(rng, difficulty);
  if (!base) return null;

  const nonEmptyCells = base.cells.map((v, i) => i).filter((i) => base.cells[i] != null);
  const swapCount = difficulty === 'challenge' && nonEmptyCells.length >= 8 && rng() < 0.6 ? 2 : 1;

  const cells = base.cells.slice();
  const swaps = [];
  const usedInSwap = new Set();
  for (let i = 0; i < swapCount; i++) {
    const pair = pickDistinctPair(nonEmptyCells, rng, usedInSwap);
    if (!pair) return null;
    const [a, b] = pair;
    if (cells[a] === cells[b]) return null; // 同じ数字同士の無意味な交換を避ける
    const tmp = cells[a];
    cells[a] = cells[b];
    cells[b] = tmp;
    usedInSwap.add(a);
    usedInSwap.add(b);
    swaps.push([a, b]);
  }
  if (!countOccurrencesOk(cells)) return null;

  // 出題盤面（scramble後）を元に戻す入れかえ操作は、自分自身が逆操作のため
  // 実行した順の逆順で登録する（15.2章）。
  const undoSwaps = swaps.slice().reverse().map(([a, b]) => ({ type: 'swap', a, b }));
  const officialSolution = [...undoSwaps, ...base.officialSolution];

  return {
    rows: base.rows,
    cols: base.cols,
    cells,
    mission: base.mission,
    moveLimit: base.parMoves + swapCount + (difficulty === 'challenge' ? 1 : 0),
    parMoves: base.parMoves + swapCount,
    allowSwap: true,
    swapLimit: swapCount,
    officialSolution
  };
}

// --- 生成後の検証（17章） ----------------------------------------------------

function isAllowedBoardSize(rows, cols) {
  const key = `${rows}x${cols}`;
  return CONFIG.randomPuzzle.allowedBoardSizes.includes(key);
}

export function validateGeneratedPuzzle({ puzzle, solverNodeLimit, requireSwap }) {
  const errors = [];
  if (!isAllowedBoardSize(puzzle.rows, puzzle.cols)) {
    errors.push(`board size ${puzzle.rows}x${puzzle.cols} not allowed`);
    return { valid: false, errors };
  }

  const stageForValidation = { id: 'random:validation', areaId: puzzle.areaId || 'area1', stageNumber: 1, ...puzzle };
  const structural = validateStage(stageForValidation);
  if (!structural.valid) errors.push(...structural.errors);

  if (requireSwap) {
    const noSwapStage = { ...stageForValidation, allowSwap: false, swapLimit: 0 };
    const noSwapResult = findPuzzleSolution({
      stage: noSwapStage,
      maxNodes: solverNodeLimit,
      maxMs: CONFIG.randomPuzzle.generationTimeBudgetMs,
      options: { minLength: 2, maxLength: 5 }
    });
    // 探索上限に達しただけの'limit'は安全の証明にならないため不合格とする（15.3章）。
    if (noSwapResult.status !== 'unsolved') {
      errors.push(`no-swap solvability check inconclusive or solvable (status=${noSwapResult.status})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- エリア別ディスパッチ・上位API ------------------------------------------

const AREA_GENERATORS = {
  area1: (rng) => generateArea1Attempt(rng),
  area2: (rng, difficulty) => generateArea2Attempt(rng, difficulty),
  area3: (rng, difficulty) => generateArea3Attempt(rng, difficulty),
  area4: (rng, difficulty) => generateArea4Attempt(rng, difficulty)
};

function attemptOnce(areaId, rng) {
  const difficulty = pickDifficulty(rng);
  const generator = AREA_GENERATORS[areaId];
  if (!generator) return null;
  const built = generator(rng, difficulty);
  if (!built) return null;

  const sim = simulateSolution(built, {});
  if (!sim.ok || sim.movesUsed !== built.parMoves) return null;

  const requireSwap = areaId === 'area4';
  const validation = validateGeneratedPuzzle({
    puzzle: { ...built, areaId },
    solverNodeLimit: CONFIG.randomPuzzle.solverNodeLimit,
    requireSwap
  });
  if (!validation.valid) return null;

  return { ...built, difficulty };
}

// areaId・generatorVersion・seedから決定的に問題を作る（7.4章）。
// 同じ3つの値からは常に同じ盤面・お題・公式解法が得られる。
export function generateFromSeed({ areaId, generatorVersion = RANDOM_GENERATOR_VERSION, seed }) {
  const rng = mulberry32(seed);
  const built = attemptOnce(areaId, rng);
  if (!built) return null;

  return {
    id: makeRandomStageId({ areaId, generatorVersion, seed }),
    isRandom: true,
    areaId,
    generatorVersion,
    seed,
    title: 'ランダム問題',
    stageNumber: null,
    ...built
  };
}

// 新しいseedを発行して、通常の再試行→フォールバックseedの順で問題を作る（6章・18章）。
export function generateRandomPuzzle({ areaId, generatorVersion = RANDOM_GENERATOR_VERSION, config = CONFIG.randomPuzzle }) {
  const startedAt = Date.now();
  for (let attempt = 0; attempt < config.maxGenerateAttempts; attempt++) {
    if (Date.now() - startedAt > config.generationTimeBudgetMs) break;
    const seed = createSeed();
    const puzzle = generateFromSeed({ areaId, generatorVersion, seed });
    if (puzzle) return { puzzle, usedFallback: false, attempts: attempt + 1 };
  }

  const fallbackSeeds = config.fallbackSeeds?.[areaId] || [];
  for (const seed of shuffleWithRng(fallbackSeeds, mulberry32(createSeed()))) {
    const puzzle = generateFromSeed({ areaId, generatorVersion, seed });
    if (puzzle) return { puzzle, usedFallback: true, attempts: config.maxGenerateAttempts };
  }

  return { puzzle: null, usedFallback: true, attempts: config.maxGenerateAttempts };
}
