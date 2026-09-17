// じっくりモードの状態・進行・履歴（Phase 6実装指示書 19章）。
// 得点処理・フィーバータイマー・60秒タイマーは一切生成しない。
// 盤面モデルはboard.js（Board）を使わず、可変サイズ（3×3/4×4/5×5）を
// 素直に扱えるpuzzle-solver.jsの純粋関数の上に直接構築する。
import { CONFIG } from './config.js';
import { PUZZLE_STAGES } from './puzzle-stages.js';
import { SelectionController } from './input.js';
import {
  createInitialState,
  applyTrace,
  applySwap,
  areAdjacent,
  isCleared,
  getHint
} from './puzzle-solver.js';

export const STATUS = {
  IDLE: 'idle',
  READY: 'ready',
  PLAYING: 'playing',
  BLOCKED: 'blocked',
  CLEARED: 'cleared',
  DISPOSED: 'disposed'
};

export function getStageById(stageId) {
  return PUZZLE_STAGES.find((s) => s.id === stageId) || null;
}

function cloneState(state) {
  return {
    cells: state.cells.slice(),
    movesUsed: state.movesUsed,
    swapsUsed: state.swapsUsed,
    sequenceIndex: state.sequenceIndex,
    missionDone: state.missionDone,
    actionHistory: state.actionHistory.map((a) => ({ ...a, cells: a.cells ? a.cells.slice() : undefined }))
  };
}

export class PuzzleController extends EventTarget {
  constructor(boardEl) {
    super();
    this.boardEl = boardEl;
    this.status = STATUS.IDLE;
    this.stage = null;
    this.state = null;
    this.history = [];
    this.hintUsed = false;
    this.swapSelection = null;
    this.hintAnimating = false;
    this.hintTimer = null;
    this.selectionController = null;
  }

  startStage(stageId) {
    const stage = getStageById(stageId);
    if (!stage) return false;
    this._cancelHint();
    if (this.selectionController) this.selectionController.destroy();

    this.stage = stage;
    this.state = createInitialState(stage);
    this.history = [];
    this.hintUsed = false;
    this.swapSelection = null;
    this.hintAnimating = false;
    this.status = STATUS.PLAYING;

    this.selectionController = new SelectionController(this.boardEl, {
      isSelectable: (i) => this._isSelectable(i),
      areAdjacent: (a, b) => areAdjacent(a, b, this.stage.cols),
      maxLength: CONFIG.puzzle.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => this._emitSelectionUpdate(sel),
      onCellAdded: (i, sel) => this._emitSelectionUpdate(sel),
      onCellRemoved: (sel) => this._emitSelectionUpdate(sel),
      onSelectionEnd: (sel) => this.commitPath(sel),
      onSelectionCancel: () => this._emitSelectionUpdate([]),
      // 破壊は確定仕様として完全に不使用（Phase6実装指示書 2章・12.3章）。
      onDoubleTap: () => {},
      onTap: (index) => this._handleTap(index),
      onLongPress: () => this._clearSwapSelection()
    });

    this.dispatchEvent(new CustomEvent('boardinit', {
      detail: { stage, cells: this.state.cells.slice() }
    }));
    this._emitMovesUpdate();
    return true;
  }

  _isSelectable(index) {
    if (this.status !== STATUS.PLAYING || this.hintAnimating) return false;
    return this.state.cells[index] != null;
  }

  _emitSelectionUpdate(indices) {
    this.dispatchEvent(new CustomEvent('selectionupdate', { detail: { indices } }));
  }

  _emitMovesUpdate() {
    this.dispatchEvent(new CustomEvent('movesupdate', {
      detail: {
        movesUsed: this.state.movesUsed,
        moveLimit: this.stage.moveLimit,
        swapsUsed: this.state.swapsUsed,
        swapLimit: this.stage.swapLimit,
        sequenceIndex: this.state.sequenceIndex
      }
    }));
  }

  commitPath(pathCells) {
    if (this.status !== STATUS.PLAYING || this.hintAnimating) return;
    const result = applyTrace(this.state, this.stage, pathCells, {
      minLength: CONFIG.puzzle.minPathLength,
      maxLength: CONFIG.puzzle.maxPathLength
    });
    this._emitSelectionUpdate([]);
    if (!result.accepted) {
      this.dispatchEvent(new CustomEvent('fail', { detail: { cells: pathCells } }));
      return;
    }
    this.history.push(cloneState(this.state));
    this.state = result.nextState;
    this.dispatchEvent(new CustomEvent('cellsclear', {
      detail: { indices: result.clearedCells, sum: result.sum }
    }));
    this._emitMovesUpdate();
    this._afterAction();
  }

  _handleTap(index) {
    if (this.status !== STATUS.PLAYING || this.hintAnimating) return;
    if (!this.stage.allowSwap) return;
    if (this.state.cells[index] == null) return;
    if (this.swapSelection === null) {
      this.swapSelection = index;
      this.dispatchEvent(new CustomEvent('swapselect', { detail: { index } }));
      return;
    }
    if (this.swapSelection === index) {
      this._clearSwapSelection();
      return;
    }
    this.commitSwap(this.swapSelection, index);
  }

  _clearSwapSelection() {
    if (this.swapSelection === null) return;
    this.swapSelection = null;
    this.dispatchEvent(new CustomEvent('swapcancel', {}));
  }

  commitSwap(firstId, secondId) {
    if (this.status !== STATUS.PLAYING || this.hintAnimating) return;
    this.swapSelection = null;
    const result = applySwap(this.state, this.stage, firstId, secondId);
    if (!result.accepted) {
      this.dispatchEvent(new CustomEvent('swapblocked', { detail: { reason: result.reason } }));
      return;
    }
    this.history.push(cloneState(this.state));
    this.state = result.nextState;
    this.dispatchEvent(new CustomEvent('swap', {
      detail: { a: firstId, b: secondId, values: [this.state.cells[firstId], this.state.cells[secondId]] }
    }));
    this._emitMovesUpdate();
    this._afterAction();
  }

  // 消去・入れかえ確定後は必ずクリア判定→手数上限判定の順で行う（11.3章）。
  _afterAction() {
    if (isCleared(this.state, this.stage)) {
      this.finishStage();
      return;
    }
    if (this.state.movesUsed >= this.stage.moveLimit) {
      this.status = STATUS.BLOCKED;
      this.dispatchEvent(new CustomEvent('blocked', {}));
    }
  }

  finishStage() {
    this.status = STATUS.CLEARED;
    const stars = 1
      + (this.state.movesUsed <= this.stage.parMoves ? 1 : 0)
      + (!this.hintUsed ? 1 : 0);
    this.dispatchEvent(new CustomEvent('cleared', {
      detail: {
        stageId: this.stage.id,
        stars,
        movesUsed: this.state.movesUsed,
        parMoves: this.stage.parMoves,
        hintUsed: this.hintUsed
      }
    }));
  }

  undo() {
    if (this.status === STATUS.DISPOSED || this.status === STATUS.CLEARED) return false;
    if (this.history.length === 0) return false;
    this._cancelHint();
    this._clearSwapSelection();
    this.state = this.history.pop();
    this.status = STATUS.PLAYING;
    this.dispatchEvent(new CustomEvent('undo', { detail: { cells: this.state.cells.slice() } }));
    this._emitMovesUpdate();
    return true;
  }

  restart() {
    if (this.status === STATUS.DISPOSED) return false;
    this._cancelHint();
    this._clearSwapSelection();
    this.state = createInitialState(this.stage);
    this.history = [];
    this.hintUsed = false;
    this.status = STATUS.PLAYING;
    this.dispatchEvent(new CustomEvent('restart', { detail: { cells: this.state.cells.slice() } }));
    this._emitMovesUpdate();
    return true;
  }

  // ヒントを考え中…の表示が実際に描画されてから探索するよう、1フレーム遅らせる
  // （14.1章）。探索自体は同期実行だが、5×5・入れかえ問題でも時間予算
  // （hintTimeBudgetMs）で打ち切るため、メインスレッドを長時間占有しない。
  requestHint() {
    if (this.status !== STATUS.PLAYING || this.hintAnimating) return false;
    this._cancelHint();
    this.dispatchEvent(new CustomEvent('hintthinking', {}));
    const token = {};
    this._hintToken = token;
    this.hintTimer = setTimeout(() => {
      if (this._hintToken !== token || this.status === STATUS.DISPOSED) return;
      this._runHintSearch(token);
    }, 30);
    return true;
  }

  _runHintSearch(token) {
    // 入れかえを含む問題は候補数が多く探索が重くなりやすいため、時間予算を
    // 広めに取る（20.3章の推奨値はあくまで初期値であり、盤面の性質に応じて
    // 調整してよい）。
    const maxMs = this.stage.allowSwap ? CONFIG.puzzle.hintTimeBudgetMs * 3 : CONFIG.puzzle.hintTimeBudgetMs;
    const hint = getHint(this.stage, this.state, {
      maxNodes: CONFIG.puzzle.hintNodeLimit,
      maxMs,
      options: { minLength: CONFIG.puzzle.minPathLength, maxLength: CONFIG.puzzle.maxPathLength }
    });
    if (this._hintToken !== token || this.status === STATUS.DISPOSED) return;

    if (hint.status !== 'solved' || hint.actions.length === 0) {
      this.dispatchEvent(new CustomEvent('hintstuck', {}));
      return;
    }
    this.hintUsed = true;
    this.hintAnimating = true;
    const action = hint.actions[0];
    this.dispatchEvent(new CustomEvent('hintfound', {
      detail: { action, animationMs: CONFIG.puzzle.hintAnimationMs }
    }));
    this.hintTimer = setTimeout(() => {
      if (this._hintToken !== token) return;
      this.hintAnimating = false;
      this.hintTimer = null;
      this.dispatchEvent(new CustomEvent('hintend', {}));
    }, CONFIG.puzzle.hintAnimationMs);
  }

  _cancelHint() {
    this._hintToken = null;
    this.hintAnimating = false;
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
  }

  leaveStage() {
    this._cancelHint();
    this._clearSwapSelection();
    if (this.selectionController) {
      this.selectionController.forceCancel();
    }
    this.status = STATUS.IDLE;
    this.stage = null;
    this.state = null;
    this.history = [];
  }

  dispose() {
    this._cancelHint();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    this.status = STATUS.DISPOSED;
  }
}
