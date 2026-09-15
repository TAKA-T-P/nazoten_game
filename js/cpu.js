// CPUの経路探索・候補選択・なぞり演出・停止管理（Phase3実装指示書 10〜14章）。
// DOMは一切操作しない。選択状態や結果はコールバックで通知し、表示はUI側が行う。
import { CONFIG } from './config.js';
import { Board } from './board.js';
import { isValidSum, calculateScore } from './scoring.js';

export class CpuController {
  /**
   * @param {{
   *   board: Board,
   *   levelConfig: object,
   *   rng?: () => number,
   *   onSelectionChange?: (indices: number[]) => void,
   *   onSuccess?: (result: object) => void,
   *   onFail?: (indices: number[]) => void,
   *   onDestroy?: (index: number) => void,
   *   onCellsClear?: (indices: number[]) => void,
   *   onCellsRefill?: (cells: {index:number, value:number}[]) => void
   * }} options
   */
  constructor({
    board,
    levelConfig,
    rng = Math.random,
    onSelectionChange = () => {},
    onSuccess = () => {},
    onFail = () => {},
    onDestroy = () => {},
    onCellsClear = () => {},
    onCellsRefill = () => {}
  }) {
    this.board = board;
    this.levelConfig = levelConfig;
    this.rng = rng;
    this.onSelectionChange = onSelectionChange;
    this.onSuccess = onSuccess;
    this.onFail = onFail;
    this.onDestroy = onDestroy;
    this.onCellsClear = onCellsClear;
    this.onCellsRefill = onCellsRefill;

    this.running = false;
    this.getScoringContext = () => ({ isFever: false, multiplier: 1 });
    this.timers = new Set();
    this.currentSelection = [];
    this.stuckSince = null;
  }

  // getScoringContext()は { isFever, multiplier } を返す。成功確定時点の最新の
  // 倍率状況を取得するため毎回呼び出す（なぞっている途中でフィーバーへ入る
  // 可能性があるため。仕様書10.4章）。
  start({ getScoringContext }) {
    this.running = true;
    this.getScoringContext = getScoringContext;
    this.stuckSince = null;
    this._scheduleThink();
  }

  stop() {
    this.running = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    if (this.currentSelection.length > 0) {
      this.currentSelection = [];
      this.onSelectionChange([]);
    }
  }

  _setTimeout(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.running) return;
      fn();
    }, Math.max(0, ms));
    this.timers.add(id);
    return id;
  }

  _neighbors(index) {
    const { row, col } = Board.indexToRowCol(index);
    const candidates = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    ];
    const result = [];
    for (const c of candidates) {
      if (c.row < 0 || c.row >= CONFIG.boardRows || c.col < 0 || c.col >= CONFIG.boardCols) continue;
      result.push(c.row * CONFIG.boardCols + c.col);
    }
    return result;
  }

  _sumOf(path) {
    return path.reduce((total, i) => total + this.board.getValue(i), 0);
  }

  // 上下左右に隣接し、同じマスを使わない、長さ2〜maxLengthの経路をすべて列挙する
  // （合計が有効かどうかは問わない。失敗手探しにも流用するため）。
  _enumeratePaths(maxLength) {
    const results = [];
    const walk = (path) => {
      if (path.length >= 2) results.push(path.slice());
      if (path.length >= maxLength) return;
      const last = path[path.length - 1];
      for (const neighbor of this._neighbors(last)) {
        if (!this.board.isSelectable(neighbor) || path.includes(neighbor)) continue;
        path.push(neighbor);
        walk(path);
        path.pop();
      }
    };
    for (let start = 0; start < this.board.size; start++) {
      if (this.board.isSelectable(start)) walk([start]);
    }
    return results;
  }

  // 合計10・20・30・40になる有効経路の一覧（仕様書10.2章）。
  findValidPaths() {
    const maxLength = this.levelConfig.maxPathLength;
    return this._enumeratePaths(maxLength)
      .map((path) => ({ path, sum: this._sumOf(path) }))
      .filter((candidate) => isValidSum(candidate.sum));
  }

  _findMistakePath() {
    const maxLength = this.levelConfig.maxPathLength;
    const invalid = this._enumeratePaths(maxLength)
      .map((path) => ({ path, sum: this._sumOf(path) }))
      .filter((candidate) => !isValidSum(candidate.sum));
    if (invalid.length === 0) return null;
    return invalid[Math.floor(this.rng() * invalid.length)];
  }

  // 評価値の高い順に並べ、bestMoveRateの確率で最善手（同点はランダム）、
  // それ以外は探索できた候補からランダムに1つ選ぶ（仕様書10.4・11.3章）。
  choosePath(paths) {
    if (paths.length === 0) return null;
    const { isFever, multiplier } = this.getScoringContext();
    const scored = paths.map((candidate) => ({
      ...candidate,
      points: calculateScore({ sum: candidate.sum, pathLength: candidate.path.length, multiplier, isFever }).points
    }));
    if (this.rng() < this.levelConfig.bestMoveRate) {
      scored.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if ((b.sum === 40) !== (a.sum === 40)) return b.sum === 40 ? 1 : -1;
        return b.path.length - a.path.length;
      });
      const topPoints = scored[0].points;
      const top = scored.filter((candidate) => candidate.points === topPoints);
      return top[Math.floor(this.rng() * top.length)];
    }
    return scored[Math.floor(this.rng() * scored.length)];
  }

  _scheduleThink() {
    if (!this.running) return;
    const { thinkMinMs, thinkMaxMs } = this.levelConfig;
    const delay = thinkMinMs + this.rng() * (thinkMaxMs - thinkMinMs);
    this._setTimeout(() => this._think(), delay);
  }

  _think() {
    if (!this.running) return;

    if (this.rng() < this.levelConfig.mistakeRate) {
      const mistake = this._findMistakePath();
      if (mistake) {
        this._traceAndResolve(mistake.path, true);
        return;
      }
      // 適切な失敗経路がなければ通常どおり有効経路を探す。
    }

    const validPaths = this.findValidPaths();
    if (validPaths.length === 0) {
      this._handleStuck();
      return;
    }
    this.stuckSince = null;
    const chosen = this.choosePath(validPaths);
    this._traceAndResolve(chosen.path, false);
  }

  // 有効経路が見つからない状態がnoMoveDestroyMs以上続いたら破壊する（仕様書13.1章）。
  // 補充待ちで盤面が変わる可能性があるため、短い間隔で再チェックし続ける。
  _handleStuck() {
    const now = performance.now();
    if (this.stuckSince === null) this.stuckSince = now;
    if (now - this.stuckSince >= this.levelConfig.noMoveDestroyMs) {
      this._destroyRandomCell();
      this.stuckSince = null;
      this._scheduleThink();
      return;
    }
    this._setTimeout(() => this._think(), 300);
  }

  _destroyRandomCell() {
    const selectable = [];
    for (let i = 0; i < this.board.size; i++) {
      if (this.board.isSelectable(i)) selectable.push(i);
    }
    if (selectable.length === 0) return;
    const index = selectable[Math.floor(this.rng() * selectable.length)];
    this.onDestroy(index);
    const refills = this.board.clear([index]);
    this.onCellsClear([index]);
    this._setTimeout(() => {
      const applied = refills.map(({ index: i }) => ({ index: i, value: this.board.refill(i) }));
      this.onCellsRefill(applied);
    }, CONFIG.refillDelayMs);
  }

  _traceAndResolve(path, isMistake) {
    this.currentSelection = [];
    const stepMs = this.levelConfig.traceStepMs;
    path.forEach((cellIndex, i) => {
      this._setTimeout(() => {
        this.currentSelection.push(cellIndex);
        this.onSelectionChange(this.currentSelection.slice());
        if (i === path.length - 1) {
          this._setTimeout(() => this._resolveSelection(path, isMistake), stepMs);
        }
      }, i * stepMs);
    });
  }

  // なぞり終えた時点で盤面が変わっていないか再検証してから確定する（仕様書12.2章）。
  _resolveSelection(path, isMistake) {
    if (!this.running) return;
    const stillValid = path.every((i) => this.board.isSelectable(i));
    this.currentSelection = [];
    this.onSelectionChange([]);

    if (!stillValid) {
      this._scheduleThink();
      return;
    }

    const sum = this._sumOf(path);
    if (!isMistake && isValidSum(sum)) {
      const { isFever, multiplier } = this.getScoringContext();
      const result = calculateScore({ sum, pathLength: path.length, multiplier, isFever });
      this.onSuccess({ indices: path, ...result });
      const refills = this.board.clear(path);
      this.onCellsClear(path);
      this._setTimeout(() => {
        const applied = refills.map(({ index }) => ({ index, value: this.board.refill(index) }));
        this.onCellsRefill(applied);
      }, CONFIG.refillDelayMs);
    } else {
      this.onFail(path);
    }
    this._scheduleThink();
  }
}
