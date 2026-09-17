// じっくりモードの純粋ロジック（あそびかた… ではなくPhase6実装指示書 20章・18章）。
// DOM・音声・保存には一切依存しない。盤面はBoard(board.js)を使わず、
// 可変サイズ（3×3/4×4/5×5）を素直に扱えるよう、状態は
// {cells, movesUsed, swapsUsed, sequenceIndex, missionDone, actionHistory}
// という単純なオブジェクトで表す（cellsの空欄はnull）。

export const PUZZLE_MISSION_TYPES = {
  MAKE_SUM: 'makeSum',
  SEQUENCE: 'sequence',
  CLEAR_ALL: 'clearAll'
};

export function areAdjacent(a, b, cols) {
  const ra = Math.floor(a / cols);
  const ca = a % cols;
  const rb = Math.floor(b / cols);
  const cb = b % cols;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

// 各非空セルを起点に、上下左右へ深さmaxLengthまでの経路（2マス以上）を列挙する。
export function enumeratePaths(cells, cols, minLength = 2, maxLength = 5) {
  const paths = [];
  const n = cells.length;
  const path = [];
  const visited = new Set();

  function dfs() {
    if (path.length >= minLength) {
      let sum = 0;
      for (const idx of path) sum += cells[idx];
      paths.push({ cells: path.slice(), sum });
    }
    if (path.length >= maxLength) return;
    const last = path[path.length - 1];
    for (let next = 0; next < n; next++) {
      if (visited.has(next)) continue;
      if (cells[next] == null) continue;
      if (!areAdjacent(last, next, cols)) continue;
      visited.add(next);
      path.push(next);
      dfs();
      path.pop();
      visited.delete(next);
    }
  }

  for (let start = 0; start < n; start++) {
    if (cells[start] == null) continue;
    visited.clear();
    visited.add(start);
    path.length = 0;
    path.push(start);
    dfs();
  }
  return paths;
}

export function createInitialState(stage) {
  return {
    cells: stage.cells.slice(),
    movesUsed: 0,
    swapsUsed: 0,
    sequenceIndex: 0,
    missionDone: false,
    actionHistory: []
  };
}

// 現在のお題状態に対して、この合計・マス数の操作が受理されるかを判定する
// （UI・探索の両方から共通で使う。判定式を二重に書かない）。
export function evaluateMission(mission, state, sum, pathLength) {
  switch (mission.type) {
    case PUZZLE_MISSION_TYPES.MAKE_SUM:
      if (state.missionDone) return false;
      return sum === mission.targetSum && (mission.exactLength == null || pathLength === mission.exactLength);
    case PUZZLE_MISSION_TYPES.SEQUENCE: {
      const step = mission.steps[state.sequenceIndex];
      if (!step) return false;
      return sum === step.sum && (step.exactLength == null || pathLength === step.exactLength);
    }
    case PUZZLE_MISSION_TYPES.CLEAR_ALL:
      return mission.allowedSums.includes(sum);
    default:
      return false;
  }
}

export function isCleared(state, stage) {
  switch (stage.mission.type) {
    case PUZZLE_MISSION_TYPES.MAKE_SUM:
      return state.missionDone;
    case PUZZLE_MISSION_TYPES.SEQUENCE:
      return state.sequenceIndex >= stage.mission.steps.length;
    case PUZZLE_MISSION_TYPES.CLEAR_ALL:
      return state.cells.every((v) => v == null);
    default:
      return false;
  }
}

function pathIsValid(cells, cols, pathCells, minLength, maxLength) {
  if (pathCells.length < minLength || pathCells.length > maxLength) return false;
  const seen = new Set();
  for (let i = 0; i < pathCells.length; i++) {
    const idx = pathCells[i];
    if (idx < 0 || idx >= cells.length) return false;
    if (cells[idx] == null) return false;
    if (seen.has(idx)) return false;
    seen.add(idx);
    if (i > 0 && !areAdjacent(pathCells[i - 1], idx, cols)) return false;
  }
  return true;
}

// なぞり操作を確定させる（受理されなければ盤面・手数を変更しない）。
export function applyTrace(state, stage, pathCells, options = {}) {
  const minLength = options.minLength ?? 2;
  const maxLength = options.maxLength ?? 5;
  if (!pathIsValid(state.cells, stage.cols, pathCells, minLength, maxLength)) {
    return { accepted: false, reason: 'invalid-path' };
  }
  let sum = 0;
  for (const idx of pathCells) sum += state.cells[idx];
  if (!evaluateMission(stage.mission, state, sum, pathCells.length)) {
    return { accepted: false, reason: 'mission-reject' };
  }

  const nextCells = state.cells.slice();
  for (const idx of pathCells) nextCells[idx] = null;

  const nextState = {
    cells: nextCells,
    movesUsed: state.movesUsed + 1,
    swapsUsed: state.swapsUsed,
    sequenceIndex: state.sequenceIndex + (stage.mission.type === PUZZLE_MISSION_TYPES.SEQUENCE ? 1 : 0),
    missionDone: state.missionDone || stage.mission.type === PUZZLE_MISSION_TYPES.MAKE_SUM,
    actionHistory: [...state.actionHistory, { type: 'trace', cells: pathCells.slice() }]
  };
  return { accepted: true, nextState, sum, clearedCells: pathCells.slice() };
}

// 数字入れかえを確定させる（ステージ限定・手数消費。10.2/12章）。
export function applySwap(state, stage, a, b) {
  if (!stage.allowSwap) return { accepted: false, reason: 'swap-disabled' };
  if (state.swapsUsed >= stage.swapLimit) return { accepted: false, reason: 'swap-limit' };
  if (a === b) return { accepted: false, reason: 'same-cell' };
  if (state.cells[a] == null || state.cells[b] == null) return { accepted: false, reason: 'empty-cell' };

  const nextCells = state.cells.slice();
  const tmp = nextCells[a];
  nextCells[a] = nextCells[b];
  nextCells[b] = tmp;

  const nextState = {
    cells: nextCells,
    movesUsed: state.movesUsed + 1,
    swapsUsed: state.swapsUsed + 1,
    sequenceIndex: state.sequenceIndex,
    missionDone: state.missionDone,
    actionHistory: [...state.actionHistory, { type: 'swap', a, b }]
  };
  return { accepted: true, nextState };
}

export function applyAction(state, stage, action, options) {
  if (action.type === 'trace') return applyTrace(state, stage, action.cells, options);
  if (action.type === 'swap') return applySwap(state, stage, action.a, action.b);
  return { accepted: false, reason: 'unknown-action' };
}

// 公式解法（ステージ定義のofficialSolution）を先頭から実際にシミュレーションし、
// 手数内でクリアへ到達するかを検証する（18.2章：検証は探索結果と別に行う）。
export function simulateSolution(stage, options) {
  let state = createInitialState(stage);
  for (const action of stage.officialSolution) {
    const result = applyAction(state, stage, action, options);
    if (!result.accepted) {
      return { ok: false, reason: `action rejected (${result.reason}): ${JSON.stringify(action)}`, state };
    }
    state = result.nextState;
  }
  const cleared = isCleared(state, stage);
  if (!cleared) return { ok: false, reason: 'not cleared after official solution', state };
  return { ok: true, state, movesUsed: state.movesUsed };
}

function actionsEqual(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'trace') {
    return a.cells.length === b.cells.length && a.cells.every((v, i) => v === b.cells[i]);
  }
  if (a.type === 'swap') {
    return (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
  }
  return false;
}

export function matchesOfficialPrefix(stage, actionHistory) {
  if (actionHistory.length >= stage.officialSolution.length) return false;
  for (let i = 0; i < actionHistory.length; i++) {
    if (!actionsEqual(actionHistory[i], stage.officialSolution[i])) return false;
  }
  return true;
}

function stateKey(state) {
  let key = '';
  for (const v of state.cells) key += v == null ? '_' : v;
  return `${key}|${state.sequenceIndex}|${state.swapsUsed}|${state.missionDone ? 1 : 0}`;
}

function candidateActions(state, stage, options) {
  const minLength = options.minLength ?? 2;
  const maxLength = options.maxLength ?? 5;
  const actions = [];
  const paths = enumeratePaths(state.cells, stage.cols, minLength, maxLength);
  for (const p of paths) {
    if (evaluateMission(stage.mission, state, p.sum, p.cells.length)) {
      actions.push({ type: 'trace', cells: p.cells });
    }
  }
  if (stage.allowSwap && state.swapsUsed < stage.swapLimit) {
    const n = state.cells.length;
    for (let a = 0; a < n; a++) {
      if (state.cells[a] == null) continue;
      for (let b = a + 1; b < n; b++) {
        if (state.cells[b] == null) continue;
        actions.push({ type: 'swap', a, b });
      }
    }
  }
  return actions;
}

// 残り手数以内の解法を反復深化探索で求める（20.3章）。短い解法を優先するため、
// depthLimitを1から順に広げる。ノード数・時間の両方に上限を持たせる。
export function findPuzzleSolution({ stage, state, maxNodes = 50_000, maxMs = 300, options = {} }) {
  const startTime = Date.now();
  const initialState = state || createInitialState(stage);
  if (isCleared(initialState, stage)) return { status: 'solved', actions: [], visitedNodes: 0 };

  const maxDepth = stage.moveLimit - initialState.movesUsed;
  if (maxDepth <= 0) return { status: 'unsolved', actions: [], visitedNodes: 0 };

  let nodeCount = 0;
  let timedOut = false;

  for (let depthLimit = 1; depthLimit <= maxDepth; depthLimit++) {
    const visited = new Map();

    function dfs(st, depth, path) {
      if (timedOut) return null;
      nodeCount++;
      if (nodeCount >= maxNodes) { timedOut = true; return null; }
      if ((nodeCount & 511) === 0 && Date.now() - startTime > maxMs) { timedOut = true; return null; }
      if (isCleared(st, stage)) return path;
      if (depth >= depthLimit) return null;
      const key = stateKey(st);
      const bestDepthSeen = visited.get(key);
      if (bestDepthSeen !== undefined && bestDepthSeen <= depth) return null;
      visited.set(key, depth);
      for (const action of candidateActions(st, stage, options)) {
        const result = applyAction(st, stage, action, options);
        if (!result.accepted) continue;
        const found = dfs(result.nextState, depth + 1, [...path, action]);
        if (found) return found;
        if (timedOut) return null;
      }
      return null;
    }

    const found = dfs(initialState, 0, []);
    if (found) return { status: 'solved', actions: found, visitedNodes: nodeCount };
    if (timedOut) return { status: 'limit', actions: [], visitedNodes: nodeCount };
  }
  return { status: 'unsolved', actions: [], visitedNodes: nodeCount };
}

// 公式解法の接頭辞と一致していればその次の手を、しなければ探索結果を返す（14.2章）。
export function getHint(stage, state, hintOptions = {}) {
  if (matchesOfficialPrefix(stage, state.actionHistory)) {
    return { status: 'solved', actions: [stage.officialSolution[state.actionHistory.length]], visitedNodes: 0 };
  }
  return findPuzzleSolution({
    stage,
    state,
    maxNodes: hintOptions.maxNodes ?? 50_000,
    maxMs: hintOptions.maxMs ?? 300,
    options: hintOptions.options ?? {}
  });
}

// ステージ定義自体の妥当性を検証する（18.1章のチェック項目のうち、
// 単一ステージ内で完結するものすべて）。
export function validateStage(stage) {
  const errors = [];

  if (!stage.id || typeof stage.id !== 'string') errors.push('id is missing or not a string');
  if (![3, 4, 5].includes(stage.rows)) errors.push(`rows must be 3-5 (got ${stage.rows})`);
  if (![3, 4, 5].includes(stage.cols)) errors.push(`cols must be 3-5 (got ${stage.cols})`);
  if (!Array.isArray(stage.cells) || stage.cells.length !== stage.rows * stage.cols) {
    errors.push('cells.length must equal rows*cols');
  } else {
    for (const v of stage.cells) {
      if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 9)) {
        errors.push(`invalid cell value: ${v}`);
      }
    }
    const counts = {};
    for (const v of stage.cells) {
      if (v == null) continue;
      counts[v] = (counts[v] || 0) + 1;
    }
    for (const [num, count] of Object.entries(counts)) {
      if (count > 5) errors.push(`number ${num} appears ${count} times (max 5)`);
    }
  }

  if (!(stage.parMoves <= stage.moveLimit)) errors.push('parMoves must be <= moveLimit');
  if (!stage.allowSwap && stage.swapLimit !== 0) errors.push('swapLimit must be 0 when allowSwap is false');
  if (stage.allowSwap && !(stage.swapLimit >= 1)) errors.push('swapLimit must be >= 1 when allowSwap is true');

  if (!Array.isArray(stage.officialSolution) || stage.officialSolution.length === 0) {
    errors.push('officialSolution must be a non-empty array');
    return { valid: errors.length === 0, errors };
  }

  const sim = simulateSolution(stage);
  if (!sim.ok) {
    errors.push(`official solution invalid: ${sim.reason}`);
  } else if (sim.movesUsed > stage.moveLimit) {
    errors.push(`official solution uses ${sim.movesUsed} moves, exceeding moveLimit ${stage.moveLimit}`);
  } else if (sim.movesUsed !== stage.parMoves) {
    errors.push(`official solution uses ${sim.movesUsed} moves, but parMoves is ${stage.parMoves}`);
  }

  return { valid: errors.length === 0, errors };
}

// 全ステージの相互関係（ID重複・エリア/番号の連番）を検証する。
export function validateStageList(stages) {
  const errors = [];
  const ids = stages.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) errors.push(`duplicate stage ids: ${[...new Set(dupes)].join(', ')}`);

  const byArea = new Map();
  for (const stage of stages) {
    if (!byArea.has(stage.areaId)) byArea.set(stage.areaId, []);
    byArea.get(stage.areaId).push(stage.stageNumber);
  }
  for (const [areaId, numbers] of byArea) {
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        errors.push(`area ${areaId} stage numbers are not contiguous starting at 1: ${sorted.join(',')}`);
        break;
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
